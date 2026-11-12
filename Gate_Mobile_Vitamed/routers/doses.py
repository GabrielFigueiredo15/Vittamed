from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

import store
from deps import uid_atual
from models import DoseCreate, DoseOut, DoseUpdate, StatusDose

router = APIRouter(prefix="/doses", tags=["doses"])
_COL = "doses"


@router.post("", response_model=DoseOut, status_code=status.HTTP_201_CREATED)
def criar(dados: DoseCreate, uid: str = Depends(uid_atual)):
    store.obter(uid, "medicamentos", dados.medicamento_id)
    return store.criar(uid, _COL, dados)


@router.get("", response_model=list[DoseOut], summary="Histórico/lista de doses")
def listar(
    uid: str = Depends(uid_atual),
    medicamento_id: str | None = Query(None),
    status_dose: StatusDose | None = Query(None, alias="status"),
):
    filtros = []
    if medicamento_id:
        filtros.append(("medicamento_id", "==", medicamento_id))
    if status_dose:
        filtros.append(("status", "==", status_dose.value))
    return store.listar(uid, _COL, filtros or None)


@router.get("/{dose_id}", response_model=DoseOut)
def obter(dose_id: str, uid: str = Depends(uid_atual)):
    return store.obter(uid, _COL, dose_id)


@router.patch("/{dose_id}", response_model=DoseOut, summary="Registra a dose (RF08)")
def registrar(dose_id: str, dados: DoseUpdate, uid: str = Depends(uid_atual)):
    return store.atualizar(uid, _COL, dose_id, dados)


@router.delete("/{dose_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(dose_id: str, uid: str = Depends(uid_atual)):
    store.remover(uid, _COL, dose_id)
