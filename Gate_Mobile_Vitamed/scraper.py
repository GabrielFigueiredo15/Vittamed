from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import quote

import httpx

BASE_URL = "https://consultaremedios.com.br"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    )
}
_FRSH_RE = re.compile(
    r'id="__FRSH_STATE_[^"]+"[^>]*>(.*?)</script>', re.DOTALL
)


class ConsultaRemediosError(RuntimeError):
    def __init__(self, mensagem: str, status: int = 502):
        super().__init__(mensagem)
        self.status = status


async def _fetch_state(client: httpx.AsyncClient, path: str) -> dict[str, Any]:
    try:
        resp = await client.get(path, headers=_HEADERS, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        codigo = exc.response.status_code
        raise ConsultaRemediosError(
            f"{codigo} em {path}", 404 if codigo == 404 else 502
        ) from exc
    except httpx.HTTPError as exc:
        raise ConsultaRemediosError(f"erro de rede em {path}: {exc}") from exc
    m = _FRSH_RE.search(resp.text)
    if not m:
        raise ConsultaRemediosError(f"estado nao encontrado em {path}")
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        raise ConsultaRemediosError(f"estado invalido em {path}: {exc}") from exc


def _nodes(state: dict[str, Any]) -> list[Any]:
    v = state.get("v")
    if isinstance(v, list) and v and isinstance(v[0], list):
        return v[0]
    return []


def _first_with_key(state: dict[str, Any], key: str) -> Any | None:
    for node in _nodes(state):
        if isinstance(node, dict) and key in node:
            return node[key]
    return None


def _normalizar(texto: str) -> str:
    nfkd = unicodedata.normalize("NFKD", texto.lower())
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", sem_acento).strip()


def score_fuzzy(termo: str, nome: str | None) -> float:
    if not nome:
        return 0.0
    t = _normalizar(termo)
    n = _normalizar(nome)
    if not t or not n:
        return 0.0
    if t in n:
        return 1.0
    full = SequenceMatcher(None, t, n).ratio()
    tokens_t = t.split()
    tokens_n = n.split()
    melhor_token = 0.0
    for tt in tokens_t:
        for tn in tokens_n:
            r = SequenceMatcher(None, tt, tn).ratio()
            if r > melhor_token:
                melhor_token = r
    return max(full, melhor_token)


def _base_slug(url: str | None) -> str | None:
    if not url:
        return None
    parts = [p for p in url.strip("/").split("/") if p]
    return parts[0] if parts else None


def _first_image(product: dict[str, Any]) -> str | None:
    img = product.get("image")
    if isinstance(img, list) and img:
        first = img[0]
        if isinstance(first, dict):
            return first.get("url") or first.get("imageUrl")
    return None


def _price(product: dict[str, Any]) -> tuple[float | None, float | None]:
    sellers = product.get("sellers") or []
    if sellers and isinstance(sellers[0], dict):
        offer = sellers[0].get("commertialOffer") or {}
        return offer.get("spotPrice"), offer.get("priceWithoutDiscount")
    return None, None


def _prescription(product: dict[str, Any]) -> str | None:
    pt = product.get("prescriptionType")
    if isinstance(pt, dict):
        return pt.get("prescriptionTypeName")
    return None


def _parse_product_card(product: dict[str, Any]) -> dict[str, Any]:
    url = product.get("url")
    slug = _base_slug(url)
    spot, cheio = _price(product)
    return {
        "nome": product.get("name"),
        "slug": slug,
        "url": f"{BASE_URL}{url}" if url else None,
        "imagem": _first_image(product),
        "preco": spot,
        "preco_sem_desconto": cheio,
        "receita": _prescription(product),
        "bula_url": f"{BASE_URL}/{slug}/bula" if slug else None,
    }


async def buscar(
    termo: str,
    limite: int = 20,
    fuzzy: bool = True,
    score_min: float = 0.35,
) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=20.0) as client:
        state = await _fetch_state(client, f"/b/{quote(termo, safe='')}")

    vistos: set[str] = set()
    itens: list[dict[str, Any]] = []
    for node in _nodes(state):
        if not (isinstance(node, dict) and isinstance(node.get("product"), dict)):
            continue
        product = node["product"]
        if not product.get("url"):
            continue
        card = _parse_product_card(product)
        chave = card["url"] or card["nome"] or ""
        if chave in vistos:
            continue
        vistos.add(chave)
        if fuzzy:
            card["score"] = round(score_fuzzy(termo, card["nome"]), 3)
        itens.append(card)

    if fuzzy:
        itens = [it for it in itens if it["score"] >= score_min]
        itens.sort(key=lambda it: it["score"], reverse=True)

    return itens[:limite]


def _parse_bula(state: dict[str, Any]) -> dict[str, Any]:
    cp = _first_with_key(state, "contentPage")
    if not isinstance(cp, dict):
        raise ConsultaRemediosError("bula nao encontrada", 404)

    secoes: list[dict[str, Any]] = []
    for attr in cp.get("productAttribute") or []:
        if not isinstance(attr, dict):
            continue
        meta = attr.get("attribute") or {}
        conteudo = attr.get("value")
        if not conteudo:
            av = attr.get("attributeValue") or {}
            conteudo = av.get("value") if isinstance(av, dict) else None
        if not conteudo:
            continue
        secoes.append(
            {
                "titulo": meta.get("title"),
                "anchor": meta.get("anchor"),
                "conteudo_html": conteudo,
            }
        )

    factory = cp.get("factory") or {}
    brand = cp.get("brand") or {}
    substance = cp.get("substance") or {}
    pt = cp.get("prescriptionType") or {}
    return {
        "slug": cp.get("slug"),
        "titulo": cp.get("title"),
        "imagem": cp.get("thumbnail"),
        "principio_ativo": substance.get("substanceName") if isinstance(substance, dict) else None,
        "laboratorio": factory.get("factoryName") if isinstance(factory, dict) else None,
        "marca": brand.get("brandName") if isinstance(brand, dict) else None,
        "tipo_receita": pt.get("prescriptionTypeName") if isinstance(pt, dict) else None,
        "bula_pdf": cp.get("leaflet"),
        "bula_pro_pdf": cp.get("leafletPro"),
        "secoes": secoes,
    }


async def bula(slug: str) -> dict[str, Any]:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=20.0) as client:
        state = await _fetch_state(client, f"/{quote(slug, safe='')}/bula")
    return _parse_bula(state)
