from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel

import firebase

_SINGULAR = {"medicamentos": "medicamento", "doses": "dose", "orientacoes": "orientacao"}


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _user_doc(uid: str):
    return firebase.db().collection("users").document(uid)


def colecao(uid: str, nome: str):
    return _user_doc(uid).collection(nome)


def _nao_encontrado(nome: str) -> HTTPException:
    return HTTPException(404, f"{_SINGULAR.get(nome, nome)} nao encontrado")


def _guard(fn):
    try:
        return fn()
    except firebase.FirebaseNaoConfigurado as exc:
        raise HTTPException(503, str(exc))


def criar(uid: str, nome: str, dados: BaseModel) -> dict[str, Any]:
    def _op():
        ref = colecao(uid, nome).document()
        payload = dados.model_dump(mode="json")
        payload["criado_em"] = _agora()
        payload["atualizado_em"] = _agora()
        ref.set(payload)
        return {"id": ref.id, **payload}

    return _guard(_op)


def listar(uid: str, nome: str, filtros: list[tuple[str, str, Any]] | None = None) -> list[dict[str, Any]]:
    def _op():
        q = colecao(uid, nome)
        for campo, op, valor in filtros or []:
            q = q.where(campo, op, valor)
        return [{"id": d.id, **d.to_dict()} for d in q.stream()]

    return _guard(_op)


def obter(uid: str, nome: str, doc_id: str) -> dict[str, Any]:
    def _op():
        snap = colecao(uid, nome).document(doc_id).get()
        if not snap.exists:
            raise _nao_encontrado(nome)
        return {"id": snap.id, **snap.to_dict()}

    return _guard(_op)


def atualizar(uid: str, nome: str, doc_id: str, dados: BaseModel) -> dict[str, Any]:
    def _op():
        ref = colecao(uid, nome).document(doc_id)
        if not ref.get().exists:
            raise _nao_encontrado(nome)
        patch = dados.model_dump(mode="json", exclude_unset=True)
        patch["atualizado_em"] = _agora()
        ref.update(patch)
        snap = ref.get()
        return {"id": snap.id, **snap.to_dict()}

    return _guard(_op)


def remover(uid: str, nome: str, doc_id: str) -> None:
    def _op():
        ref = colecao(uid, nome).document(doc_id)
        if not ref.get().exists:
            raise _nao_encontrado(nome)
        ref.delete()

    _guard(_op)


def remover_por_medicamento(uid: str, med_id: str) -> None:
    def _op():
        for nome in ("doses", "orientacoes"):
            for snap in colecao(uid, nome).where("medicamento_id", "==", med_id).stream():
                snap.reference.delete()

    _guard(_op)


def set_perfil(uid: str, dados: BaseModel, parcial: bool) -> dict[str, Any]:
    def _op():
        ref = _user_doc(uid)
        if parcial and not ref.get().exists:
            raise HTTPException(404, "perfil nao encontrado; crie antes com PUT /perfil")
        patch = dados.model_dump(mode="json", exclude_unset=parcial)
        patch["atualizado_em"] = _agora()
        ref.set(patch, merge=True)
        return {"uid": uid, **ref.get().to_dict()}

    return _guard(_op)


def get_perfil(uid: str) -> dict[str, Any]:
    def _op():
        snap = _user_doc(uid).get()
        if not snap.exists:
            raise HTTPException(404, "perfil nao encontrado")
        return {"uid": uid, **snap.to_dict()}

    return _guard(_op)
