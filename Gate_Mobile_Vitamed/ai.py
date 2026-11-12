from __future__ import annotations

import os
from typing import Any, AsyncIterator

import httpx

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODELO_PADRAO = "nvidia/nemotron-3.5-super-vl-120b-a12b"


class IAError(RuntimeError):
    pass


def api_key() -> str:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        raise IAError("NVIDIA_API_KEY nao configurada no ambiente")
    return key


def _payload(
    mensagens: list[dict[str, Any]],
    modelo: str,
    temperatura: float,
    max_tokens: int,
    stream: bool,
) -> dict[str, Any]:
    return {
        "messages": mensagens,
        "model": modelo,
        "temperature": temperatura,
        "max_tokens": max_tokens,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "stream": stream,
        "chat_template_kwargs": {"enable_thinking": False},
    }


async def chat(
    mensagens: list[dict[str, Any]],
    modelo: str = MODELO_PADRAO,
    temperatura: float = 1.0,
    max_tokens: int = 512,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {api_key()}", "Accept": "application/json"}
    payload = _payload(mensagens, modelo, temperatura, max_tokens, stream=False)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(NVIDIA_URL, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise IAError(f"falha de rede com a NVIDIA: {exc}") from exc
    if resp.status_code >= 400:
        raise IAError(f"NVIDIA {resp.status_code}: {resp.text[:300]}")
    return resp.json()


async def chat_stream(
    mensagens: list[dict[str, Any]],
    modelo: str = MODELO_PADRAO,
    temperatura: float = 1.0,
    max_tokens: int = 512,
) -> AsyncIterator[bytes]:
    headers = {"Authorization": f"Bearer {api_key()}", "Accept": "text/event-stream"}
    payload = _payload(mensagens, modelo, temperatura, max_tokens, stream=True)
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", NVIDIA_URL, headers=headers, json=payload
            ) as resp:
                if resp.status_code >= 400:
                    corpo = await resp.aread()
                    raise IAError(f"NVIDIA {resp.status_code}: {corpo[:300]!r}")
                async for linha in resp.aiter_lines():
                    if linha:
                        yield f"{linha}\n\n".encode()
    except httpx.HTTPError as exc:
        raise IAError(f"falha de rede com a NVIDIA: {exc}") from exc
