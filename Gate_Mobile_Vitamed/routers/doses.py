from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query, status

import push
import store
from deps import uid_atual
from models import DoseCreate, DoseOut, DoseUpdate, StatusDose

router = APIRouter(prefix="/doses", tags=["doses"])
_COL = "doses"
_DESC_TOKEN = "token_push deste aparelho: ele nao recebe o proprio aviso de dose nao tomada (RF09)"


@router.post("", response_model=DoseOut, status_code=status.HTTP_201_CREATED)
def criar(
    dados: DoseCreate,
    tarefas: BackgroundTasks,
    uid: str = Depends(uid_atual),
    token_push: str | None = Header(None, alias="X-Token-Push", description=_DESC_TOKEN),
):
    store.obter(uid, "medicamentos", dados.medicamento_id)
    dose = store.criar(uid, _COL, dados)
    if dados.status == StatusDose.nao_tomada:
        tarefas.add_task(push.avisar_dose_nao_tomada, uid, dose, token_push)
    return dose


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
def registrar(
    dose_id: str,
    dados: DoseUpdate,
    tarefas: BackgroundTasks,
    uid: str = Depends(uid_atual),
    token_push: str | None = Header(None, alias="X-Token-Push", description=_DESC_TOKEN),
):
    virou_nao_tomada = False
    if dados.status == StatusDose.nao_tomada:
        anterior = store.obter(uid, _COL, dose_id)
        virou_nao_tomada = anterior.get("status") != StatusDose.nao_tomada.value
    dose = store.atualizar(uid, _COL, dose_id, dados)
    if virou_nao_tomada:
        tarefas.add_task(push.avisar_dose_nao_tomada, uid, dose, token_push)
    return dose


@router.delete("/{dose_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(dose_id: str, uid: str = Depends(uid_atual)):
    store.remover(uid, _COL, dose_id)
