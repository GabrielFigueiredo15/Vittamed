from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from google.api_core.exceptions import GoogleAPIError

import firebase
import fotos
import scraper
import store
import sugestao
from deps import uid_atual
from models import MedicamentoCreate, MedicamentoOut, MedicamentoUpdate, SugestoesImagem

router = APIRouter(prefix="/medicamentos", tags=["medicamentos"])
_COL = "medicamentos"
log = logging.getLogger("vittamed.fotos")


@router.post("", response_model=MedicamentoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: MedicamentoCreate, uid: str = Depends(uid_atual)):
    return store.criar(uid, _COL, dados)


@router.get("", response_model=list[MedicamentoOut])
def listar(uid: str = Depends(uid_atual)):
    return store.listar(uid, _COL)


@router.get(
    "/imagem-sugerida",
    response_model=SugestoesImagem,
    summary="Sugere fotos da embalagem pelo nome e dosagem (consultaremedios)",
    dependencies=[Depends(uid_atual)],
)
async def imagem_sugerida(
    nome: str = Query(..., min_length=2, description="Nome do remedio, ex: Losartana"),
    dosagem: str | None = Query(None, description="Ex: 50mg; sobe as caixas com a mesma dosagem"),
):
    try:
        return await sugestao.sugerir(nome, dosagem)
    except scraper.ConsultaRemediosError as exc:
        raise HTTPException(502, str(exc))


@router.get("/{med_id}", response_model=MedicamentoOut)
def obter(med_id: str, uid: str = Depends(uid_atual)):
    return store.obter(uid, _COL, med_id)


@router.patch("/{med_id}", response_model=MedicamentoOut)
def atualizar(med_id: str, dados: MedicamentoUpdate, uid: str = Depends(uid_atual)):
    return store.atualizar(uid, _COL, med_id, dados)


@router.delete("/{med_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(med_id: str, uid: str = Depends(uid_atual)):
    store.remover(uid, _COL, med_id)
    store.remover_por_medicamento(uid, med_id)
    try:
        fotos.apagar(uid, med_id)
    except firebase.FirebaseNaoConfigurado:
        pass
    except GoogleAPIError:
        log.exception("falha ao apagar a foto do medicamento %s", med_id)


def _base_url(request: Request) -> str:
    base = (os.getenv("API_BASE_URL") or str(request.base_url)).rstrip("/")
    local = (request.url.hostname or "") in ("localhost", "127.0.0.1", "testserver")
    if base.startswith("http://") and not local:
        base = "https://" + base[len("http://"):]
    return base


@router.post("/{med_id}/foto", response_model=MedicamentoOut, summary="Envia a foto da embalagem (RF05)")
def enviar_foto(
    med_id: str,
    request: Request,
    foto: UploadFile = File(..., description="JPEG, PNG ou WEBP, ate 5 MB"),
    uid: str = Depends(uid_atual),
):
    store.obter(uid, _COL, med_id)
    conteudo = foto.file.read(fotos.TAMANHO_MAX + 1)
    if len(conteudo) > fotos.TAMANHO_MAX:
        raise HTTPException(413, "foto maior que 5 MB")
    try:
        token = fotos.salvar(uid, med_id, conteudo)
    except fotos.FotoInvalida as exc:
        raise HTTPException(415, str(exc))
    except firebase.FirebaseNaoConfigurado as exc:
        raise HTTPException(503, str(exc))
    url = f"{_base_url(request)}/fotos/{token}"
    return store.atualizar(uid, _COL, med_id, MedicamentoUpdate(foto_url=url))
