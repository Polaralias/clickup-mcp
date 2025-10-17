"""Utilities for loading and working with the ClickUp OpenAPI specification.

The ClickUp developer hub exposes an OpenAPI document that describes every
public REST endpoint.  This module centralises the logic required to download
and cache that specification so the MCP server can dynamically expose a tool
per operation.

The loader is intentionally defensive: the ClickUp documentation site sits in
front of a CDN that occasionally rate limits or reshapes URLs.  We therefore
try several likely locations for the OpenAPI JSON and normalise the result in a
way that downstream code can rely upon.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, Optional

try:  # pragma: no cover - allows tests to run without optional dependency
    import httpx
except ModuleNotFoundError:  # pragma: no cover
    class _HttpxPlaceholder:
        class Client:  # type: ignore[override]
            def __init__(self, *args: object, **kwargs: object) -> None:
                raise ModuleNotFoundError(
                    "httpx is required to download ClickUp OpenAPI definitions. Install 'httpx' to enable this feature."
                )

    httpx = _HttpxPlaceholder()  # type: ignore


_SPEC_CACHE: Optional[Dict[str, Any]] = None
_SPEC_LOCK = threading.Lock()


class OpenAPILoadError(RuntimeError):
    """Raised when the ClickUp OpenAPI document cannot be retrieved."""


def _candidate_spec_urls() -> Iterable[str]:
    """Return URLs that have historically hosted the ClickUp OpenAPI spec."""

    # ReadMe (developer.clickup.com) uses branch specific routes.  The root
    # openapi.json is stable but we keep alternates for redundancy.
    return (
        "https://developer.clickup.com/openapi.json",
        "https://developer.clickup.com/api/openapi.json",
        "https://clickup.com/api/static/clickup-public-api.swagger.json",
    )


def load_openapi_spec(force_refresh: bool = False) -> Dict[str, Any]:
    """Download and cache the ClickUp OpenAPI specification."""

    global _SPEC_CACHE

    if not force_refresh and _SPEC_CACHE is not None:
        return _SPEC_CACHE

    with _SPEC_LOCK:
        if not force_refresh and _SPEC_CACHE is not None:
            return _SPEC_CACHE

        last_error: Optional[Exception] = None
        headers = {"User-Agent": "clickup-mcp/1.0 (+https://smithery.ai)"}
        for url in _candidate_spec_urls():
            try:
                with httpx.Client(headers=headers, timeout=30.0, follow_redirects=True) as client:
                    response = client.get(url)
                    response.raise_for_status()
                    payload = response.json()
                    if isinstance(payload, dict) and payload.get("paths"):
                        _SPEC_CACHE = payload
                        return payload
            except Exception as exc:  # pragma: no cover - network variability
                last_error = exc

        raise OpenAPILoadError(
            "Unable to download ClickUp OpenAPI specification from known URLs."
        ) from last_error


@dataclass
class OperationMetadata:
    """Minimal data extracted from a single OpenAPI operation."""

    operation_id: str
    method: str
    path: str
    summary: str
    description: str
    tags: tuple[str, ...]
    parameters: tuple[Dict[str, Any], ...]
    request_body: Optional[Dict[str, Any]]


def iter_operations(spec: Dict[str, Any]) -> Iterator[OperationMetadata]:
    """Iterate over operations defined in the specification."""

    paths = spec.get("paths", {})
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, operation in methods.items():
            if not isinstance(operation, dict):
                continue
            operation_id = operation.get("operationId")
            if not operation_id:
                operation_id = _generate_operation_id(method, path)
            summary = operation.get("summary") or operation.get("description") or path
            description = operation.get("description") or summary
            tags = tuple(tag for tag in operation.get("tags", []) if isinstance(tag, str))
            parameters = tuple(
                parameter
                for parameter in operation.get("parameters", [])
                if isinstance(parameter, dict)
            )
            request_body = operation.get("requestBody") if isinstance(operation.get("requestBody"), dict) else None
            yield OperationMetadata(
                operation_id=operation_id,
                method=str(method).upper(),
                path=path,
                summary=summary,
                description=description,
                tags=tags,
                parameters=parameters,
                request_body=request_body,
            )


def _generate_operation_id(method: str, path: str) -> str:
    """Fallback operation id when the specification omits one."""

    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", f"{method}_{path}").strip("_")
    return cleaned or "clickup_operation"

