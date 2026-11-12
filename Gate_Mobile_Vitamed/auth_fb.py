from __future__ import annotations

import os
from typing import Any

import httpx

_IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts"
_SECURETOKEN = "https://securetoken.googleapis.com/v1/token"

_ERROS = {
    "EMAIL_EXISTS": "e-mail ja cadastrado",
    "INVALID_LOGIN_CREDENTIALS": "e-mail ou senha invalidos",
    "INVALID_PASSWORD": "e-mail ou senha invalidos",
    "EMAIL_NOT_FOUND": "e-mail ou senha invalidos",
    "INVALID_EMAIL": "e-mail invalido",
    "WEAK_PASSWORD : Password should be at least 6 characters": "senha muito curta (min. 6)",
    "USER_DISABLED": "conta desativada",
    "TOO_MANY_ATTEMPTS_TRY_LATER": "muitas tentativas, tente mais tarde",
    "TOKEN_EXPIRED": "sessao expirada, faca login novamente",
    "INVALID_REFRESH_TOKEN": "refresh_token invalido",
}

_CREDENCIAIS_INVALIDAS = {"INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND"}


class AuthError(Exception):
    def __init__(self, mensagem: str, status: int = 400, codigo: str | None = None):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status
        self.codigo = codigo


def _api_key() -> str:
    key = os.getenv("FIREBASE_API_KEY")
    if not key:
        raise AuthError("FIREBASE_API_KEY nao configurada no ambiente", 503)
    return key


def _status(codigo: str) -> int:
    if codigo.startswith("TOO_MANY_ATTEMPTS"):
        return 429
    if codigo == "USER_DISABLED":
        return 403
    if codigo in _CREDENCIAIS_INVALIDAS:
        return 401
    return 400


async def _post(
    url: str,
    params: dict[str, str],
    json: dict[str, Any] | None = None,
    data: dict[str, str] | None = None,
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=json, data=data, params=params)
        corpo = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AuthError(f"falha ao falar com o Firebase: {exc}", 502) from exc
    if resp.status_code >= 400:
        codigo = (corpo.get("error") or {}).get("message", "erro de autenticacao")
        raise AuthError(_ERROS.get(codigo, codigo), _status(codigo), codigo)
    return corpo


async def registrar(email: str, senha: str) -> dict[str, Any]:
    d = await _post(
        f"{_IDENTITY}:signUp",
        {"key": _api_key()},
        json={"email": email, "password": senha, "returnSecureToken": True},
    )
    return _sessao(d)


async def login(email: str, senha: str) -> dict[str, Any]:
    d = await _post(
        f"{_IDENTITY}:signInWithPassword",
        {"key": _api_key()},
        json={"email": email, "password": senha, "returnSecureToken": True},
    )
    return _sessao(d)


async def recuperar_senha(email: str) -> None:
    try:
        await _post(
            f"{_IDENTITY}:sendOobCode",
            {"key": _api_key()},
            json={"requestType": "PASSWORD_RESET", "email": email},
        )
    except AuthError as exc:
        if exc.codigo != "EMAIL_NOT_FOUND":
            raise


async def refresh(refresh_token: str) -> dict[str, Any]:
    try:
        d = await _post(
            _SECURETOKEN,
            {"key": _api_key()},
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        )
    except AuthError as exc:
        if exc.status in (502, 503):
            raise
        raise AuthError(exc.mensagem, 401, exc.codigo) from exc
    return {
        "uid": d.get("user_id", ""),
        "id_token": d["id_token"],
        "refresh_token": d["refresh_token"],
        "expira_em": int(d["expires_in"]),
    }


def _sessao(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "uid": d["localId"],
        "email": d.get("email"),
        "id_token": d["idToken"],
        "refresh_token": d["refreshToken"],
        "expira_em": int(d["expiresIn"]),
    }
