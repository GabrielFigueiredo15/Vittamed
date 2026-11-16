from __future__ import annotations

import io
import secrets
from datetime import datetime, timezone

from PIL import Image, ImageOps, UnidentifiedImageError

import firebase

TAMANHO_MAX = 5 * 1024 * 1024
_LIMITE_DOC = 900 * 1024
_COL = "fotos"


class FotoInvalida(ValueError):
    pass


def _col():
    return firebase.db().collection(_COL)


def _rgb(img: Image.Image) -> Image.Image:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        fundo = Image.new("RGB", img.size, (255, 255, 255))
        fundo.paste(img, mask=img.getchannel("A"))
        return fundo
    return img.convert("RGB")


def comprimir(conteudo: bytes) -> bytes:
    try:
        img = Image.open(io.BytesIO(conteudo), formats=["JPEG", "PNG", "WEBP"])
        img = ImageOps.exif_transpose(img)
        img = _rgb(img)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise FotoInvalida("envie uma imagem JPEG, PNG ou WEBP") from exc
    for lado in (1280, 960, 640):
        img.thumbnail((lado, lado))
        for qualidade in (80, 65, 50):
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=qualidade, optimize=True)
            if buf.tell() <= _LIMITE_DOC:
                return buf.getvalue()
    raise FotoInvalida("nao foi possivel reduzir a foto")


def _do_medicamento(uid: str, med_id: str):
    return _col().where("uid", "==", uid).where("medicamento_id", "==", med_id).stream()


def salvar(uid: str, med_id: str, conteudo: bytes) -> str:
    jpeg = comprimir(conteudo)
    token = secrets.token_hex(24)
    _col().document(token).set(
        {
            "uid": uid,
            "medicamento_id": med_id,
            "dados": jpeg,
            "tipo": "image/jpeg",
            "criado_em": datetime.now(timezone.utc),
        }
    )
    for snap in _do_medicamento(uid, med_id):
        if snap.id != token:
            snap.reference.delete()
    return token


def obter(token: str) -> tuple[bytes, str] | None:
    snap = _col().document(token).get()
    if not snap.exists:
        return None
    dados = snap.to_dict() or {}
    return dados["dados"], dados.get("tipo", "image/jpeg")


def apagar(uid: str, med_id: str) -> None:
    for snap in _do_medicamento(uid, med_id):
        snap.reference.delete()
