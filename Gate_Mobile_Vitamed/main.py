import json
import os
import re
from typing import Any, AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

import ai
import scraper
from deps import uid_atual
from routers import auth, doses, medicamentos, orientacoes, perfil

app = FastAPI(
    title="Gate Mobile Vitamed",
    description=(
        "Backend do Vittamed: CRUD (Firestore) do app de medicamentos para "
        "idosos + consulta de remedios e assistente de IA. Autenticacao via "
        "Firebase ID token (header Authorization: Bearer)."
    ),
    version="0.3.0",
)

app.include_router(auth.router)
app.include_router(perfil.router)
app.include_router(medicamentos.router)
app.include_router(doses.router)
app.include_router(orientacoes.router)


@app.middleware("http")
async def pausa(request: Request, call_next):
    if os.getenv("PAUSE") == "1":
        return JSONResponse(
            {"pausado": True, "mensagem": "olá, estou pausado no momento!"},
            status_code=503,
        )
    return await call_next(request)


@app.get("/")
def main():
    return "ola!"


@app.get("/busca", summary="Busca remedios (imagem, preco e link da bula)")
async def busca(
    termo: str = Query(..., min_length=2, description="Nome, marca ou principio ativo"),
    limite: int = Query(20, ge=1, le=50),
    fuzzy: bool = Query(True, description="Rankear por similaridade e filtrar"),
    score_min: float = Query(0.35, ge=0.0, le=1.0, description="Score minimo (0..1)"),
):
    try:
        itens = await scraper.buscar(
            termo, limite=limite, fuzzy=fuzzy, score_min=score_min
        )
    except scraper.ConsultaRemediosError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"termo": termo, "fuzzy": fuzzy, "total": len(itens), "resultados": itens}


@app.get("/bula/{slug}", summary="Bula completa: PDFs, principio ativo e secoes")
async def bula(slug: str):
    try:
        return await scraper.bula(slug)
    except scraper.ConsultaRemediosError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc))


class ChatRequest(BaseModel):
    mensagem: str | None = Field(None, description="Texto do usuario")
    imagem_url: str | None = Field(None, description="URL de imagem (modelo vision)")
    mensagens: list[dict[str, Any]] | None = Field(
        None,
        description="Historico estilo OpenAI (roles user/assistant); tem prioridade sobre 'mensagem'",
    )
    temperatura: float = Field(1.0, ge=0.0, le=2.0)
    max_tokens: int = Field(512, ge=1, le=4096)
    stream: bool = False
    rag: bool = Field(True, description="Injeta busca+bula no contexto")
    remedio: str | None = Field(
        None, description="Termo p/ buscar; se vazio usa a ultima mensagem do usuario"
    )


GUARDRAIL = (
    "Voce e o assistente de medicamentos do app Vittamed, para pessoas idosas. "
    "Responda em portugues, de forma simples e curta. Voce PODE: explicar para "
    "que serve um medicamento, como/quando usar conforme a bula, composicao e "
    "informacoes gerais ja cadastradas. Voce NAO PODE, em hipotese alguma, dar "
    "orientacao clinica individual: nao recomende nem ajuste dose, nao avalie "
    "interacoes entre medicamentos, nao opine sobre efeitos adversos no caso da "
    "pessoa, nem oriente interromper ou alterar tratamento. Diante desse tipo de "
    "pergunta, recuse educadamente e encaminhe a pessoa a um medico ou "
    "farmaceutico. Sempre lembre que voce nao substitui a orientacao de um "
    "profissional de saude."
)

_SECOES_RAG = ("Para que serve", "Como usar", "Contraindicação", "Composição")
_PAPEIS_PERMITIDOS = {"user", "assistant"}


def _limpar_html(texto: str, limite: int = 600) -> str:
    puro = re.sub(r"<[^>]+>", " ", texto)
    puro = re.sub(r"\s+", " ", puro).strip()
    return puro[:limite]


async def _contexto_rag(termo: str) -> str | None:
    try:
        itens = await scraper.buscar(termo, limite=1)
        if not itens:
            return None
        top = itens[0]
        partes = [
            f"Remedio: {top['nome']}",
            f"Preco: R$ {top['preco']}" if top.get("preco") else None,
            f"Receita: {top['receita']}" if top.get("receita") else None,
        ]
        if top.get("slug"):
            try:
                b = await scraper.bula(top["slug"])
                if b.get("principio_ativo"):
                    partes.append(f"Principio ativo: {b['principio_ativo']}")
                for sec in b.get("secoes") or []:
                    if sec.get("titulo") in _SECOES_RAG and sec.get("conteudo_html"):
                        partes.append(
                            f"{sec['titulo']}: {_limpar_html(sec['conteudo_html'])}"
                        )
            except scraper.ConsultaRemediosError:
                pass
        return "\n".join(p for p in partes if p)
    except scraper.ConsultaRemediosError:
        return None


def _montar_mensagens(req: ChatRequest) -> list[dict[str, Any]]:
    if req.mensagens:
        mensagens = [m for m in req.mensagens if m.get("role") in _PAPEIS_PERMITIDOS]
        if not mensagens:
            raise HTTPException(422, "'mensagens' precisa de ao menos uma mensagem user/assistant")
        return mensagens
    if not req.mensagem:
        raise HTTPException(422, "informe 'mensagem' ou 'mensagens'")
    conteudo: list[dict[str, Any]] = [{"type": "text", "text": req.mensagem}]
    if req.imagem_url:
        conteudo.insert(0, {"type": "image_url", "image_url": {"url": req.imagem_url}})
    return [{"role": "user", "content": conteudo}]


def _ultimo_texto_usuario(mensagens: list[dict[str, Any]]) -> str | None:
    for m in reversed(mensagens):
        if m.get("role") != "user":
            continue
        conteudo = m.get("content")
        if isinstance(conteudo, str):
            return conteudo
        if isinstance(conteudo, list):
            for parte in conteudo:
                if isinstance(parte, dict) and parte.get("type") == "text":
                    return parte.get("text")
    return None


async def _sse_seguro(gen: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    try:
        async for parte in gen:
            yield parte
    except ai.IAError as exc:
        erro = json.dumps({"erro": str(exc)}, ensure_ascii=False)
        yield f"data: {erro}\n\n".encode()


@app.post(
    "/chat",
    summary="Assistente de IA (texto, imagem, RAG e streaming)",
    dependencies=[Depends(uid_atual)],
)
async def chat(req: ChatRequest):
    mensagens = _montar_mensagens(req)
    sistema = GUARDRAIL
    if req.rag:
        termo = req.remedio or _ultimo_texto_usuario(mensagens)
        contexto = await _contexto_rag(termo) if termo else None
        if contexto:
            sistema += (
                "\n\nUse os dados abaixo (fonte: consultaremedios.com.br) como "
                "base factual.\n--- DADOS ---\n" + contexto
            )
    mensagens = [{"role": "system", "content": sistema}, *mensagens]
    if req.stream:
        try:
            ai.api_key()
        except ai.IAError as exc:
            raise HTTPException(status_code=502, detail=str(exc))
        gen = ai.chat_stream(mensagens, ai.MODELO_PADRAO, req.temperatura, req.max_tokens)
        return StreamingResponse(_sse_seguro(gen), media_type="text/event-stream")
    try:
        resp = await ai.chat(mensagens, ai.MODELO_PADRAO, req.temperatura, req.max_tokens)
    except ai.IAError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    message = (resp.get("choices") or [{}])[0].get("message") or {}
    msg = message.get("content") or message.get("reasoning_content")
    return {"resposta": msg, "modelo": ai.MODELO_PADRAO}
