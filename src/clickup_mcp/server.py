"""ClickUp MCP server implementation for Smithery.

This server exposes a generic tool that can reach any ClickUp REST API endpoint
and helper utilities for browsing the public documentation.  The goal is to
allow Smithery-powered clients to cover the entire ClickUp API surface while
keeping configuration and authentication centralized in session config.
"""

from __future__ import annotations

import base64
import binascii
import json
from dataclasses import asdict, dataclass
from enum import Enum
import re
from typing import Annotated, Any, Dict, Iterable, Optional

import httpx
from bs4 import BeautifulSoup
from mcp.server.fastmcp import Context, FastMCP
from pydantic import AnyHttpUrl, BaseModel, Field, SecretStr

from smithery.decorators import smithery

from .openapi_loader import (
    OpenAPILoadError,
    OperationMetadata,
    iter_operations,
    load_openapi_spec,
)


class HttpMethod(str, Enum):
    """Supported HTTP methods for the ClickUp API."""

    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


class ClickUpConfig(BaseModel):
    """Session configuration supplied by Smithery users."""

    api_token: SecretStr = Field(
        ..., description="ClickUp personal token or OAuth token used for Bearer authentication."
    )
    base_url: AnyHttpUrl = Field(
        "https://api.clickup.com/api/v2",
        description="Root URL for the ClickUp REST API. Change this for sandbox or future versions.",
    )
    default_team_id: Optional[int] = Field(
        None,
        description="Optional team identifier that will be merged into the request query parameters when missing.",
    )
    request_timeout: float = Field(
        30.0,
        ge=1.0,
        description="Timeout (in seconds) used for outbound requests to ClickUp.",
    )
    default_headers: Dict[str, str] = Field(
        default_factory=dict,
        description="Additional headers to include with every ClickUp API call (e.g. enterprise headers).",
    )


class MultipartFile(BaseModel):
    """Representation of a multipart form file payload."""

    field_name: str = Field(..., description="Form field name for the uploaded file.")
    filename: str = Field(..., description="File name that ClickUp should store.")
    content_base64: str = Field(..., description="Base64 encoded file contents.")
    content_type: Optional[str] = Field(
        None,
        description="Content type for the file. Defaults to application/octet-stream when omitted.",
    )

    def to_httpx_tuple(self) -> tuple[str, tuple[str, bytes, Optional[str]]]:
        try:
            raw = base64.b64decode(self.content_base64)
        except (ValueError, binascii.Error) as exc:
            raise ValueError("Failed to decode base64 file payload") from exc
        return (
            self.field_name,
            (
                self.filename,
                raw,
                self.content_type or "application/octet-stream",
            ),
        )


@dataclass
class ClickUpResponse:
    """Standardized representation of a ClickUp API response."""

    status_code: int
    headers: Dict[str, str]
    data: Any

    def to_jsonable(self) -> Dict[str, Any]:
        return asdict(self)


class ClickUpAPIClient:
    """Thin wrapper around httpx for making authenticated ClickUp requests."""

    def __init__(self, config: ClickUpConfig) -> None:
        self._config = config
        base_url = str(config.base_url).rstrip("/")
        self._client = httpx.Client(base_url=base_url, timeout=config.request_timeout)

    def _build_headers(self, extra_headers: Optional[Dict[str, str]] = None, *, has_body: bool = False) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Authorization": f"Bearer {self._config.api_token.get_secret_value()}",
            "Accept": "application/json",
        }
        headers.update(self._config.default_headers)
        if extra_headers:
            headers.update(extra_headers)
        # Let multipart/form-data be set automatically by httpx when files are provided
        if has_body and "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
        return headers

    def _resolve_path(self, path: str, path_params: Optional[Dict[str, Any]]) -> str:
        resolved = path
        if not resolved.startswith("/"):
            resolved = "/" + resolved
        if path_params:
            for key, value in path_params.items():
                placeholder = "{" + key + "}"
                if placeholder in resolved:
                    resolved = resolved.replace(placeholder, str(value))
        return resolved

    def request(
        self,
        method: HttpMethod,
        path: str,
        *,
        path_params: Optional[Dict[str, Any]] = None,
        query_params: Optional[Dict[str, Any]] = None,
        json_body: Any = None,
        form_body: Optional[Dict[str, Any]] = None,
        files: Optional[Iterable[MultipartFile]] = None,
        headers: Optional[Dict[str, str]] = None,
        include_team_id: bool = False,
    ) -> ClickUpResponse:
        if json_body is not None and form_body is not None:
            raise ValueError("Provide either json_body or form_body, not both.")

        resolved_path = self._resolve_path(path, path_params)
        params = dict(query_params or {})
        if include_team_id and "team_id" not in params and self._config.default_team_id is not None:
            params["team_id"] = self._config.default_team_id

        prepared_files = None
        if files:
            prepared_files = [file.to_httpx_tuple() for file in files]

        has_body = json_body is not None or form_body is not None or prepared_files is not None
        request_headers = self._build_headers(headers, has_body=has_body)
        if prepared_files is not None:
            request_headers.pop("Content-Type", None)

        response = self._client.request(
            method.value,
            resolved_path,
            params=params,
            json=json_body if json_body is not None else None,
            data=form_body if form_body is not None else None,
            files=prepared_files,
            headers=request_headers,
        )

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                payload = response.json()
            except json.JSONDecodeError:
                payload = response.text
        else:
            payload = response.text

        return ClickUpResponse(
            status_code=response.status_code,
            headers=dict(response.headers),
            data=payload,
        )


def _get_or_create_client(ctx: Context) -> ClickUpAPIClient:
    """Cache an API client per MCP session."""

    if ctx.session_data is None:
        ctx.session_data = {}

    client = ctx.session_data.get("clickup_client") if isinstance(ctx.session_data, dict) else None
    if isinstance(client, ClickUpAPIClient):
        return client

    config = ctx.session_config
    if not isinstance(config, ClickUpConfig):
        config = ClickUpConfig.model_validate(config)

    client = ClickUpAPIClient(config)
    ctx.session_data["clickup_client"] = client
    return client


def _scrape_clickup_docs(path: str) -> Dict[str, Any]:
    """Fetch and parse a ClickUp API documentation page."""

    normalized_path = path if path.startswith("/api") else f"/api{path if path.startswith('/') else '/' + path}"
    url = f"https://clickup.com{normalized_path}"
    with httpx.Client(headers={"User-Agent": "Mozilla/5.0"}) as client:
        response = client.get(url, timeout=30.0)
        response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    title_tag = soup.find("title")
    title = title_tag.text.strip() if title_tag else "ClickUp API Documentation"
    main = soup.find("main") or soup
    # Extract visible text with simple formatting
    paragraphs = [
        " ".join(segment.strip() for segment in p.stripped_strings)
        for p in main.find_all(["h1", "h2", "h3", "h4", "p", "li", "code"])
    ]
    cleaned = "\n".join(part for part in paragraphs if part)
    return {
        "url": url,
        "title": title,
        "text": cleaned,
    }


@smithery.server(config_schema=ClickUpConfig)
def create_server() -> FastMCP:
    """Create and configure the ClickUp MCP server."""

    server = FastMCP("ClickUp")

    @server.tool()
    def call_clickup_api(
        method: HttpMethod,
        path: Annotated[str, Field(description="Endpoint path relative to the ClickUp base URL (e.g. /team/{team_id}/task).")],
        ctx: Context,
        query_params: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Dictionary of query string parameters to append to the request.",
            ),
        ] = None,
        path_params: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Values that should replace templated parameters in the path (e.g. {task_id}).",
            ),
        ] = None,
        json_body: Annotated[
            Any,
            Field(
                default=None,
                description="JSON-serializable body payload. Leave empty for GET and DELETE requests.",
            ),
        ] = None,
        form_body: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Form-encoded body payload used by certain ClickUp endpoints.",
            ),
        ] = None,
        files: Annotated[
            Optional[list[MultipartFile]],
            Field(
                default=None,
                description="Optional files for multipart uploads. Provide when endpoints require attachments.",
            ),
        ] = None,
        headers: Annotated[
            Optional[Dict[str, str]],
            Field(
                default=None,
                description="Additional headers to merge into the request.",
            ),
        ] = None,
        include_team_id: Annotated[
            bool,
            Field(
                default=False,
                description="Automatically inject the configured default_team_id as the team_id query parameter when true.",
            ),
        ] = False,
    ) -> Dict[str, Any]:
        """Execute an arbitrary ClickUp API request."""

        client = _get_or_create_client(ctx)
        response = client.request(
            method=method,
            path=path,
            path_params=path_params,
            query_params=query_params,
            json_body=json_body,
            form_body=form_body,
            files=files,
            headers=headers,
            include_team_id=include_team_id,
        )
        return response.to_jsonable()

    @server.tool()
    def list_clickup_reference_links(ctx: Context) -> Dict[str, Any]:
        """Return structured navigation data from the ClickUp API reference."""

        # The Smithery runtime requires that tool parameters do not start with an
        # underscore.  The context isn't used directly here, but we still accept
        # it so the signature matches other tools.  Assigning it to ``_`` keeps
        # linters quiet without violating the runtime constraint.
        _ = ctx

        with httpx.Client(headers={"User-Agent": "Mozilla/5.0"}) as client:
            response = client.get("https://clickup.com/api", timeout=30.0)
            response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        links: Dict[str, str] = {}
        for anchor in soup.find_all("a"):
            href = anchor.get("href")
            text = (anchor.text or "").strip()
            if not href or not text:
                continue
            if not href.startswith("/api"):
                continue
            links[text] = f"https://clickup.com{href}"
        return {
            "links": links,
            "description": "Mapping of link text to ClickUp API documentation URLs scraped from the navigation menu.",
        }

    @server.tool()
    def fetch_clickup_reference_page(
        path: Annotated[str, Field(description="Path or slug relative to /api, e.g. '/api-reference/tasks/create-task'.")]
    ) -> Dict[str, Any]:
        """Fetch and sanitize a ClickUp API documentation page."""

        return _scrape_clickup_docs(path)

    @server.resource("clickup://guide/configuration")
    def configuration_guide() -> str:
        """Explain how to configure the server."""

        return (
            "Provide your ClickUp personal token or OAuth access token via the session configuration. "
            "Optionally include a default team ID, additional headers, or override the API base URL for future versions."
        )

    @server.prompt()
    def call_endpoint_prompt(endpoint: str, method: str) -> list[Dict[str, str]]:
        """Prompt template that guides LLMs when assembling ClickUp API calls."""

        return [
            {
                "role": "system",
                "content": (
                    "You are preparing to call the ClickUp API. "
                    "Review the documentation, gather required path parameters, query parameters, and body schema."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Call the endpoint {endpoint} using the HTTP method {method}. "
                    "Identify all required identifiers and payload fields before invoking the tool."
                ).format(endpoint=endpoint, method=method),
            },
        ]

    operations_by_id: Dict[str, OperationMetadata] = {}
    tool_name_lookup: Dict[str, str] = {}
    openapi_error: Optional[str] = None

    try:
        spec = load_openapi_spec()
    except OpenAPILoadError as exc:
        openapi_error = str(exc)
        spec = None

    if spec is not None:
        for metadata in iter_operations(spec):
            try:
                method_enum = HttpMethod(metadata.method)
            except ValueError:
                continue
            tool_name = _make_unique_tool_name(metadata.operation_id, tool_name_lookup)
            _register_operation_tool(server, metadata, method_enum, tool_name)
            operations_by_id[metadata.operation_id] = metadata
            tool_name_lookup[tool_name] = metadata.operation_id

    @server.tool()
    def list_clickup_operations(ctx: Context) -> Dict[str, Any]:
        """Enumerate the ClickUp OpenAPI operations available as tools."""

        _ = ctx

        if not operations_by_id:
            return {
                "operations": [],
                "error": openapi_error or "ClickUp OpenAPI specification is currently unavailable.",
            }

        payload = [
            {
                "operation_id": metadata.operation_id,
                "tool_name": tool_name,
                "method": metadata.method,
                "path": metadata.path,
                "summary": metadata.summary,
                "tags": list(metadata.tags),
            }
            for tool_name, operation_id in sorted(tool_name_lookup.items())
            if (metadata := operations_by_id.get(operation_id)) is not None
        ]
        return {"operations": payload}

    @server.tool()
    def describe_clickup_operation(
        operation_id: Annotated[str, Field(description="Operation identifier as defined in the ClickUp OpenAPI document.")]
    ) -> Dict[str, Any]:
        """Return detailed metadata for a ClickUp OpenAPI operation."""

        metadata = operations_by_id.get(operation_id)
        if metadata is None:
            return {"error": f"Unknown ClickUp operation: {operation_id}"}

        return {
            "operation_id": metadata.operation_id,
            "method": metadata.method,
            "path": metadata.path,
            "summary": metadata.summary,
            "description": metadata.description,
            "tags": list(metadata.tags),
            "parameters": list(metadata.parameters),
            "request_body": metadata.request_body,
        }

    @server.resource("clickup://openapi/status")
    def openapi_status() -> str:
        """Report whether the ClickUp OpenAPI specification was loaded successfully."""

        if operations_by_id:
            return (
                "ClickUp OpenAPI specification loaded successfully. "
                f"{len(operations_by_id)} operations available as tools."
            )
        return openapi_error or "ClickUp OpenAPI specification could not be downloaded."

    return server


def _make_unique_tool_name(operation_id: str, existing: Dict[str, str]) -> str:
    """Generate a unique and MCP-friendly tool name."""

    base = re.sub(r"[^a-zA-Z0-9_]+", "_", operation_id).strip("_") or "clickup_operation"
    if base[0].isdigit():
        base = f"op_{base}"

    candidate = base
    suffix = 1
    while candidate in existing:
        suffix += 1
        candidate = f"{base}_{suffix}"
    return candidate


def _register_operation_tool(
    server: FastMCP,
    metadata: OperationMetadata,
    method_enum: HttpMethod,
    tool_name: str,
) -> None:
    """Create a FastMCP tool for the provided ClickUp operation."""

    description = _build_operation_description(metadata)

    def _tool(
        ctx: Context,
        path_params: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Values for templated path segments (e.g. {'task_id': 'abc123'}).",
            ),
        ] = None,
        query_params: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Query string parameters supported by this operation.",
            ),
        ] = None,
        json_body: Annotated[
            Any,
            Field(
                default=None,
                description="JSON request payload when the endpoint expects a JSON body.",
            ),
        ] = None,
        form_body: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Form-encoded payload for endpoints that accept form data.",
            ),
        ] = None,
        files: Annotated[
            Optional[list[MultipartFile]],
            Field(
                default=None,
                description="Optional files for multipart uploads defined by the operation.",
            ),
        ] = None,
        headers: Annotated[
            Optional[Dict[str, str]],
            Field(
                default=None,
                description="Custom headers specific to this operation.",
            ),
        ] = None,
        include_team_id: Annotated[
            bool,
            Field(
                default=False,
                description="Automatically include the configured default team_id query parameter when true.",
            ),
        ] = False,
    ) -> Dict[str, Any]:
        client = _get_or_create_client(ctx)
        response = client.request(
            method=method_enum,
            path=metadata.path,
            path_params=path_params,
            query_params=query_params,
            json_body=json_body,
            form_body=form_body,
            files=files,
            headers=headers,
            include_team_id=include_team_id,
        )
        return response.to_jsonable()

    _tool.__name__ = f"tool_{tool_name}"
    _tool.__doc__ = description
    server.tool(name=tool_name)(_tool)


def _build_operation_description(metadata: OperationMetadata) -> str:
    """Generate a helpful docstring for a dynamic ClickUp tool."""

    lines = [
        f"Invoke the ClickUp API operation `{metadata.operation_id}`.",
        f"HTTP {metadata.method} {metadata.path}",
    ]
    if metadata.summary and metadata.summary not in lines[0]:
        lines.append(metadata.summary)
    if metadata.description and metadata.description != metadata.summary:
        lines.append(metadata.description)
    if metadata.tags:
        lines.append("Tags: " + ", ".join(metadata.tags))

    if metadata.parameters:
        lines.append("Parameters:")
        for parameter in metadata.parameters:
            name = parameter.get("name", "unknown")
            location = parameter.get("in", "?")
            required = "required" if parameter.get("required") else "optional"
            description = parameter.get("description", "")
            lines.append(f"- {name} ({location}, {required}) {description}")

    if metadata.request_body:
        content = metadata.request_body.get("content", {})
        media_types = ", ".join(content.keys()) if isinstance(content, dict) else "unknown"
        lines.append(f"Request body media types: {media_types}")

    lines.append(
        "Provide path_params, query_params, and body arguments matching the schema above."
    )
    return "\n".join(lines)
