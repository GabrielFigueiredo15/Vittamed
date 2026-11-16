from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

import firebase
import push
from deps import uid_atual

router = APIRouter(prefix="/aparelhos", tags=["aparelhos"])


class AparelhoIn(BaseModel):
    token_push: str = Field(
        ..., pattern=r"^Expo(nent)?PushToken\[[^\]]+\]$", description="Token do Expo (getExpoPushTokenAsync)"
    )
    plataforma: Literal["android", "ios"]


class AparelhoOut(BaseModel):
    token_push: str
    plataforma: str


@router.put("", response_model=AparelhoOut, summary="Registra (ou move) o token de push deste aparelho (RF09)")
def registrar(dados: AparelhoIn, uid: str = Depends(uid_atual)):
    try:
        return push.registrar(uid, dados.token_push, dados.plataforma)
    except firebase.FirebaseNaoConfigurado as exc:
        raise HTTPException(503, str(exc))


@router.delete("/{token_push}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove o aparelho da conta (logout)")
def remover(token_push: str, uid: str = Depends(uid_atual)):
    try:
        removido = push.remover(uid, token_push)
    except firebase.FirebaseNaoConfigurado as exc:
        raise HTTPException(503, str(exc))
    if not removido:
        raise HTTPException(404, "aparelho nao encontrado")
