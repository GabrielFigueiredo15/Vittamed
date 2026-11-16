from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Response

import firebase
import fotos

router = APIRouter(prefix="/fotos", tags=["fotos"])
_TOKEN = re.compile(r"^[0-9a-f]{48}$")


@router.get("/{token}", summary="Imagem da foto do remedio (link da foto_url, sem login)")
def obter(token: str):
    if not _TOKEN.match(token):
        raise HTTPException(404, "foto nao encontrada")
    try:
        foto = fotos.obter(token)
    except firebase.FirebaseNaoConfigurado as exc:
        raise HTTPException(503, str(exc))
    if foto is None:
        raise HTTPException(404, "foto nao encontrada")
    conteudo, tipo = foto
    return Response(
        content=conteudo,
        media_type=tipo,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
