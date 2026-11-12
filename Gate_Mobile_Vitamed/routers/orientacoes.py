from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

import store
from deps import uid_atual
from models import OrientacaoCreate, OrientacaoOut, OrientacaoUpdate

router = APIRouter(prefix="/orientacoes", tags=["orientacoes"])
_COL = "orientacoes"


@router.post("", response_model=OrientacaoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: OrientacaoCreate, uid: str = Depends(uid_atual)):
    store.obter(uid, "medicamentos", dados.medicamento_id)
    return store.criar(uid, _COL, dados)


@router.get("", response_model=list[OrientacaoOut])
def listar(
    uid: str = Depends(uid_atual),
    medicamento_id: str | None = Query(None),
):
    filtros = [("medicamento_id", "==", medicamento_id)] if medicamento_id else None
    return store.listar(uid, _COL, filtros)


@router.get("/{orientacao_id}", response_model=OrientacaoOut)
def obter(orientacao_id: str, uid: str = Depends(uid_atual)):
    return store.obter(uid, _COL, orientacao_id)


@router.patch("/{orientacao_id}", response_model=OrientacaoOut)
def atualizar(orientacao_id: str, dados: OrientacaoUpdate, uid: str = Depends(uid_atual)):
    return store.atualizar(uid, _COL, orientacao_id, dados)


@router.delete("/{orientacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(orientacao_id: str, uid: str = Depends(uid_atual)):
    store.remover(uid, _COL, orientacao_id)
