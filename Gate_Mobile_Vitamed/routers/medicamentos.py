from __future__ import annotations

from fastapi import APIRouter, Depends, status

import store
from deps import uid_atual
from models import MedicamentoCreate, MedicamentoOut, MedicamentoUpdate

router = APIRouter(prefix="/medicamentos", tags=["medicamentos"])
_COL = "medicamentos"


@router.post("", response_model=MedicamentoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: MedicamentoCreate, uid: str = Depends(uid_atual)):
    return store.criar(uid, _COL, dados)


@router.get("", response_model=list[MedicamentoOut])
def listar(uid: str = Depends(uid_atual)):
    return store.listar(uid, _COL)


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
