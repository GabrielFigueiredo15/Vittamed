from __future__ import annotations

from fastapi import APIRouter, Depends

import store
from deps import uid_atual
from models import PerfilCreate, PerfilOut, PerfilUpdate

router = APIRouter(prefix="/perfil", tags=["perfil"])


@router.put("", response_model=PerfilOut, summary="Cria/substitui o perfil")
def salvar(dados: PerfilCreate, uid: str = Depends(uid_atual)):
    return store.set_perfil(uid, dados, parcial=False)


@router.get("", response_model=PerfilOut, summary="Lê o perfil")
def ler(uid: str = Depends(uid_atual)):
    return store.get_perfil(uid)


@router.patch("", response_model=PerfilOut, summary="Atualiza campos do perfil (exige PUT antes)")
def atualizar(dados: PerfilUpdate, uid: str = Depends(uid_atual)):
    return store.set_perfil(uid, dados, parcial=True)
