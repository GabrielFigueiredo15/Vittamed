from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx

import firebase

EXPO_URL = "https://exp.host/--/api/v2/push/send"
CANAL_FAMILIA = "familia"
_COL = "aparelhos"
_LOTE = 100
_FUSO = ZoneInfo("America/Sao_Paulo")

log = logging.getLogger("vittamed.push")


def _doc_id(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _col():
    return firebase.db().collection(_COL)


def registrar(uid: str, token: str, plataforma: str) -> dict[str, Any]:
    dados = {
        "uid": uid,
        "token_push": token,
        "plataforma": plataforma,
        "atualizado_em": datetime.now(timezone.utc),
    }
    _col().document(_doc_id(token)).set(dados)
    return dados


def remover(uid: str, token: str) -> bool:
    ref = _col().document(_doc_id(token))
    snap = ref.get()
    if not snap.exists or (snap.to_dict() or {}).get("uid") != uid:
        return False
    ref.delete()
    return True


def tokens_da_conta(uid: str, exceto: str | None = None) -> list[str]:
    tokens = []
    for snap in _col().where("uid", "==", uid).stream():
        token = (snap.to_dict() or {}).get("token_push")
        if token and token != exceto:
            tokens.append(token)
    return tokens


def enviar(tokens: list[str], titulo: str, corpo: str, dados: dict[str, Any]) -> None:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    chave = os.getenv("EXPO_ACCESS_TOKEN")
    if chave:
        headers["Authorization"] = f"Bearer {chave}"
    invalidos: list[str] = []
    with httpx.Client(timeout=20.0) as client:
        for i in range(0, len(tokens), _LOTE):
            lote = tokens[i : i + _LOTE]
            mensagens = [
                {
                    "to": token,
                    "title": titulo,
                    "body": corpo,
                    "data": dados,
                    "channelId": CANAL_FAMILIA,
                    "sound": "default",
                    "priority": "high",
                }
                for token in lote
            ]
            resp = client.post(EXPO_URL, json=mensagens, headers=headers)
            if resp.status_code >= 400:
                log.warning("Expo push %s: %s", resp.status_code, resp.text[:300])
                continue
            for token, ticket in zip(lote, resp.json().get("data") or []):
                if ticket.get("status") != "error":
                    continue
                if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                    invalidos.append(token)
                else:
                    log.warning("Expo recusou push: %s", ticket.get("message"))
    for token in invalidos:
        _col().document(_doc_id(token)).delete()


def _hora_local(valor: Any) -> str:
    try:
        dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_FUSO).strftime("%H:%M")


def _mensagem(uid: str, dose: dict[str, Any]) -> tuple[str, str]:
    usuario = firebase.db().collection("users").document(uid)
    perfil = usuario.get().to_dict() or {}
    med = usuario.collection("medicamentos").document(dose["medicamento_id"]).get().to_dict() or {}
    remedio = " ".join(p for p in (med.get("nome"), med.get("dosagem")) if p) or "o remédio"
    hora = _hora_local(dose.get("horario_previsto"))
    quando = f" das {hora}" if hora else ""
    pessoa = (perfil.get("nome") or "").split(" ")[0]
    if pessoa:
        return "Dose não tomada", f"{pessoa} não tomou {remedio}{quando}."
    return "Dose não tomada", f"A dose de {remedio}{quando} não foi tomada."


def avisar_dose_nao_tomada(uid: str, dose: dict[str, Any], exceto: str | None = None) -> None:
    try:
        tokens = tokens_da_conta(uid, exceto)
        if not tokens:
            return
        titulo, corpo = _mensagem(uid, dose)
        dados = {
            "tipo": "aviso_familia",
            "medicamentoId": dose["medicamento_id"],
            "horarioPrevisto": dose.get("horario_previsto"),
            "doseId": dose.get("id"),
        }
        enviar(tokens, titulo, corpo, dados)
    except Exception:
        log.exception("falha ao avisar a familia (uid=%s)", uid)
