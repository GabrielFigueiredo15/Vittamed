from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

import auth_fb

router = APIRouter(prefix="/auth", tags=["auth"])


class Credenciais(BaseModel):
    email: EmailStr
    senha: str = Field(..., min_length=6)


class EmailIn(BaseModel):
    email: EmailStr


class RefreshIn(BaseModel):
    refresh_token: str


class Sessao(BaseModel):
    uid: str
    email: str | None = None
    id_token: str
    refresh_token: str
    expira_em: int


def _tratar(exc: auth_fb.AuthError):
    raise HTTPException(status_code=exc.status, detail=exc.mensagem)


@router.post("/registrar", response_model=Sessao, summary="Cria conta (RF01)")
async def registrar(dados: Credenciais):
    try:
        return await auth_fb.registrar(dados.email, dados.senha)
    except auth_fb.AuthError as exc:
        _tratar(exc)


@router.post("/login", response_model=Sessao, summary="Login (RF02)")
async def login(dados: Credenciais):
    try:
        return await auth_fb.login(dados.email, dados.senha)
    except auth_fb.AuthError as exc:
        _tratar(exc)


@router.post("/recuperar-senha", summary="Envia e-mail de redefinicao de senha")
async def recuperar_senha(dados: EmailIn):
    try:
        await auth_fb.recuperar_senha(dados.email)
    except auth_fb.AuthError as exc:
        _tratar(exc)
    return {"enviado": True, "mensagem": "se o e-mail existir, enviamos o link"}


@router.post("/refresh", response_model=Sessao, summary="Renova o ID token")
async def refresh(dados: RefreshIn):
    try:
        r = await auth_fb.refresh(dados.refresh_token)
    except auth_fb.AuthError as exc:
        _tratar(exc)
    return {"email": None, **r}
