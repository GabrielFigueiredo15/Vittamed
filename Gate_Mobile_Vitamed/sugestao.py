from __future__ import annotations

import re
from typing import Any

import scraper

MAX_SUGESTOES = 3
_GENERICA = "/pharmaceutic_form/"
_DOSAGEM = re.compile(r"(\d+(?:[.,]\d+)?)\s*(mcg|mg|g|ml|ui|%)", re.IGNORECASE)


def _padrao_dosagem(dosagem: str | None) -> re.Pattern[str] | None:
    if not dosagem:
        return None
    m = _DOSAGEM.search(dosagem)
    if not m:
        return None
    numero = r"[.,]".join(m.group(1).replace(",", ".").split("."))
    unidade = re.escape(m.group(2).lower())
    return re.compile(rf"(?<![\d.,]){numero}\s*{unidade}(?![a-z])", re.IGNORECASE)


async def sugerir(nome: str, dosagem: str | None = None) -> dict[str, Any]:
    itens = await scraper.buscar(nome, limite=30, fuzzy=True, score_min=0.75)
    padrao = _padrao_dosagem(dosagem)
    fotos: list[dict[str, Any]] = []
    generica: str | None = None
    vistas: set[str] = set()
    for item in itens:
        imagem = item.get("imagem")
        if not imagem:
            continue
        if _GENERICA in imagem:
            generica = generica or imagem
            continue
        if imagem in vistas:
            continue
        if "+" in (item.get("nome") or "") and "+" not in nome:
            continue
        vistas.add(imagem)
        fotos.append(
            {
                "imagem": imagem,
                "produto": item.get("nome"),
                "score": item.get("score") or 0.0,
                "mesma_dosagem": bool(padrao and padrao.search(item.get("nome") or "")),
            }
        )
    fotos.sort(key=lambda f: (f["mesma_dosagem"], f["score"]), reverse=True)
    return {"sugestoes": fotos[:MAX_SUGESTOES], "imagem_generica": generica}
