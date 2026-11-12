from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request

import firebase


def claims_atuais(request: Request) -> dict[str, Any]:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(401, "envie 'Authorization: Bearer <firebase-id-token>'")
    token = header.split(" ", 1)[1].strip()
    try:
        return firebase.verificar_token(token)
    except firebase.FirebaseNaoConfigurado as exc:
        raise HTTPException(503, str(exc))
    except Exception:
        raise HTTPException(401, "token invalido ou expirado")


def uid_atual(claims: dict[str, Any] = Depends(claims_atuais)) -> str:
    return claims["uid"]
