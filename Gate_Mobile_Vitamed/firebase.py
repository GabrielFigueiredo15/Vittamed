from __future__ import annotations

import json
import os
import threading
from typing import Any

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore

_lock = threading.Lock()
_app: firebase_admin.App | None = None
_db: Any = None


class FirebaseNaoConfigurado(RuntimeError):
    pass


def _carregar_credencial() -> credentials.Base:
    raw = os.getenv("FIREBASE_CREDENTIALS")
    if raw:
        raw = raw.strip()
        if raw.startswith("{"):
            return credentials.Certificate(json.loads(raw))
        if os.path.isfile(raw):
            return credentials.Certificate(raw)
        raise FirebaseNaoConfigurado(
            "FIREBASE_CREDENTIALS nao e JSON nem caminho de arquivo valido"
        )
    gac = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if gac and os.path.isfile(gac):
        return credentials.Certificate(gac)
    raise FirebaseNaoConfigurado(
        "defina FIREBASE_CREDENTIALS (JSON da service account) no ambiente"
    )


def _ensure_app() -> firebase_admin.App:
    global _app
    if _app is not None:
        return _app
    with _lock:
        if _app is None:
            _app = firebase_admin.initialize_app(_carregar_credencial())
    return _app


def db() -> Any:
    global _db
    if _db is None:
        with _lock:
            if _db is None:
                _db = firestore.client(_ensure_app())
    return _db


def verificar_token(id_token: str) -> dict[str, Any]:
    return fb_auth.verify_id_token(id_token, app=_ensure_app())
