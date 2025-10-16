"""ClickUp MCP server with dedicated tool implementations.

This module exposes a curated set of tools that line up with the
functionality described in the ClickUp MCP specification.  The previous
revision of the project dynamically exposed every OpenAPI operation as a
tool which made discoverability difficult and produced overly generic
interfaces.  In this revision each high level capability is implemented
explicitly with strong parameter schemas, natural language niceties, and
high level helper routines for common lookups.
"""

from __future__ import annotations

import base64
import binascii
import json
import mimetypes
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Annotated, Any, Dict, Iterable, Literal, Mapping, Optional, Sequence
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import httpx
from bs4 import BeautifulSoup
from dateparser import parse as parse_date
from mcp.server.fastmcp import Context, FastMCP
from mcp.types import ToolAnnotations
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, SecretStr, ValidationError, field_validator

from smithery.decorators import smithery


READ_ONLY_TOOL = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)

NON_DESTRUCTIVE_WRITE_TOOL = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=True,
)

IDEMPOTENT_WRITE_TOOL = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)

DESTRUCTIVE_WRITE_TOOL = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=True,
)


class HttpMethod(str):
    """Supported HTTP methods for the ClickUp API."""

    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


class ClickUpConfig(BaseModel):
    """Session configuration supplied by Smithery users."""

    api_token: Optional[SecretStr] = Field(
        None,
        description="ClickUp personal token or OAuth token used for Bearer authentication.",
    )
    auth_scheme: Literal["auto", "personal_token", "oauth"] = Field(
        "auto",
        description=(
            "Authentication scheme for the Authorization header. "
            "Use 'personal_token' for legacy API keys, 'oauth' for OAuth access tokens,"
            " or leave as 'auto' to detect based on the token format."
        ),
    )
    base_url: AnyHttpUrl = Field(
        "https://api.clickup.com/api/v2",
        description="Root URL for the ClickUp REST API. Change this for sandbox or future versions.",
    )
    default_team_id: Optional[int] = Field(
        None,
        description=(
            "Optional team identifier that is used when a tool does not explicitly include a team identifier."
        ),
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

    @field_validator("base_url", mode="before")
    @classmethod
    def _normalise_base_url(cls, value: Any) -> Any:
        """Coerce common ClickUp hostnames into the documented API endpoint."""

        if not isinstance(value, str):
            return value

        raw = value.strip()
        if not raw:
            return raw

        parsed = urlparse(raw)
        if not parsed.scheme or not parsed.netloc:
            return raw

        hostname = parsed.hostname or ""
        netloc = parsed.netloc
        port = parsed.port

        new_host = hostname
        if hostname == "clickup.com":
            new_host = "api.clickup.com"
        elif hostname.startswith("app.") and hostname.endswith(".clickup.com"):
            new_host = "api." + hostname[len("app.") :]

        if new_host != hostname:
            netloc = f"{new_host}:{port}" if port else new_host

        path = parsed.path or ""
        if not path or path == "/":
            path = "/api/v2"
        elif path.rstrip("/") == "/api":
            path = "/api/v2"
        else:
            path = path.rstrip("/")

        normalised = urlunparse((parsed.scheme, netloc, path, "", "", ""))
        return normalised


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
        except (ValueError, binascii.Error) as exc:  # pragma: no cover - defensive decoding
            raise ValueError("Failed to decode base64 file payload") from exc
        return (
            self.field_name,
            (
                self.filename,
                raw,
                self.content_type or "application/octet-stream",
            ),
        )


class ViewFilterCondition(BaseModel):
    """Single field filter used when configuring ClickUp views."""

    model_config = ConfigDict(extra="allow")

    field: str = Field(
        ..., description="Field identifier such as status, tag, dueDate, or cf_ custom field keys."
    )
    op: str = Field(
        ...,
        description=(
            "Filter operator (e.g. EQ, ANY, NOT, GT, IS SET). Refer to ClickUp view filtering documentation for supported values."
        ),
    )
    values: list[Any] = Field(
        default_factory=list,
        description="Collection of values applied to the filter. Accepts primitives or objects for dynamic date operators.",
    )


class ViewFilters(BaseModel):
    """Top level filter definition passed to the ClickUp view APIs."""

    model_config = ConfigDict(extra="allow")

    op: Literal["AND", "OR"] = Field(
        "AND", description="Logical operator used to combine filters at the top level."
    )
    fields: list[ViewFilterCondition] = Field(
        default_factory=list,
        description="Individual field filters applied to the view.",
    )
    search: str = Field(
        "",
        description="Optional keyword search applied after other filters. Provide an empty string to disable.",
    )
    show_closed: bool = Field(
        False,
        description="When false closed tasks are hidden. This flag is always combined using AND.",
    )
    groups: Optional[list[list[int]]] = Field(
        default=None,
        description="Optional filter group definitions referencing indices from the fields collection.",
    )
    filter_group_ops: Optional[list[str]] = Field(
        default=None,
        description="Logical operators applied between filter groups (e.g. ['OR','AND']).",
    )


class ViewGrouping(BaseModel):
    """Grouping configuration controlling column swimlanes for the view."""

    model_config = ConfigDict(extra="allow")

    field: Literal["none", "status", "priority", "assignee", "tag", "dueDate"] = Field(
        "none", description="Field used to group tasks within the view."
    )
    dir: Literal[1, -1] = Field(
        1,
        description="Group sort order. Use 1 for ascending and -1 for descending (e.g. urgent to low).",
    )
    collapsed: list[str] = Field(
        default_factory=list,
        description="Identifiers of groups that should start collapsed.",
    )
    ignore: bool = Field(
        False,
        description="When true the grouping preference is ignored and tasks render in a single column.",
    )


class ViewDivide(BaseModel):
    """Secondary grouping row used by board style views."""

    model_config = ConfigDict(extra="allow")

    field: Optional[str] = Field(
        default=None,
        description="Optional field to divide columns by (set to null/None to disable).",
    )
    dir: Optional[int] = Field(
        default=None,
        description="Sort direction applied to the divide field when configured.",
    )
    collapsed: bool = Field(
        True,
        description="Whether divide rows are initially collapsed.",
    )


class ViewSorting(BaseModel):
    """Sorting configuration for ClickUp views."""

    model_config = ConfigDict(extra="allow")

    fields: list[str | dict[str, Any]] = Field(
        default_factory=list,
        description="Sequence of field identifiers or sort objects controlling task order.",
    )


class ViewColumns(BaseModel):
    """Column visibility configuration for ClickUp views."""

    model_config = ConfigDict(extra="allow")

    fields: list[str | dict[str, Any]] = Field(
        default_factory=list,
        description="Fields (including custom fields) displayed as columns. Use cf_ prefixes for custom fields.",
    )


class ViewTeamSidebar(BaseModel):
    """Sidebar configuration controlling assignee visibility."""

    model_config = ConfigDict(extra="allow")

    assignees: list[str] = Field(
        default_factory=list,
        description="Collection of user identifiers displayed in the sidebar. Use 'me' for Me mode.",
    )
    assigned_comments: bool = Field(
        True,
        description="When true comments assigned to the user are highlighted in the sidebar.",
    )
    unassigned_tasks: bool = Field(
        True,
        description="Whether unassigned tasks are surfaced in the sidebar filters.",
    )


class ViewSettings(BaseModel):
    """General view settings mirrored from the ClickUp UI."""

    model_config = ConfigDict(extra="allow")

    show_task_locations: bool = Field(
        True, description="Display breadcrumbs that show where each task lives in the hierarchy."
    )
    show_subtasks: Literal[1, 2, 3] = Field(
        1,
        description="Controls subtask presentation: 1 separate, 2 expanded, 3 collapsed.",
    )
    show_subtask_parent_names: bool = Field(
        True, description="Display parent task names alongside subtasks."
    )
    show_closed_subtasks: bool = Field(
        True, description="Include closed subtasks in the view when subtasks are visible."
    )
    show_assignees: bool = Field(
        True, description="Show assignee avatars in the task rows."
    )
    show_images: bool = Field(
        True, description="Display image thumbnails within the view when available."
    )
    collapse_empty_columns: Optional[str] = Field(
        default=None,
        description="Optionally collapse columns without tasks. Pass a string policy or null to disable.",
    )
    me_comments: bool = Field(
        True, description="Enable the 'Assigned to me' comment shortcut within the view."
    )
    me_subtasks: bool = Field(
        True, description="Enable the 'Assigned to me' subtask shortcut within the view."
    )
    me_checklists: bool = Field(
        True, description="Enable the 'Assigned to me' checklist shortcut within the view."
    )

@dataclass
class ClickUpResponse:
    """Standardized representation of a ClickUp API response."""

    status_code: int
    headers: Dict[str, str]
    data: Any

    def to_jsonable(self) -> Dict[str, Any]:
        return asdict(self)


class ClickUpAPIError(RuntimeError):
    """Raised when a ClickUp API request fails."""

    def __init__(self, message: str, response: ClickUpResponse) -> None:
        super().__init__(message)
        self.response = response


class ClickUpAPIClient:
    """Thin wrapper around httpx for making authenticated ClickUp requests."""

    def __init__(self, config: ClickUpConfig) -> None:
        self._config = config
        base_url = str(config.base_url).rstrip("/")
        self._client = httpx.Client(base_url=base_url, timeout=config.request_timeout)
        self._hierarchy_cache: Dict[int, Dict[str, Any]] = {}
        self._member_cache: Dict[int, list[Dict[str, Any]]] = {}

    def _resolve_token(self) -> str:
        token = self._config.api_token.get_secret_value() if self._config.api_token else ""
        if not token:
            raise ValueError(
                "A ClickUp API token must be configured before making ClickUp API requests."
            )
        return token

    def _resolve_auth_scheme(self, token: str) -> Literal["personal_token", "oauth"]:
        scheme = self._config.auth_scheme
        if scheme == "auto":
            lowered = token.lower()
            if lowered.startswith("pk_") or lowered.startswith("sk_"):
                scheme = "personal_token"
            else:
                scheme = "oauth"
        return scheme

    def uses_oauth_authentication(self) -> bool:
        token = self._resolve_token()
        return self._resolve_auth_scheme(token) == "oauth"

    def _build_headers(
        self,
        extra_headers: Optional[Dict[str, str]] = None,
        *,
        has_body: bool = False,
        token: Optional[str] = None,
        auth_scheme: Optional[Literal["personal_token", "oauth"]] = None,
    ) -> Dict[str, str]:
        resolved_token = token or self._resolve_token()
        resolved_scheme = auth_scheme or self._resolve_auth_scheme(resolved_token)

        if resolved_scheme == "oauth":
            authorization_value = f"Bearer {resolved_token}"
        else:
            authorization_value = resolved_token

        headers: Dict[str, str] = {
            "Authorization": authorization_value,
            "Accept": "application/json",
        }
        headers.update(self._config.default_headers)
        if extra_headers:
            headers.update(extra_headers)
        if has_body and "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
        return headers

    def _resolve_path(self, path: str) -> str:
        if not path.startswith("/"):
            return "/" + path
        return path

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
        team_id: Optional[int] = None,
    ) -> ClickUpResponse:
        if json_body is not None and form_body is not None:
            raise ValueError("Provide either json_body or form_body, not both.")

        resolved_path = self._resolve_path(path)
        if path_params:
            for key, value in path_params.items():
                placeholder = "{" + key + "}"
                resolved_path = resolved_path.replace(placeholder, str(value))

        prepared_files = None
        if files:
            prepared_files = [file.to_httpx_tuple() for file in files]

        token = self._resolve_token()
        auth_scheme = self._resolve_auth_scheme(token)

        resolved_query_params: Dict[str, Any] = dict(query_params) if query_params else {}
        if auth_scheme == "oauth":
            resolved_team_id = team_id if team_id is not None else self._config.default_team_id
            if resolved_team_id is not None and "team_id" not in resolved_query_params:
                resolved_query_params["team_id"] = str(int(resolved_team_id))

        has_body = json_body is not None or form_body is not None or prepared_files is not None
        request_headers = self._build_headers(
            headers,
            has_body=has_body,
            token=token,
            auth_scheme=auth_scheme,
        )
        if prepared_files is not None:
            request_headers.pop("Content-Type", None)

        response = self._client.request(
            method,
            resolved_path,
            params=resolved_query_params or None,
            json=json_body if json_body is not None else None,
            data=form_body if form_body is not None else None,
            files=prepared_files,
            headers=request_headers,
        )

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                payload = response.json()
            except json.JSONDecodeError:  # pragma: no cover - defensive
                payload = response.text
        else:
            payload = response.text

        return ClickUpResponse(
            status_code=response.status_code,
            headers=dict(response.headers),
            data=payload,
        )
    def request_checked(self, *args: Any, **kwargs: Any) -> ClickUpResponse:
        response = self.request(*args, **kwargs)
        if response.status_code >= 400:
            details = response.data if isinstance(response.data, (dict, list)) else {"error": response.data}
            raise ClickUpAPIError(
                f"ClickUp API request failed with status {response.status_code}: {details}",
                response,
            )
        return response

    # ------------------------------------------------------------------
    # Resolution helpers
    # ------------------------------------------------------------------
    def ensure_team_id(self, team_id: Optional[int]) -> int:
        if team_id is not None:
            return int(team_id)
        if self._config.default_team_id is not None:
            return int(self._config.default_team_id)
        raise ValueError("A team_id is required either via tool parameter or session configuration.")

    def get_workspace_hierarchy(self, team_id: Optional[int], *, force_refresh: bool = False) -> Dict[str, Any]:
        resolved_team_id = self.ensure_team_id(team_id)
        if not force_refresh and resolved_team_id in self._hierarchy_cache:
            return self._hierarchy_cache[resolved_team_id]

        spaces_resp = self.request_checked(
            HttpMethod.GET,
            f"/team/{resolved_team_id}/space",
            query_params={"archived": "false"},
            team_id=resolved_team_id,
        )
        spaces_payload = spaces_resp.data if isinstance(spaces_resp.data, dict) else {}
        spaces = spaces_payload.get("spaces", []) if isinstance(spaces_payload.get("spaces"), list) else []
        hierarchy_spaces: list[Dict[str, Any]] = []

        for space in spaces:
            space_id = space.get("id")
            if not space_id:
                continue
            space_entry: Dict[str, Any] = {
                "id": space_id,
                "name": space.get("name"),
                "color": space.get("color"),
                "folders": [],
                "lists": [],
            }

            # Lists at root of space
            space_lists_resp = self.request_checked(
                HttpMethod.GET,
                f"/space/{space_id}/list",
                query_params={"archived": "false"},
                team_id=resolved_team_id,
            )
            space_lists_payload = space_lists_resp.data if isinstance(space_lists_resp.data, dict) else {}
            space_entry["lists"] = space_lists_payload.get("lists", []) if isinstance(space_lists_payload.get("lists"), list) else []

            # Folders and their lists
            folder_resp = self.request_checked(
                HttpMethod.GET,
                f"/space/{space_id}/folder",
                query_params={"archived": "false"},
                team_id=resolved_team_id,
            )
            folder_payload = folder_resp.data if isinstance(folder_resp.data, dict) else {}
            folders = folder_payload.get("folders", []) if isinstance(folder_payload.get("folders"), list) else []
            folder_entries: list[Dict[str, Any]] = []
            for folder in folders:
                folder_id = folder.get("id")
                if not folder_id:
                    continue
                folder_entry: Dict[str, Any] = {
                    "id": folder_id,
                    "name": folder.get("name"),
                    "lists": [],
                }
                folder_lists_resp = self.request_checked(
                    HttpMethod.GET,
                    f"/folder/{folder_id}/list",
                    query_params={"archived": "false"},
                    team_id=resolved_team_id,
                )
                folder_lists_payload = (
                    folder_lists_resp.data if isinstance(folder_lists_resp.data, dict) else {}
                )
                folder_entry["lists"] = (
                    folder_lists_payload.get("lists", [])
                    if isinstance(folder_lists_payload.get("lists"), list)
                    else []
                )
                folder_entries.append(folder_entry)
            space_entry["folders"] = folder_entries
            hierarchy_spaces.append(space_entry)

        payload = {"team_id": resolved_team_id, "spaces": hierarchy_spaces}
        self._hierarchy_cache[resolved_team_id] = payload
        return payload

    def resolve_space_id(
        self,
        *,
        team_id: Optional[int],
        space_id: Optional[str] = None,
        space_name: Optional[str] = None,
    ) -> str:
        if space_id:
            return str(space_id)
        if not space_name:
            raise ValueError("Either spaceId or spaceName must be supplied.")
        hierarchy = self.get_workspace_hierarchy(team_id, force_refresh=False)
        for space in hierarchy.get("spaces", []):
            if str(space.get("name", "")).strip().lower() == space_name.strip().lower():
                return str(space["id"])
        raise ValueError(f"Unable to locate space named '{space_name}'.")

    def resolve_folder_id(
        self,
        *,
        team_id: Optional[int],
        space_id: Optional[str] = None,
        space_name: Optional[str] = None,
        folder_id: Optional[str] = None,
        folder_name: Optional[str] = None,
    ) -> str:
        if folder_id:
            return str(folder_id)
        if not folder_name:
            raise ValueError("Either folderId or folderName must be supplied.")
        hierarchy = self.get_workspace_hierarchy(team_id, force_refresh=False)
        normalized_space = space_name.strip().lower() if space_name else None
        for space in hierarchy.get("spaces", []):
            if normalized_space and str(space.get("name", "")).strip().lower() != normalized_space:
                continue
            for folder in space.get("folders", []):
                if str(folder.get("name", "")).strip().lower() == folder_name.strip().lower():
                    return str(folder["id"])
        raise ValueError(f"Unable to locate folder named '{folder_name}'.")

    def resolve_list_id(
        self,
        *,
        team_id: Optional[int],
        list_id: Optional[str] = None,
        list_name: Optional[str] = None,
    ) -> str:
        if list_id:
            return str(list_id)
        if not list_name:
            raise ValueError("Either listId or listName must be supplied.")
        hierarchy = self.get_workspace_hierarchy(team_id, force_refresh=False)
        normalized = list_name.strip().lower()
        for space in hierarchy.get("spaces", []):
            for lst in space.get("lists", []):
                if str(lst.get("name", "")).strip().lower() == normalized:
                    return str(lst["id"])
            for folder in space.get("folders", []):
                for lst in folder.get("lists", []):
                    if str(lst.get("name", "")).strip().lower() == normalized:
                        return str(lst["id"])
        raise ValueError(f"Unable to locate list named '{list_name}'.")

    def resolve_task_id(
        self,
        *,
        team_id: Optional[int],
        task_id: Optional[str] = None,
        task_name: Optional[str] = None,
        list_id: Optional[str] = None,
    ) -> str:
        if task_id:
            return str(task_id)
        if not task_name:
            raise ValueError("Either taskId or taskName must be supplied.")
        query_params = {"archived": "false", "page": 0, "subtasks": "true"}
        if list_id:
            response = self.request_checked(
                HttpMethod.GET,
                f"/list/{list_id}/task",
                query_params=query_params,
            )
            payload = response.data if isinstance(response.data, dict) else {}
            tasks = payload.get("tasks", []) if isinstance(payload.get("tasks"), list) else []
        else:
            resolved_team = self.ensure_team_id(team_id)
            response = self.request_checked(
                HttpMethod.POST,
                f"/team/{resolved_team}/task/search",
                json_body={
                    "task_name": task_name,
                    "include_closed": True,
                    "subtasks": True,
                    "page": 0,
                    "order_by": "updated",
                    "reverse": True,
                },
            )
            payload = response.data if isinstance(response.data, dict) else {}
            tasks = payload.get("tasks", []) if isinstance(payload.get("tasks"), list) else []

        normalized = task_name.strip().lower()
        matches = [task for task in tasks if str(task.get("name", "")).strip().lower() == normalized]
        if not matches and tasks:
            matches = tasks
        if not matches:
            raise ValueError(f"Unable to locate task named '{task_name}'.")
        matches.sort(key=lambda item: item.get("date_updated", 0), reverse=True)
        return str(matches[0]["id"])

    def get_workspace_members(self, team_id: Optional[int], *, force_refresh: bool = False) -> list[Dict[str, Any]]:
        resolved_team_id = self.ensure_team_id(team_id)
        if not force_refresh and resolved_team_id in self._member_cache:
            return self._member_cache[resolved_team_id]
        response = self.request_checked(HttpMethod.GET, f"/team/{resolved_team_id}/member")
        payload = response.data if isinstance(response.data, dict) else {}
        members = payload.get("members", []) if isinstance(payload.get("members"), list) else []
        self._member_cache[resolved_team_id] = members
        return members


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


def _parse_date_field(value: Any) -> Optional[int]:
    """Convert natural language date strings to ClickUp timestamps in milliseconds."""

    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        # Assume the value is either seconds or milliseconds.
        if value > 1_000_000_000_000:
            return int(value)
        return int(value * 1000)
    if isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        raw = int(text)
        if raw > 1_000_000_000_000:
            return raw
        return raw * 1000
    parsed = parse_date(text, settings={"RETURN_AS_TIMEZONE_AWARE": True})
    if parsed is None:
        raise ValueError(f"Unable to interpret date expression: {value!r}")
    return int(parsed.timestamp() * 1000)


def _parse_duration_field(value: Any) -> Optional[int]:
    """Parse flexible duration expressions into milliseconds."""

    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip().lower()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    units = {
        "ms": 1,
        "millisecond": 1,
        "milliseconds": 1,
        "s": 1000,
        "sec": 1000,
        "secs": 1000,
        "second": 1000,
        "seconds": 1000,
        "m": 60_000,
        "min": 60_000,
        "mins": 60_000,
        "minute": 60_000,
        "minutes": 60_000,
        "h": 3_600_000,
        "hr": 3_600_000,
        "hrs": 3_600_000,
        "hour": 3_600_000,
        "hours": 3_600_000,
        "d": 86_400_000,
        "day": 86_400_000,
        "days": 86_400_000,
    }
    total = 0
    for amount, unit in re.findall(r"(\d+(?:\.\d+)?)\s*([a-z]+)", text):
        factor = units.get(unit)
        if factor is None:
            continue
        total += int(float(amount) * factor)
    return total or None


_COLOR_KEYWORDS: Dict[str, str] = {
    "red": "#e03131",
    "dark red": "#a61e4d",
    "light red": "#ffa8a8",
    "orange": "#ff922b",
    "amber": "#f08c00",
    "yellow": "#fcc419",
    "gold": "#fab005",
    "green": "#37b24d",
    "light green": "#8ce99a",
    "dark green": "#2b8a3e",
    "teal": "#12b886",
    "blue": "#228be6",
    "light blue": "#74c0fc",
    "dark blue": "#1c7ed6",
    "purple": "#7048e8",
    "violet": "#845ef7",
    "pink": "#e64980",
    "magenta": "#d6336c",
    "brown": "#795548",
    "gray": "#868e96",
    "grey": "#868e96",
    "black": "#212529",
    "white": "#f8f9fa",
}


def _hex_color_from_command(command: Optional[str]) -> Optional[str]:
    if not command:
        return None
    command = command.strip().lower()
    if not command:
        return None
    hex_match = re.search(r"#([0-9a-f]{6}|[0-9a-f]{3})", command)
    if hex_match:
        token = hex_match.group(0)
        if len(token) == 4:
            token = "#" + "".join(ch * 2 for ch in token[1:])
        return token
    # try direct lookup
    if command in _COLOR_KEYWORDS:
        return _COLOR_KEYWORDS[command]
    # look for keyword inside command
    for key, value in _COLOR_KEYWORDS.items():
        if key in command:
            return value
    return None


def _calculate_contrast(hex_color: str) -> str:
    color = hex_color.lstrip("#")
    if len(color) != 6:
        return "#ffffff"
    r = int(color[0:2], 16)
    g = int(color[2:4], 16)
    b = int(color[4:6], 16)
    # relative luminance
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#000000" if luminance > 0.5 else "#ffffff"


def _maybe_apply_color_command(body: Dict[str, Any], command: Optional[str]) -> None:
    hex_color = _hex_color_from_command(command)
    if not hex_color:
        return
    body.setdefault("tag", {})["tag_bg"] = hex_color
    body.setdefault("tag", {})["tag_fg"] = _calculate_contrast(hex_color)


def _normalize_assignees(
    client: ClickUpAPIClient,
    *,
    team_id: Optional[int],
    assignees: Optional[Sequence[Any]],
) -> Optional[list[int]]:
    if not assignees:
        return None
    members = client.get_workspace_members(team_id)
    normalized = []
    for assignee in assignees:
        if assignee is None:
            continue
        if isinstance(assignee, int):
            normalized.append(int(assignee))
            continue
        if isinstance(assignee, str) and assignee.isdigit():
            normalized.append(int(assignee))
            continue
        key = str(assignee).strip().lower()
        for member in members:
            username = str(member.get("username", "")).lower()
            email = str(member.get("email", "")).lower()
            full_name = str(member.get("full_name", "")).lower()
            if key in {username, email, full_name}:
                normalized.append(int(member.get("id")))
                break
    return normalized or None


def _apply_task_date_fields(
    payload: Dict[str, Any],
    *,
    start_date: Any = None,
    due_date: Any = None,
) -> None:
    start_millis = _parse_date_field(start_date)
    if start_millis is not None:
        payload["start_date"] = start_millis
    due_millis = _parse_date_field(due_date)
    if due_millis is not None:
        payload["due_date"] = due_millis


def _coerce_view_model(
    value: Any,
    model_cls: type[BaseModel],
) -> Dict[str, Any]:
    """Normalize user supplied view configuration fragments."""

    if value is None:
        model = model_cls()
    elif isinstance(value, model_cls):
        model = value
    else:
        model = model_cls.model_validate(value)
    return model.model_dump(exclude_none=True)


def _prepare_view_payload(
    *,
    name: str,
    view_type: str,
    filters: Any = None,
    grouping: Any = None,
    divide: Any = None,
    sorting: Any = None,
    columns: Any = None,
    team_sidebar: Any = None,
    settings: Any = None,
) -> Dict[str, Any]:
    """Construct the request body for ClickUp view creation endpoints."""

    payload = {
        "name": name,
        "type": view_type,
        "grouping": _coerce_view_model(grouping, ViewGrouping),
        "divide": _coerce_view_model(divide, ViewDivide),
        "sorting": _coerce_view_model(sorting, ViewSorting),
        "filters": _coerce_view_model(filters, ViewFilters),
        "columns": _coerce_view_model(columns, ViewColumns),
        "team_sidebar": _coerce_view_model(team_sidebar, ViewTeamSidebar),
        "settings": _coerce_view_model(settings, ViewSettings),
    }
    return payload


def _resolve_list_identifier(
    client: ClickUpAPIClient,
    *,
    team_id: Optional[int],
    list_id: Optional[str] = None,
    list_name: Optional[str] = None,
) -> str:
    return client.resolve_list_id(team_id=team_id, list_id=list_id, list_name=list_name)


def _coalesce_entry_value(entry: Mapping[str, Any], *keys: str) -> Optional[Any]:
    """Return the first non-empty value from *keys within *entry*."""

    for key in keys:
        if key in entry:
            value = entry[key]
            if value not in (None, ""):
                return value
    return None


@dataclass
class TaskLookupFields:
    """Normalized identifiers extracted from a bulk task entry."""

    task_id: Optional[str]
    task_name: Optional[str]
    list_id: Optional[str]
    list_name: Optional[str]
    custom_task_id: Optional[str]


def _extract_task_lookup_fields(entry: Mapping[str, Any]) -> TaskLookupFields:
    """Normalize task lookup identifiers from mixed schema keys."""

    custom_task_id = _coalesce_entry_value(
        entry,
        "customTaskId",
        "custom_task_id",
        "customId",
        "custom_id",
    )
    task_id = _coalesce_entry_value(entry, "taskId", "task_id", "id")
    if not task_id and custom_task_id:
        task_id = custom_task_id
    task_name = _coalesce_entry_value(entry, "taskName", "task_name")
    list_id = _coalesce_entry_value(entry, "listId", "list_id")
    list_name = _coalesce_entry_value(entry, "listName", "list_name")
    return TaskLookupFields(task_id, task_name, list_id, list_name, custom_task_id)


def _resolve_task_identifier(
    client: ClickUpAPIClient,
    *,
    team_id: Optional[int],
    task_id: Optional[str] = None,
    task_name: Optional[str] = None,
    list_id: Optional[str] = None,
    list_name: Optional[str] = None,
) -> str:
    resolved_list_id = list_id
    if not resolved_list_id and list_name:
        resolved_list_id = client.resolve_list_id(
            team_id=team_id,
            list_id=None,
            list_name=list_name,
        )
    return client.resolve_task_id(
        team_id=team_id,
        task_id=task_id,
        task_name=task_name,
        list_id=resolved_list_id,
    )


_STANDARD_TASK_ID_PATTERN = re.compile(r"^\d+$")


def _is_standard_task_id(task_id: str) -> bool:
    """Return True when the identifier matches ClickUp's default numeric format."""

    if not isinstance(task_id, str):
        return False
    return bool(_STANDARD_TASK_ID_PATTERN.fullmatch(task_id.strip()))


def _augment_task_query_params(
    client: ClickUpAPIClient,
    task_id: str,
    *,
    team_id: Optional[int],
    query_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Inject custom task id query parameters when necessary."""

    query: Dict[str, Any] = dict(query_params) if query_params else {}
    if not _is_standard_task_id(task_id):
        resolved_team = client.ensure_team_id(team_id)
        query.setdefault("custom_task_ids", "true")
        query.setdefault("team_id", resolved_team)
    return query


def _resolve_team_id_for_request(
    client: ClickUpAPIClient, team_id: Optional[int]
) -> Optional[int]:
    """Determine the team identifier used for OAuth scoped requests."""

    if client.uses_oauth_authentication():
        return client.ensure_team_id(team_id)
    return int(team_id) if team_id is not None else None


def _get_or_create_client(ctx: Context) -> ClickUpAPIClient:
    session = ctx.session
    cache: Optional[Dict[str, Any]] = getattr(session, "_clickup_cache", None)
    if not isinstance(cache, dict):
        cache = {}
        setattr(session, "_clickup_cache", cache)

    client = cache.get("clickup_client")
    if isinstance(client, ClickUpAPIClient):
        return client

    config = ctx.session_config
    if not isinstance(config, ClickUpConfig):
        try:
            config = ClickUpConfig.model_validate(config)
        except ValidationError as exc:  # pragma: no cover - defensive validation
            raise ValueError("Invalid ClickUp configuration provided to the session.") from exc

    token_value = (
        config.api_token.get_secret_value().strip() if config.api_token else ""
    )
    if not token_value:
        raise ValueError(
            "A ClickUp API token must be provided via the session configuration before "
            "calling ClickUp tools."
        )
    config = config.model_copy(update={"api_token": SecretStr(token_value)})

    client = ClickUpAPIClient(config)
    cache["clickup_client"] = client
    return client


def _get_client_session_id(ctx: Context) -> str:
    """Return a stable session identifier required by ClickUp bulk endpoints."""

    session = getattr(ctx, "session", None)
    session_id: Optional[str] = None
    if session is not None:
        session_id = getattr(session, "_clickup_client_session_id", None)
    if not isinstance(session_id, str) or not session_id.strip():
        session_id = uuid4().hex
        if session is not None:
            setattr(session, "_clickup_client_session_id", session_id)
    return session_id


def _build_bulk_session_headers(
    ctx: Context, extra_headers: Optional[Dict[str, str]] = None
) -> Dict[str, str]:
    """Construct headers that include the ClickUp bulk session identifier."""

    headers = {"X-Client-Session-Id": _get_client_session_id(ctx)}
    if extra_headers:
        headers.update(extra_headers)
    return headers


@smithery.server(config_schema=ClickUpConfig)
def create_server() -> FastMCP:
    """Create and configure the ClickUp MCP server."""

    server = FastMCP("ClickUp")

    @server.tool(
        annotations=READ_ONLY_TOOL,
        description="Scrape the ClickUp API reference navigation to expose documentation URLs for other tools to follow.",
    )
    def list_clickup_reference_links(ctx: Context) -> Dict[str, Any]:
        """Scrape the ClickUp API reference navigation to expose documentation URLs."""

        _ = ctx
        with httpx.Client(headers={"User-Agent": "Mozilla/5.0"}) as client:
            response = client.get("https://clickup.com/api", timeout=30.0)
            response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        links: Dict[str, str] = {}
        for anchor in soup.find_all("a"):
            href = anchor.get("href")
            text = (anchor.text or "").strip()
            if not href or not text or not href.startswith("/api"):
                continue
            links[text] = f"https://clickup.com{href}"
        return {
            "links": links,
            "description": "Mapping of link text to ClickUp API documentation URLs scraped from the navigation menu.",
        }

    @server.tool(
        annotations=READ_ONLY_TOOL,
        description="Download and sanitize a ClickUp API documentation page. Use this for contextual guidance, not for task data.",
    )
    def fetch_clickup_reference_page(
        path: Annotated[
            str,
            Field(description="Path or slug relative to /api, e.g. '/api-reference/tasks/create-task'."),
        ]
    ) -> Dict[str, Any]:
        """Download and sanitize a ClickUp API documentation page for reference material."""

        return _scrape_clickup_docs(path)

    @server.resource(
        "clickup://guide/configuration",
        description="How to configure authentication and defaults for the ClickUp MCP session.",
    )
    def configuration_guide() -> str:
        """Explain how to configure the server."""

        return (
            "Provide your ClickUp personal token or OAuth access token via the session configuration. "
            "Use the auth_scheme option to explicitly pick 'personal_token' or 'oauth' when automatic detection does not work. "
            "Optionally include a default team ID, additional headers, or override the API base URL for future versions."
        )

    # ------------------------------------------------------------------
    # Workspace hierarchy
    # ------------------------------------------------------------------
    @server.tool(
        name="get_workspace_hierarchy",
        annotations=READ_ONLY_TOOL,
        description="Retrieve spaces, folders, and lists for a workspace via GET /team/{team_id}/space and related endpoints.",
    )
    def get_workspace_hierarchy(
        ctx: Context,
        team_id: Annotated[
            Optional[int],
            Field(
                default=None,
                description="Workspace/team identifier. Uses default_team_id from config when omitted.",
            ),
        ] = None,
        refresh: Annotated[
            bool,
            Field(default=False, description="Force a refresh instead of serving cached hierarchy results."),
        ] = False,
    ) -> Dict[str, Any]:
        """Retrieve the cached ClickUp workspace hierarchy for the requested team."""

        client = _get_or_create_client(ctx)
        hierarchy = client.get_workspace_hierarchy(team_id, force_refresh=refresh)
        return hierarchy

    # ------------------------------------------------------------------
    # Task management
    # ------------------------------------------------------------------
    @server.tool(
        name="create_task",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a new ClickUp task via POST /list/{list_id}/task. Provide either list_id or list_name to target the list.",
    )
    def create_task(
        ctx: Context,
        name: Annotated[str, Field(description="Task name to create.")],
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier where the task will be created."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name (resolved within the workspace hierarchy)."),
        ] = None,
        description: Annotated[
            Optional[str],
            Field(default=None, description="Plain text description for the task."),
        ] = None,
        markdown_description: Annotated[
            Optional[str],
            Field(default=None, description="Markdown formatted description."),
        ] = None,
        status: Annotated[
            Optional[str],
            Field(default=None, description="Status to assign to the task."),
        ] = None,
        priority: Annotated[
            Optional[int],
            Field(default=None, description="Priority level (1-4)."),
        ] = None,
        due_date: Annotated[
            Optional[Any],
            Field(default=None, description="Due date in natural language or Unix time."),
        ] = None,
        start_date: Annotated[
            Optional[Any],
            Field(default=None, description="Start date in natural language or Unix time."),
        ] = None,
        parent: Annotated[
            Optional[str],
            Field(default=None, description="Parent task ID for creating subtasks."),
        ] = None,
        tags: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Tags to apply to the task."),
        ] = None,
        assignees: Annotated[
            Optional[Sequence[Any]],
            Field(default=None, description="Users to assign (IDs, emails, or names)."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a task in the specified ClickUp list using POST /list/{list_id}/task."""

        client = _get_or_create_client(ctx)
        resolved_list_id = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=list_id,
            list_name=list_name,
        )
        payload: Dict[str, Any] = {"name": name}
        if description is not None:
            payload["description"] = description
        if markdown_description is not None:
            payload["markdown_description"] = markdown_description
        if status is not None:
            payload["status"] = status
        if priority is not None:
            payload["priority"] = priority
        if parent is not None:
            payload["parent"] = parent
        if tags:
            payload["tags"] = list(tags)
        assignee_ids = _normalize_assignees(client, team_id=team_id, assignees=assignees)
        if assignee_ids is not None:
            payload["assignees"] = assignee_ids
        _apply_task_date_fields(payload, start_date=start_date, due_date=due_date)

        response = client.request_checked(
            HttpMethod.POST,
            f"/list/{resolved_list_id}/task",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_bulk_tasks",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create multiple ClickUp tasks in one request using POST /task/bulk.",
    )
    def create_bulk_tasks(
        ctx: Context,
        tasks: Annotated[
            Sequence[Dict[str, Any]],
            Field(description="Collection of task payloads to create."),
        ],
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="Default list identifier applied when tasks omit listId."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="Default list name applied when listId is omitted."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create multiple ClickUp tasks in one request using POST /task/bulk."""

        client = _get_or_create_client(ctx)
        default_list_id: Optional[str] = None
        if list_id or list_name:
            default_list_id = _resolve_list_identifier(
                client,
                team_id=team_id,
                list_id=list_id,
                list_name=list_name,
            )
        resolved_team = client.ensure_team_id(team_id)

        normalized_tasks: list[Dict[str, Any]] = []
        custom_id_present = False
        for entry in tasks:
            if not isinstance(entry, dict):
                raise ValueError("Each task entry must be an object containing creation parameters.")
            task_payload: Dict[str, Any] = {}
            target_list_id = entry.get("listId") or entry.get("list_id")
            target_list_name = entry.get("listName") or entry.get("list_name")
            resolved_list = target_list_id or default_list_id
            if not resolved_list and target_list_name:
                resolved_list = _resolve_list_identifier(
                    client,
                    team_id=team_id,
                    list_id=None,
                    list_name=str(target_list_name),
                )
            if not resolved_list:
                raise ValueError(
                    "Each task must specify listId/listName when no default list is supplied to the tool."
                )
            task_payload["list_id"] = resolved_list
            name = entry.get("name")
            if not name:
                raise ValueError("Each task requires a name field.")
            task_payload["name"] = name
            for key in ("description", "markdown_description", "status", "priority", "parent", "tags"):
                if key in entry and entry[key] is not None:
                    task_payload[key] = entry[key]
            custom_id = None
            for key in ("custom_id", "customId", "custom_task_id", "customTaskId"):
                value = entry.get(key)
                if value not in (None, ""):
                    custom_id = str(value)
                    break
            if custom_id is not None:
                task_payload["custom_id"] = custom_id
                custom_id_present = True
            _apply_task_date_fields(
                task_payload,
                start_date=entry.get("startDate") or entry.get("start_date"),
                due_date=entry.get("dueDate") or entry.get("due_date"),
            )
            assignee_ids = _normalize_assignees(
                client,
                team_id=team_id,
                assignees=entry.get("assignees"),
            )
            if assignee_ids is not None:
                task_payload["assignees"] = assignee_ids
            normalized_tasks.append(task_payload)

        query_params: Dict[str, Any] = {"team_id": resolved_team}
        if custom_id_present:
            query_params["custom_task_ids"] = "true"

        response = client.request_checked(
            HttpMethod.POST,
            "/task/bulk",
            json_body={
                "team_id": resolved_team,
                "tasks": normalized_tasks,
            },
            query_params=query_params,
            team_id=resolved_team,
            headers=_build_bulk_session_headers(ctx),
        )
        return response.to_jsonable()

    @server.tool(
        name="update_task",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Update an existing ClickUp task via PUT /task/{task_id}. Provide task_id directly or resolve by name plus list context.",
    )
    def update_task(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to update."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name (requires list context for disambiguation)."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        name: Annotated[
            Optional[str],
            Field(default=None, description="Updated name."),
        ] = None,
        description: Annotated[
            Optional[str],
            Field(default=None, description="Updated description."),
        ] = None,
        markdown_description: Annotated[
            Optional[str],
            Field(default=None, description="Updated markdown description."),
        ] = None,
        status: Annotated[
            Optional[str],
            Field(default=None, description="Updated status."),
        ] = None,
        priority: Annotated[
            Optional[int],
            Field(default=None, description="Updated priority."),
        ] = None,
        due_date: Annotated[
            Optional[Any],
            Field(default=None, description="Updated due date."),
        ] = None,
        start_date: Annotated[
            Optional[Any],
            Field(default=None, description="Updated start date."),
        ] = None,
        assignees: Annotated[
            Optional[Sequence[Any]],
            Field(default=None, description="Assignees to replace with."),
        ] = None,
        tags: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Tags to set."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Update a ClickUp task using PUT /task/{task_id}."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        payload: Dict[str, Any] = {}
        for key, value in (
            ("name", name),
            ("description", description),
            ("markdown_description", markdown_description),
            ("status", status),
            ("priority", priority),
        ):
            if value is not None:
                payload[key] = value
        if tags is not None:
            payload["tags"] = list(tags)
        assignee_ids = _normalize_assignees(client, team_id=team_id, assignees=assignees)
        if assignee_ids is not None:
            payload["assignees"] = assignee_ids
        _apply_task_date_fields(payload, start_date=start_date, due_date=due_date)

        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )

        response = client.request_checked(
            HttpMethod.PUT,
            f"/task/{resolved_task_id}",
            json_body=payload,
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="update_bulk_tasks",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Update multiple tasks using PUT /task/bulk with ClickUp's bulk update schema.",
    )
    def update_bulk_tasks(
        ctx: Context,
        tasks: Annotated[
            Sequence[Dict[str, Any]],
            Field(description="Collection of task updates to apply."),
        ],
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Update multiple tasks using PUT /task/bulk with ClickUp's bulk update schema."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        normalized_tasks: list[Dict[str, Any]] = []
        custom_ids_requested = False
        for entry in tasks:
            if not isinstance(entry, dict):
                raise ValueError("Each task entry must be an object containing update parameters.")
            task_payload: Dict[str, Any] = {}
            lookup = _extract_task_lookup_fields(entry)
            task_payload["id"] = _resolve_task_identifier(
                client,
                team_id=team_id,
                task_id=lookup.task_id,
                task_name=lookup.task_name,
                list_id=lookup.list_id,
                list_name=lookup.list_name,
            )
            if lookup.custom_task_id:
                task_payload["custom_task_id"] = lookup.custom_task_id
            for key in ("name", "description", "markdown_description", "status", "priority", "tags"):
                if key in entry and entry[key] is not None:
                    task_payload[key] = entry[key]
            _apply_task_date_fields(
                task_payload,
                start_date=entry.get("startDate") or entry.get("start_date"),
                due_date=entry.get("dueDate") or entry.get("due_date"),
            )
            assignee_ids = _normalize_assignees(
                client,
                team_id=team_id,
                assignees=entry.get("assignees"),
            )
            if assignee_ids is not None:
                task_payload["assignees"] = assignee_ids
            if lookup.custom_task_id or not _is_standard_task_id(str(task_payload.get("id", ""))):
                custom_ids_requested = True
            normalized_tasks.append(task_payload)

        query_params: Dict[str, Any] = {"team_id": resolved_team}
        if custom_ids_requested or any(
            "custom_task_id" in task for task in normalized_tasks
        ):
            query_params["custom_task_ids"] = "true"

        response = client.request_checked(
            HttpMethod.PUT,
            "/task/bulk",
            json_body={"team_id": resolved_team, "tasks": normalized_tasks},
            query_params=query_params,
            team_id=resolved_team,
            headers=_build_bulk_session_headers(ctx),
        )
        return response.to_jsonable()

    @server.tool(
        name="get_tasks",
        annotations=READ_ONLY_TOOL,
        description="List tasks that live inside a specific ClickUp list via GET /list/{list_id}/task.",
    )
    def get_tasks(
        ctx: Context,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier to fetch tasks from."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name resolved through the workspace hierarchy."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        page: Annotated[
            Optional[int],
            Field(default=None, description="Pagination page to request."),
        ] = None,
        order_by: Annotated[
            Optional[str],
            Field(default=None, description="Order field (e.g. 'due_date')."),
        ] = None,
        reverse: Annotated[
            Optional[bool],
            Field(default=None, description="Reverse sort order."),
        ] = None,
        statuses: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Filter tasks by statuses."),
        ] = None,
        include_closed: Annotated[
            Optional[bool],
            Field(default=None, description="Include closed tasks."),
        ] = None,
        assignees: Annotated[
            Optional[Sequence[Any]],
            Field(default=None, description="Filter by assignees."),
        ] = None,
        subtasks: Annotated[
            Optional[bool],
            Field(default=None, description="Include subtasks in results."),
        ] = None,
        archived: Annotated[
            Optional[bool],
            Field(default=False, description="Include archived tasks."),
        ] = False,
        due_date_gt: Annotated[
            Optional[Any],
            Field(default=None, description="Filter tasks due after this timestamp."),
        ] = None,
        due_date_lt: Annotated[
            Optional[Any],
            Field(default=None, description="Filter tasks due before this timestamp."),
        ] = None,
    ) -> Dict[str, Any]:
        """List the tasks for a ClickUp list using GET /list/{list_id}/task.

        Use :func:`get_list` when you only need metadata such as list details or
        statuses—`get_tasks` returns the tasks themselves.
        """

        client = _get_or_create_client(ctx)
        resolved_list_id = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=list_id,
            list_name=list_name,
        )
        query: Dict[str, Any] = {}
        if page is not None:
            query["page"] = page
        if order_by is not None:
            query["order_by"] = order_by
        if reverse is not None:
            query["reverse"] = str(bool(reverse)).lower()
        if statuses:
            query["statuses[]"] = list(statuses)
        if include_closed is not None:
            query["include_closed"] = str(bool(include_closed)).lower()
        if subtasks is not None:
            query["subtasks"] = str(bool(subtasks)).lower()
        if archived is not None:
            query["archived"] = str(bool(archived)).lower()
        if assignees:
            assignee_ids = _normalize_assignees(client, team_id=team_id, assignees=assignees)
            if assignee_ids:
                query["assignees[]"] = assignee_ids
        if due_date_gt is not None:
            query["due_date_gt"] = _parse_date_field(due_date_gt)
        if due_date_lt is not None:
            query["due_date_lt"] = _parse_date_field(due_date_lt)

        response = client.request_checked(
            HttpMethod.GET,
            f"/list/{resolved_list_id}/task",
            query_params=query,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_task",
        annotations=READ_ONLY_TOOL,
        description="Retrieve a single ClickUp task via GET /task/{task_id} with optional name-based resolution.",
    )
    def get_task(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to retrieve."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name for lookup when an identifier is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used to disambiguate taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used to disambiguate taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        include_subtasks: Annotated[
            Optional[bool],
            Field(default=None, description="Include subtasks in the payload."),
        ] = None,
    ) -> Dict[str, Any]:
        """Retrieve a single ClickUp task using GET /task/{task_id}."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        query: Dict[str, Any] = {}
        if include_subtasks is not None:
            query["include_subtasks"] = str(bool(include_subtasks)).lower()
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
            query_params=query,
        )

        response = client.request_checked(
            HttpMethod.GET,
            f"/task/{resolved_task_id}",
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_workspace_tasks",
        annotations=READ_ONLY_TOOL,
        description="Search tasks across an entire ClickUp workspace via POST /team/{team_id}/task/search.",
    )
    def get_workspace_tasks(
        ctx: Context,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        tags: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Filter tasks by tag names."),
        ] = None,
        list_ids: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Filter tasks by list identifiers."),
        ] = None,
        space_ids: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Filter tasks by space identifiers."),
        ] = None,
        folder_ids: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Filter tasks by folder identifiers."),
        ] = None,
        statuses: Annotated[
            Optional[Sequence[str]],
            Field(default=None, description="Filter by task statuses."),
        ] = None,
        assignees: Annotated[
            Optional[Sequence[Any]],
            Field(default=None, description="Filter by assigned members."),
        ] = None,
        include_closed: Annotated[
            Optional[bool],
            Field(default=None, description="Include closed tasks in search results."),
        ] = None,
        page: Annotated[
            Optional[int],
            Field(default=None, description="Pagination index."),
        ] = None,
        order_by: Annotated[
            Optional[str],
            Field(default=None, description="Sort field (e.g. 'due_date')."),
        ] = None,
        reverse: Annotated[
            Optional[bool],
            Field(default=None, description="Reverse the sort order."),
        ] = None,
        detail_level: Annotated[
            Optional[str],
            Field(default="detailed", description="Either 'summary' or 'detailed'."),
        ] = "detailed",
        subtasks: Annotated[
            Optional[bool],
            Field(default=None, description="Include subtasks when they match filters."),
        ] = None,
        due_date_gt: Annotated[
            Optional[Any],
            Field(default=None, description="Filter tasks due after this timestamp."),
        ] = None,
        due_date_lt: Annotated[
            Optional[Any],
            Field(default=None, description="Filter tasks due before this timestamp."),
        ] = None,
    ) -> Dict[str, Any]:
        """Search tasks across a workspace using POST /team/{team_id}/task/search."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        body: Dict[str, Any] = {"page": page or 0}
        if tags:
            body["tags"] = list(tags)
        if list_ids:
            body["list_ids"] = list(list_ids)
        if space_ids:
            body["space_ids"] = list(space_ids)
        if folder_ids:
            body["folder_ids"] = list(folder_ids)
        if statuses:
            body["statuses"] = list(statuses)
        if include_closed is not None:
            body["include_closed"] = bool(include_closed)
        if order_by is not None:
            body["order_by"] = order_by
        if reverse is not None:
            body["reverse"] = bool(reverse)
        if detail_level:
            body["detail_level"] = detail_level
        if subtasks is not None:
            body["subtasks"] = bool(subtasks)
        if due_date_gt is not None:
            body["due_date_gt"] = _parse_date_field(due_date_gt)
        if due_date_lt is not None:
            body["due_date_lt"] = _parse_date_field(due_date_lt)
        if assignees:
            body["assignees"] = _normalize_assignees(client, team_id=team_id, assignees=assignees)

        if not any(body.get(key) for key in ("tags", "list_ids", "space_ids", "folder_ids", "statuses", "assignees", "due_date_gt", "due_date_lt")):
            raise ValueError("At least one filtering parameter must be supplied when calling get_workspace_tasks.")

        response = client.request_checked(
            HttpMethod.POST,
            f"/team/{resolved_team}/task/search",
            json_body=body,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_task_comments",
        annotations=READ_ONLY_TOOL,
        description="Fetch comments for a task via GET /task/{task_id}/comment.",
    )
    def get_task_comments(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to inspect."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name used when an ID is not available."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used to resolve taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used to resolve taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        start: Annotated[
            Optional[int],
            Field(default=None, description="Pagination offset for comments."),
        ] = None,
        start_id: Annotated[
            Optional[str],
            Field(default=None, description="Comment identifier to start pagination from."),
        ] = None,
    ) -> Dict[str, Any]:
        """Fetch comments for a ClickUp task using GET /task/{task_id}/comment."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        query: Dict[str, Any] = {}
        if start is not None:
            query["start"] = start
        if start_id is not None:
            query["start_id"] = start_id
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
            query_params=query,
        )

        response = client.request_checked(
            HttpMethod.GET,
            f"/task/{resolved_task_id}/comment",
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_task_comment",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Add a new comment to a task via POST /task/{task_id}/comment.",
    )
    def create_task_comment(
        ctx: Context,
        comment_text: Annotated[str, Field(description="Comment body to add to the task.")],
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the target task."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name for lookup when ID is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used to resolve taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used to resolve taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        notify_all: Annotated[
            Optional[bool],
            Field(default=None, description="Notify all watchers of the task."),
        ] = None,
        assignee: Annotated[
            Optional[Any],
            Field(default=None, description="Assign the comment to a specific user."),
        ] = None,
    ) -> Dict[str, Any]:
        """Add a comment to a ClickUp task using POST /task/{task_id}/comment."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        payload: Dict[str, Any] = {"comment_text": comment_text}
        if notify_all is not None:
            payload["notify_all"] = bool(notify_all)
        if assignee is not None:
            assignee_ids = _normalize_assignees(client, team_id=team_id, assignees=[assignee])
            if assignee_ids:
                payload["assignee"] = assignee_ids[0]
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )

        response = client.request_checked(
            HttpMethod.POST,
            f"/task/{resolved_task_id}/comment",
            json_body=payload,
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="attach_task_file",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Upload a file to a task via POST /task/{task_id}/attachment.",
    )
    def attach_task_file(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task that receives the attachment."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name for lookup when an ID is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used to resolve taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used to resolve taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        file_data: Annotated[
            Optional[str],
            Field(default=None, description="Base64 encoded file contents."),
        ] = None,
        file_url: Annotated[
            Optional[str],
            Field(default=None, description="URL or local path to fetch the attachment from."),
        ] = None,
        file_name: Annotated[
            Optional[str],
            Field(default=None, description="Override filename for the attachment."),
        ] = None,
        content_type: Annotated[
            Optional[str],
            Field(default=None, description="Explicit MIME type for the uploaded file."),
        ] = None,
    ) -> Dict[str, Any]:
        """Attach a file to a ClickUp task using POST /task/{task_id}/attachment."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )

        if file_data is None and file_url is None:
            raise ValueError("Either file_data or file_url must be provided to attach a file.")

        if file_data is None and file_url is not None:
            parsed = urlparse(file_url)
            if parsed.scheme in {"http", "https"}:
                with httpx.Client() as downloader:
                    response = downloader.get(file_url)
                    response.raise_for_status()
                    raw_bytes = response.content
            else:
                path = os.path.expanduser(file_url)
                with open(path, "rb") as handle:
                    raw_bytes = handle.read()
            file_data = base64.b64encode(raw_bytes).decode("ascii")
            if not file_name:
                file_name = os.path.basename(parsed.path) if parsed.path else "attachment"
            if not content_type:
                content_type = mimetypes.guess_type(file_name or "attachment")[0]

        if not file_name:
            file_name = "attachment"

        multipart_file = MultipartFile(
            field_name="attachment",
            filename=file_name,
            content_base64=file_data,
            content_type=content_type,
        )
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )

        response = client.request_checked(
            HttpMethod.POST,
            f"/task/{resolved_task_id}/attachment",
            files=[multipart_file],
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="delete_task",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Permanently delete a ClickUp task via DELETE /task/{task_id}.",
    )
    def delete_task(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to delete."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name for lookup when ID is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Delete a ClickUp task using DELETE /task/{task_id}."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )
        response = client.request_checked(
            HttpMethod.DELETE,
            f"/task/{resolved_task_id}",
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="delete_bulk_tasks",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Permanently delete multiple tasks using POST /task/bulk/delete.",
    )
    def delete_bulk_tasks(
        ctx: Context,
        tasks: Annotated[
            Sequence[Dict[str, Any]],
            Field(description="Identifiers of the tasks to remove."),
        ],
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Delete multiple tasks via POST /task/bulk/delete."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        task_ids: list[str] = []
        custom_ids_requested = False
        for entry in tasks:
            if isinstance(entry, dict):
                lookup = _extract_task_lookup_fields(entry)
                resolved_id = _resolve_task_identifier(
                    client,
                    team_id=team_id,
                    task_id=lookup.task_id,
                    task_name=lookup.task_name,
                    list_id=lookup.list_id,
                    list_name=lookup.list_name,
                )
                identifier = lookup.custom_task_id or resolved_id
                if lookup.custom_task_id or not _is_standard_task_id(str(identifier)):
                    custom_ids_requested = True
                task_ids.append(identifier)
            else:
                task_ids.append(str(entry))

        query_params: Dict[str, Any] = {"team_id": resolved_team}
        if custom_ids_requested or any(
            not _is_standard_task_id(str(task_id)) for task_id in task_ids
        ):
            query_params["custom_task_ids"] = "true"

        response = client.request_checked(
            HttpMethod.DELETE,
            "/task/bulk",
            json_body={"team_id": resolved_team, "task_ids": task_ids},
            query_params=query_params,
            team_id=resolved_team,
            headers=_build_bulk_session_headers(ctx),
        )
        return response.to_jsonable()

    @server.tool(
        name="move_task",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Move a task to a different list or folder via POST /task/{task_id}/move.",
    )
    def move_task(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to move."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name used when an identifier is unavailable."),
        ] = None,
        source_list_id: Annotated[
            Optional[str],
            Field(default=None, description="Source list identifier used for taskName lookup."),
        ] = None,
        source_list_name: Annotated[
            Optional[str],
            Field(default=None, description="Source list name used for taskName lookup."),
        ] = None,
        destination_list_id: Annotated[
            Optional[str],
            Field(default=None, description="Destination list identifier."),
        ] = None,
        destination_list_name: Annotated[
            Optional[str],
            Field(default=None, description="Destination list name."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Move a task to another list using POST /task/{task_id}/move."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=source_list_id,
            list_name=source_list_name,
        )
        resolved_destination = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=destination_list_id,
            list_name=destination_list_name,
        )
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )
        response = client.request_checked(
            HttpMethod.POST,
            f"/task/{resolved_task_id}/move",
            json_body={"list_id": resolved_destination},
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="move_bulk_tasks",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Move multiple tasks to a destination list via POST /task/bulk/move.",
    )
    def move_bulk_tasks(
        ctx: Context,
        tasks: Annotated[
            Sequence[Dict[str, Any]],
            Field(description="Tasks to move to a destination list."),
        ],
        destination_list_id: Annotated[
            Optional[str],
            Field(default=None, description="Destination list identifier."),
        ] = None,
        destination_list_name: Annotated[
            Optional[str],
            Field(default=None, description="Destination list name."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Move multiple tasks to a destination list using POST /task/bulk/move."""

        client = _get_or_create_client(ctx)
        resolved_destination = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=destination_list_id,
            list_name=destination_list_name,
        )
        resolved_team = client.ensure_team_id(team_id)
        task_ids = []
        custom_ids_requested = False
        for entry in tasks:
            if isinstance(entry, Mapping):
                lookup = _extract_task_lookup_fields(entry)
            else:
                lookup = TaskLookupFields(str(entry), None, None, None, None)
            resolved_id = _resolve_task_identifier(
                client,
                team_id=team_id,
                task_id=lookup.task_id,
                task_name=lookup.task_name,
                list_id=lookup.list_id,
                list_name=lookup.list_name,
            )
            identifier = lookup.custom_task_id or resolved_id
            if lookup.custom_task_id or not _is_standard_task_id(str(identifier)):
                custom_ids_requested = True
            task_ids.append(identifier)
        query_params: Dict[str, Any] = {"team_id": resolved_team}
        if custom_ids_requested or any(
            not _is_standard_task_id(str(task_id)) for task_id in task_ids
        ):
            query_params["custom_task_ids"] = "true"
        response = client.request_checked(
            HttpMethod.POST,
            "/task/move/bulk",
            json_body={
                "team_id": resolved_team,
                "list_id": resolved_destination,
                "task_ids": task_ids,
            },
            query_params=query_params,
            team_id=resolved_team,
            headers=_build_bulk_session_headers(ctx),
        )
        return response.to_jsonable()

    @server.tool(
        name="duplicate_task",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Duplicate an existing task via POST /task/{task_id}/duplicate.",
    )
    def duplicate_task(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to duplicate."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name used when an identifier is unavailable."),
        ] = None,
        destination_list_id: Annotated[
            Optional[str],
            Field(default=None, description="Destination list identifier."),
        ] = None,
        destination_list_name: Annotated[
            Optional[str],
            Field(default=None, description="Destination list name."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        include_subtasks: Annotated[
            Optional[bool],
            Field(default=None, description="Include subtasks when duplicating."),
        ] = None,
        include_assignees: Annotated[
            Optional[bool],
            Field(default=None, description="Retain existing assignees."),
        ] = None,
    ) -> Dict[str, Any]:
        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
        )
        payload: Dict[str, Any] = {}
        if destination_list_id or destination_list_name:
            payload["list_id"] = _resolve_list_identifier(
                client,
                team_id=team_id,
                list_id=destination_list_id,
                list_name=destination_list_name,
            )
        if include_subtasks is not None:
            payload["include_subtasks"] = bool(include_subtasks)
        if include_assignees is not None:
            payload["include_assignees"] = bool(include_assignees)
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )

        response = client.request_checked(
            HttpMethod.POST,
            f"/task/{resolved_task_id}/duplicate",
            json_body=payload,
            query_params=query or None,
        )
        return response.to_jsonable()

    # ------------------------------------------------------------------
    # List and folder management
    # ------------------------------------------------------------------
    @server.tool(
        name="create_list",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a list inside a ClickUp space via POST /space/{space_id}/list.",
    )
    def create_list(
        ctx: Context,
        name: Annotated[str, Field(description="Name of the list to create.")],
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the parent space."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the parent space."),
        ] = None,
        content: Annotated[
            Optional[str],
            Field(default=None, description="Description of the list."),
        ] = None,
        due_date: Annotated[
            Optional[Any],
            Field(default=None, description="Default due date for tasks created in this list."),
        ] = None,
        priority: Annotated[
            Optional[int],
            Field(default=None, description="Default priority for tasks."),
        ] = None,
        assignee: Annotated[
            Optional[Any],
            Field(default=None, description="Default assignee for tasks."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a ClickUp list within a space using POST /space/{space_id}/list."""

        client = _get_or_create_client(ctx)
        resolved_space = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        payload: Dict[str, Any] = {"name": name}
        if content is not None:
            payload["content"] = content
        if priority is not None:
            payload["priority"] = priority
        if assignee is not None:
            assignees = _normalize_assignees(client, team_id=team_id, assignees=[assignee])
            if assignees:
                payload["assignee"] = assignees[0]
        if due_date is not None:
            payload["due_date"] = _parse_date_field(due_date)

        response = client.request_checked(
            HttpMethod.POST,
            f"/space/{resolved_space}/list",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_list_view",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a custom view for a list via POST /list/{list_id}/view.",
    )
    def create_list_view(
        ctx: Context,
        name: Annotated[str, Field(description="Name for the new view.")],
        view_type: Annotated[
            Literal[
                "list",
                "board",
                "calendar",
                "table",
                "timeline",
                "workload",
                "activity",
                "map",
                "conversation",
                "gantt",
            ],
            Field(description="View type to create (e.g. list, board, calendar)."),
        ] = "list",
        list_id: Annotated[
            Optional[str],
            Field(
                default=None,
                description="Identifier of the list that will host the view. Optional when listName is provided.",
            ),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(
                default=None,
                description="Name of the list used to resolve the identifier when listId is unknown.",
            ),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(
                default=None,
                description="Workspace/team identifier overriding the session default for list lookups.",
            ),
        ] = None,
        filters: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description=(
                    "Optional filters object following ClickUp's view filtering schema. "
                    "Include field/operator/value definitions plus optional groups to preload filter chips."
                ),
            ),
        ] = None,
        grouping: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Grouping preferences controlling swimlanes. Provide keys like field, dir, collapsed, and ignore.",
            ),
        ] = None,
        divide: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Optional secondary grouping/divide configuration mirroring ClickUp's UI settings.",
            ),
        ] = None,
        sorting: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Sorting options. Supply the same structure as the ClickUp API accepts for view sorting fields.",
            ),
        ] = None,
        columns: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Column configuration listing core and custom fields to display (use cf_ prefixes for custom fields).",
            ),
        ] = None,
        team_sidebar: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Sidebar configuration controlling the visible assignee buckets and quick filters.",
            ),
        ] = None,
        settings: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="General view settings (show_subtasks, show_assignees, collapse_empty_columns, etc.).",
            ),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a ClickUp view for a list using POST /list/{list_id}/view."""

        client = _get_or_create_client(ctx)
        resolved_list_id = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=list_id,
            list_name=list_name,
        )
        payload = _prepare_view_payload(
            name=name,
            view_type=view_type,
            filters=filters,
            grouping=grouping,
            divide=divide,
            sorting=sorting,
            columns=columns,
            team_sidebar=team_sidebar,
            settings=settings,
        )
        response = client.request_checked(
            HttpMethod.POST,
            f"/list/{resolved_list_id}/view",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_folder",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a folder inside a space via POST /space/{space_id}/folder.",
    )
    def create_folder(
        ctx: Context,
        name: Annotated[str, Field(description="Name of the folder to create.")],
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the parent space."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the parent space."),
        ] = None,
        override_statuses: Annotated[
            Optional[bool],
            Field(default=None, description="Whether the folder uses custom statuses."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a folder in a space using POST /space/{space_id}/folder."""

        client = _get_or_create_client(ctx)
        resolved_space = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        payload: Dict[str, Any] = {"name": name}
        if override_statuses is not None:
            payload["override_statuses"] = bool(override_statuses)
        request_team_id = _resolve_team_id_for_request(client, team_id)
        response = client.request_checked(
            HttpMethod.POST,
            f"/space/{resolved_space}/folder",
            json_body=payload,
            team_id=request_team_id,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_list_in_folder",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a list inside a folder via POST /folder/{folder_id}/list.",
    )
    def create_list_in_folder(
        ctx: Context,
        name: Annotated[str, Field(description="Name of the list to create.")],
        folder_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the parent folder."),
        ] = None,
        folder_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the parent folder."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        content: Annotated[
            Optional[str],
            Field(default=None, description="Description of the list."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a list inside a folder using POST /folder/{folder_id}/list."""

        client = _get_or_create_client(ctx)
        resolved_folder = client.resolve_folder_id(
            team_id=team_id,
            folder_id=folder_id,
            folder_name=folder_name,
        )
        payload: Dict[str, Any] = {"name": name}
        if content is not None:
            payload["content"] = content
        request_team_id = _resolve_team_id_for_request(client, team_id)
        response = client.request_checked(
            HttpMethod.POST,
            f"/folder/{resolved_folder}/list",
            json_body=payload,
            team_id=request_team_id,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_space_view",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a workspace-level view via POST /space/{space_id}/view.",
    )
    def create_space_view(
        ctx: Context,
        name: Annotated[str, Field(description="Name for the new view.")],
        view_type: Annotated[
            Literal[
                "list",
                "board",
                "calendar",
                "table",
                "timeline",
                "workload",
                "activity",
                "map",
                "conversation",
                "gantt",
            ],
            Field(description="View type to create (e.g. list, board, calendar)."),
        ] = "list",
        space_id: Annotated[
            Optional[str],
            Field(
                default=None,
                description="Identifier of the space that will host the view. Optional when spaceName is provided.",
            ),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(
                default=None,
                description="Name of the space used to resolve the identifier when spaceId is unknown.",
            ),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(
                default=None,
                description="Workspace/team identifier overriding the session default for space lookups.",
            ),
        ] = None,
        filters: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Optional filters object following ClickUp's view filtering schema.",
            ),
        ] = None,
        grouping: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Grouping preferences controlling swimlanes. Provide keys like field, dir, collapsed, and ignore.",
            ),
        ] = None,
        divide: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Optional secondary grouping/divide configuration mirroring ClickUp's UI settings.",
            ),
        ] = None,
        sorting: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Sorting options. Supply the same structure as the ClickUp API accepts for view sorting fields.",
            ),
        ] = None,
        columns: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Column configuration listing core and custom fields to display (use cf_ prefixes for custom fields).",
            ),
        ] = None,
        team_sidebar: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="Sidebar configuration controlling the visible assignee buckets and quick filters.",
            ),
        ] = None,
        settings: Annotated[
            Optional[Dict[str, Any]],
            Field(
                default=None,
                description="General view settings (show_subtasks, show_assignees, collapse_empty_columns, etc.).",
            ),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a workspace view using POST /space/{space_id}/view."""

        client = _get_or_create_client(ctx)
        resolved_space_id = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        payload = _prepare_view_payload(
            name=name,
            view_type=view_type,
            filters=filters,
            grouping=grouping,
            divide=divide,
            sorting=sorting,
            columns=columns,
            team_sidebar=team_sidebar,
            settings=settings,
        )
        response = client.request_checked(
            HttpMethod.POST,
            f"/space/{resolved_space_id}/view",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_folder",
        annotations=READ_ONLY_TOOL,
        description="Retrieve folder details via GET /folder/{folder_id}.",
    )
    def get_folder(
        ctx: Context,
        folder_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the folder to retrieve."),
        ] = None,
        folder_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the folder to retrieve."),
        ] = None,
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Space identifier for name resolution."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Space name for name resolution."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Retrieve metadata for a folder using GET /folder/{folder_id}."""

        client = _get_or_create_client(ctx)
        resolved_folder = client.resolve_folder_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
            folder_id=folder_id,
            folder_name=folder_name,
        )
        request_team_id = _resolve_team_id_for_request(client, team_id)
        response = client.request_checked(
            HttpMethod.GET,
            f"/folder/{resolved_folder}",
            team_id=request_team_id,
        )
        return response.to_jsonable()

    @server.tool(
        name="update_folder",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Update folder properties via PUT /folder/{folder_id}.",
    )
    def update_folder(
        ctx: Context,
        folder_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the folder to update."),
        ] = None,
        folder_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the folder to update."),
        ] = None,
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Space identifier for name resolution."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Space name for name resolution."),
        ] = None,
        name: Annotated[
            Optional[str],
            Field(default=None, description="New folder name."),
        ] = None,
        override_statuses: Annotated[
            Optional[bool],
            Field(default=None, description="Whether the folder uses custom statuses."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Update folder metadata using PUT /folder/{folder_id}."""

        client = _get_or_create_client(ctx)
        resolved_folder = client.resolve_folder_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
            folder_id=folder_id,
            folder_name=folder_name,
        )
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if override_statuses is not None:
            payload["override_statuses"] = bool(override_statuses)
        request_team_id = _resolve_team_id_for_request(client, team_id)
        response = client.request_checked(
            HttpMethod.PUT,
            f"/folder/{resolved_folder}",
            json_body=payload,
            team_id=request_team_id,
        )
        return response.to_jsonable()

    @server.tool(
        name="delete_folder",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Delete a folder via DELETE /folder/{folder_id}.",
    )
    def delete_folder(
        ctx: Context,
        folder_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the folder to delete."),
        ] = None,
        folder_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the folder to delete."),
        ] = None,
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Space identifier for name resolution."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Space name for name resolution."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Delete a ClickUp folder using DELETE /folder/{folder_id}."""

        client = _get_or_create_client(ctx)
        resolved_folder = client.resolve_folder_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
            folder_id=folder_id,
            folder_name=folder_name,
        )
        request_team_id = _resolve_team_id_for_request(client, team_id)
        response = client.request_checked(
            HttpMethod.DELETE,
            f"/folder/{resolved_folder}",
            team_id=request_team_id,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_list",
        annotations=READ_ONLY_TOOL,
        description="Retrieve metadata for a list via GET /list/{list_id}. Use get_tasks to list the tasks themselves.",
    )
    def get_list(
        ctx: Context,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the list to retrieve."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the list to retrieve."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Retrieve list metadata using GET /list/{list_id}.

        Use this tool for list details (e.g. statuses, settings). Call
        :func:`get_tasks` to enumerate the tasks that live in the list.
        """

        client = _get_or_create_client(ctx)
        resolved_list = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=list_id,
            list_name=list_name,
        )
        response = client.request_checked(HttpMethod.GET, f"/list/{resolved_list}")
        return response.to_jsonable()

    @server.tool(
        name="update_list",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Update list properties such as name or description via PUT /list/{list_id}.",
    )
    def update_list(
        ctx: Context,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the list to update."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the list to update."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
        name: Annotated[
            Optional[str],
            Field(default=None, description="New name for the list."),
        ] = None,
        content: Annotated[
            Optional[str],
            Field(default=None, description="Updated description."),
        ] = None,
        status: Annotated[
            Optional[str],
            Field(default=None, description="Updated status."),
        ] = None,
    ) -> Dict[str, Any]:
        """Update list metadata using PUT /list/{list_id}."""

        client = _get_or_create_client(ctx)
        resolved_list = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=list_id,
            list_name=list_name,
        )
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if content is not None:
            payload["content"] = content
        if status is not None:
            payload["status"] = status
        response = client.request_checked(
            HttpMethod.PUT,
            f"/list/{resolved_list}",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="delete_list",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Delete a list via DELETE /list/{list_id}.",
    )
    def delete_list(
        ctx: Context,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the list to delete."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the list to delete."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Delete a ClickUp list using DELETE /list/{list_id}."""

        client = _get_or_create_client(ctx)
        resolved_list = _resolve_list_identifier(
            client,
            team_id=team_id,
            list_id=list_id,
            list_name=list_name,
        )
        response = client.request_checked(HttpMethod.DELETE, f"/list/{resolved_list}")
        return response.to_jsonable()

    # ------------------------------------------------------------------
    # Tag management
    # ------------------------------------------------------------------
    @server.tool(
        name="get_space_tags",
        annotations=READ_ONLY_TOOL,
        description="List tags defined for a space via GET /space/{space_id}/tag.",
    )
    def get_space_tags(
        ctx: Context,
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the space."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the space."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """List tags configured for a space using GET /space/{space_id}/tag."""

        client = _get_or_create_client(ctx)
        resolved_space = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        response = client.request_checked(HttpMethod.GET, f"/space/{resolved_space}/tag")
        return response.to_jsonable()

    @server.tool(
        name="create_space_tag",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a tag within a space via POST /space/{space_id}/tag.",
    )
    def create_space_tag(
        ctx: Context,
        tag_name: Annotated[str, Field(description="Name of the tag to create.")],
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the space."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the space."),
        ] = None,
        tag_bg: Annotated[
            Optional[str],
            Field(default=None, description="Background color for the tag."),
        ] = None,
        tag_fg: Annotated[
            Optional[str],
            Field(default=None, description="Foreground color for the tag."),
        ] = None,
        color_command: Annotated[
            Optional[str],
            Field(default=None, description="Natural language color command."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a tag within a space using POST /space/{space_id}/tag."""

        client = _get_or_create_client(ctx)
        resolved_space = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        payload: Dict[str, Any] = {"tag": {"name": tag_name}}
        if tag_bg is not None:
            payload["tag"]["tag_bg"] = tag_bg
        if tag_fg is not None:
            payload["tag"]["tag_fg"] = tag_fg
        _maybe_apply_color_command(payload, color_command)
        response = client.request_checked(
            HttpMethod.POST,
            f"/space/{resolved_space}/tag",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="update_space_tag",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Update a tag's name or colours via PUT /space/{space_id}/tag/{tag_name}.",
    )
    def update_space_tag(
        ctx: Context,
        tag_name: Annotated[str, Field(description="Existing tag name.")],
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the space."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the space."),
        ] = None,
        new_tag_name: Annotated[
            Optional[str],
            Field(default=None, description="New name for the tag."),
        ] = None,
        tag_bg: Annotated[
            Optional[str],
            Field(default=None, description="Background color."),
        ] = None,
        tag_fg: Annotated[
            Optional[str],
            Field(default=None, description="Foreground color."),
        ] = None,
        color_command: Annotated[
            Optional[str],
            Field(default=None, description="Natural language color command."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Update a tag within a space using PUT /space/{space_id}/tag/{tag_name}."""

        client = _get_or_create_client(ctx)
        resolved_space = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        payload: Dict[str, Any] = {"tag": {}}
        if new_tag_name is not None:
            payload["tag"]["name"] = new_tag_name
        if tag_bg is not None:
            payload["tag"]["tag_bg"] = tag_bg
        if tag_fg is not None:
            payload["tag"]["tag_fg"] = tag_fg
        _maybe_apply_color_command(payload, color_command)
        response = client.request_checked(
            HttpMethod.PUT,
            f"/space/{resolved_space}/tag/{tag_name}",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="delete_space_tag",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Remove a tag from a space via DELETE /space/{space_id}/tag/{tag_name}.",
    )
    def delete_space_tag(
        ctx: Context,
        tag_name: Annotated[str, Field(description="Name of the tag to delete.")],
        space_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the space."),
        ] = None,
        space_name: Annotated[
            Optional[str],
            Field(default=None, description="Name of the space."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Delete a tag from a space using DELETE /space/{space_id}/tag/{tag_name}."""

        client = _get_or_create_client(ctx)
        resolved_space = client.resolve_space_id(
            team_id=team_id,
            space_id=space_id,
            space_name=space_name,
        )
        response = client.request_checked(
            HttpMethod.DELETE,
            f"/space/{resolved_space}/tag/{tag_name}",
        )
        return response.to_jsonable()

    @server.tool(
        name="add_tag_to_task",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Apply an existing tag to a task via POST /task/{task_id}/tag/{tag_name}.",
    )
    def add_tag_to_task(
        ctx: Context,
        tag_name: Annotated[str, Field(description="Name of the tag to add.")],
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name used when an identifier is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Add a tag to a task using POST /task/{task_id}/tag/{tag_name}."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )
        response = client.request_checked(
            HttpMethod.POST,
            f"/task/{resolved_task_id}/tag/{tag_name}",
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="remove_tag_from_task",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Remove a tag from a task via DELETE /task/{task_id}/tag/{tag_name}.",
    )
    def remove_tag_from_task(
        ctx: Context,
        tag_name: Annotated[str, Field(description="Tag to remove.")],
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name when identifier is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Remove a tag from a task using DELETE /task/{task_id}/tag/{tag_name}."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )
        response = client.request_checked(
            HttpMethod.DELETE,
            f"/task/{resolved_task_id}/tag/{tag_name}",
            query_params=query or None,
        )
        return response.to_jsonable()

    # ------------------------------------------------------------------
    # Time tracking
    # ------------------------------------------------------------------
    @server.tool(
        name="get_task_time_entries",
        annotations=READ_ONLY_TOOL,
        description="Retrieve logged time entries for a task via GET /task/{task_id}/time.",
    )
    def get_task_time_entries(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name used when identifier is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Retrieve logged time entries for a task using GET /task/{task_id}/time."""

        client = _get_or_create_client(ctx)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        query = _augment_task_query_params(
            client,
            resolved_task_id,
            team_id=team_id,
        )
        response = client.request_checked(
            HttpMethod.GET,
            f"/task/{resolved_task_id}/time",
            query_params=query or None,
        )
        return response.to_jsonable()

    @server.tool(
        name="start_time_tracking",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Start a timer on a task via POST /team/{team_id}/time_entries/start.",
    )
    def start_time_tracking(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task to track."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name used when identifier is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        description: Annotated[
            Optional[str],
            Field(default=None, description="Description for the time entry."),
        ] = None,
        billable: Annotated[
            Optional[bool],
            Field(default=None, description="Mark the timer as billable."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Start a ClickUp time tracking timer using POST /team/{team_id}/time_entries/start."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        payload: Dict[str, Any] = {"task_id": resolved_task_id}
        if description is not None:
            payload["description"] = description
        if billable is not None:
            payload["billable"] = bool(billable)
        response = client.request_checked(
            HttpMethod.POST,
            f"/team/{resolved_team}/time_entries/start",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="stop_time_tracking",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Stop the active timer via POST /team/{team_id}/time_entries/stop.",
    )
    def stop_time_tracking(
        ctx: Context,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Stop the active ClickUp timer using POST /team/{team_id}/time_entries/stop."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        response = client.request_checked(
            HttpMethod.POST,
            f"/team/{resolved_team}/time_entries/stop",
        )
        return response.to_jsonable()

    @server.tool(
        name="add_time_entry",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Log a manual time entry via POST /team/{team_id}/time_entries.",
    )
    def add_time_entry(
        ctx: Context,
        task_id: Annotated[
            Optional[str],
            Field(default=None, description="Identifier of the task."),
        ] = None,
        task_name: Annotated[
            Optional[str],
            Field(default=None, description="Task name when identifier is unavailable."),
        ] = None,
        list_id: Annotated[
            Optional[str],
            Field(default=None, description="List identifier used when resolving taskName."),
        ] = None,
        list_name: Annotated[
            Optional[str],
            Field(default=None, description="List name used when resolving taskName."),
        ] = None,
        start: Annotated[
            Any,
            Field(description="Start time in natural language or Unix timestamp."),
        ] = None,
        duration: Annotated[
            Optional[Any],
            Field(default=None, description="Duration in milliseconds or human readable form."),
        ] = None,
        description: Annotated[
            Optional[str],
            Field(default=None, description="Description of the time entry."),
        ] = None,
        billable: Annotated[
            Optional[bool],
            Field(default=None, description="Mark the time entry as billable."),
        ] = None,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Log manual time against a task using POST /team/{team_id}/time_entries."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        resolved_task_id = _resolve_task_identifier(
            client,
            team_id=team_id,
            task_id=task_id,
            task_name=task_name,
            list_id=list_id,
            list_name=list_name,
        )
        start_millis = _parse_date_field(start)
        if start_millis is None:
            raise ValueError("A start time is required when adding a time entry.")
        payload: Dict[str, Any] = {
            "task_id": resolved_task_id,
            "start": start_millis,
        }
        if duration is not None:
            parsed_duration = _parse_duration_field(duration)
            if parsed_duration is None:
                raise ValueError("Unable to interpret the provided duration.")
            payload["duration"] = parsed_duration
        if description is not None:
            payload["description"] = description
        if billable is not None:
            payload["billable"] = bool(billable)
        response = client.request_checked(
            HttpMethod.POST,
            f"/team/{resolved_team}/time_entries",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="delete_time_entry",
        annotations=DESTRUCTIVE_WRITE_TOOL,
        description="Delete a specific time entry via DELETE /team/{team_id}/time_entries/{time_entry_id}.",
    )
    def delete_time_entry(
        ctx: Context,
        time_entry_id: Annotated[str, Field(description="Identifier of the time entry to delete.")],
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Delete a time entry using DELETE /team/{team_id}/time_entries/{time_entry_id}."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        response = client.request_checked(
            HttpMethod.DELETE,
            f"/team/{resolved_team}/time_entries/{time_entry_id}",
        )
        return response.to_jsonable()

    @server.tool(
        name="get_current_time_entry",
        annotations=READ_ONLY_TOOL,
        description="Fetch the active timer for a team via GET /team/{team_id}/time_entries/current.",
    )
    def get_current_time_entry(
        ctx: Context,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Fetch the active timer for a team using GET /team/{team_id}/time_entries/current."""

        client = _get_or_create_client(ctx)
        resolved_team = client.ensure_team_id(team_id)
        response = client.request_checked(
            HttpMethod.GET,
            f"/team/{resolved_team}/time_entries/current",
        )
        return response.to_jsonable()

    # ------------------------------------------------------------------
    # Document management
    # ------------------------------------------------------------------
    @server.tool(
        name="create_document",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a ClickUp document via POST /workspaces/{workspace_id}/docs.",
    )
    def create_document(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier containing the document.")],
        name: Annotated[str, Field(description="Document name.")],
        parent_id: Annotated[
            Optional[str],
            Field(default=None, description="Parent container identifier."),
        ] = None,
        parent_type: Annotated[
            Optional[int],
            Field(default=None, description="Type of the parent container."),
        ] = None,
        visibility: Annotated[
            Optional[str],
            Field(default=None, description="Document visibility level."),
        ] = None,
        create_pages: Annotated[
            Optional[bool],
            Field(default=None, description="Automatically create a default page."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a ClickUp document using POST /workspaces/{workspace_id}/docs."""

        client = _get_or_create_client(ctx)
        payload: Dict[str, Any] = {
            "name": name,
        }
        if parent_id is not None:
            parent_payload: Dict[str, Any] = {"id": parent_id}
            if parent_type is not None:
                parent_payload["type"] = parent_type
            payload["parent"] = parent_payload
        if visibility is not None:
            payload["visibility"] = visibility
        if create_pages is not None:
            payload["create_pages"] = bool(create_pages)
        response = client.request_checked(
            HttpMethod.POST,
            f"/workspaces/{workspace_id}/docs",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_document",
        annotations=READ_ONLY_TOOL,
        description="Retrieve a document via GET /workspaces/{workspace_id}/docs/{document_id}.",
    )
    def get_document(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier.")],
        document_id: Annotated[str, Field(description="Identifier of the document to fetch.")],
    ) -> Dict[str, Any]:
        """Retrieve a ClickUp document using GET /workspaces/{workspace_id}/docs/{document_id}."""

        client = _get_or_create_client(ctx)
        response = client.request_checked(
            HttpMethod.GET,
            f"/workspaces/{workspace_id}/docs/{document_id}",
        )
        return response.to_jsonable()

    @server.tool(
        name="list_documents",
        annotations=READ_ONLY_TOOL,
        description="List documents in a workspace via GET /workspaces/{workspace_id}/docs with optional filters.",
    )
    def list_documents(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier.")],
        creator: Annotated[
            Optional[int],
            Field(default=None, description="Filter documents by creator identifier."),
        ] = None,
        deleted: Annotated[
            Optional[bool],
            Field(default=None, description="Include deleted documents."),
        ] = None,
        archived: Annotated[
            Optional[bool],
            Field(default=None, description="Include archived documents."),
        ] = None,
        parent_id: Annotated[
            Optional[str],
            Field(default=None, description="Filter by parent identifier."),
        ] = None,
        parent_type: Annotated[
            Optional[int],
            Field(default=None, description="Filter by parent type."),
        ] = None,
        limit: Annotated[
            Optional[int],
            Field(default=None, description="Maximum number of documents to return."),
        ] = None,
        next_cursor: Annotated[
            Optional[str],
            Field(default=None, description="Cursor for pagination."),
        ] = None,
    ) -> Dict[str, Any]:
        """List documents available in a workspace using GET /workspaces/{workspace_id}/docs."""

        client = _get_or_create_client(ctx)
        query: Dict[str, Any] = {}
        if creator is not None:
            query["creator"] = creator
        if deleted is not None:
            query["deleted"] = str(bool(deleted)).lower()
        if archived is not None:
            query["archived"] = str(bool(archived)).lower()
        if parent_id is not None:
            query["parent_id"] = parent_id
        if parent_type is not None:
            query["parent_type"] = parent_type
        if limit is not None:
            query["limit"] = limit
        if next_cursor is not None:
            query["next_cursor"] = next_cursor
        response = client.request_checked(
            HttpMethod.GET,
            f"/workspaces/{workspace_id}/docs",
            query_params=query,
        )
        return response.to_jsonable()

    @server.tool(
        name="list_document_pages",
        annotations=READ_ONLY_TOOL,
        description="List pages for a document via GET /workspaces/{workspace_id}/docs/{document_id}/pages.",
    )
    def list_document_pages(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier.")],
        document_id: Annotated[str, Field(description="Document identifier.")],
        max_page_depth: Annotated[
            Optional[int],
            Field(default=None, description="Maximum depth of nested pages (-1 for unlimited)."),
        ] = None,
    ) -> Dict[str, Any]:
        """List the pages that belong to a document using GET /workspaces/{workspace_id}/docs/{document_id}/pages."""

        client = _get_or_create_client(ctx)
        query = {}
        if max_page_depth is not None:
            query["max_page_depth"] = max_page_depth
        response = client.request_checked(
            HttpMethod.GET,
            f"/workspaces/{workspace_id}/docs/{document_id}/pages",
            query_params=query,
        )
        return response.to_jsonable()

    @server.tool(
        name="get_document_pages",
        annotations=READ_ONLY_TOOL,
        description="Fetch specific document pages and content via POST /workspaces/{workspace_id}/docs/{document_id}/pages/bulk.",
    )
    def get_document_pages(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier.")],
        document_id: Annotated[str, Field(description="Document identifier.")],
        page_ids: Annotated[
            Sequence[str],
            Field(description="Collection of page identifiers to retrieve."),
        ],
        content_format: Annotated[
            Optional[str],
            Field(default=None, description="Desired content format (text/md, text/html, etc.)."),
        ] = None,
    ) -> Dict[str, Any]:
        """Fetch specific document pages using POST /workspaces/{workspace_id}/docs/{document_id}/pages/bulk."""

        client = _get_or_create_client(ctx)
        payload: Dict[str, Any] = {"page_ids": list(page_ids)}
        if content_format is not None:
            payload["content_format"] = content_format
        response = client.request_checked(
            HttpMethod.POST,
            f"/workspaces/{workspace_id}/docs/{document_id}/pages/bulk",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="create_document_pages",
        annotations=NON_DESTRUCTIVE_WRITE_TOOL,
        description="Create a document page via POST /workspaces/{workspace_id}/docs/{document_id}/pages.",
    )
    def create_document_pages(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier.")],
        document_id: Annotated[str, Field(description="Document identifier.")],
        name: Annotated[str, Field(description="Name of the page.")],
        content: Annotated[
            Optional[str],
            Field(default=None, description="Page content."),
        ] = None,
        content_format: Annotated[
            Optional[str],
            Field(default=None, description="Content format (e.g. text/md)."),
        ] = None,
        parent_page_id: Annotated[
            Optional[str],
            Field(default=None, description="Parent page identifier to create a subpage."),
        ] = None,
        sub_title: Annotated[
            Optional[str],
            Field(default=None, description="Optional subtitle."),
        ] = None,
    ) -> Dict[str, Any]:
        """Create a page within a document using POST /workspaces/{workspace_id}/docs/{document_id}/pages."""

        client = _get_or_create_client(ctx)
        payload: Dict[str, Any] = {"name": name}
        if content is not None:
            payload["content"] = content
        if content_format is not None:
            payload["content_format"] = content_format
        if parent_page_id is not None:
            payload["parent_page_id"] = parent_page_id
        if sub_title is not None:
            payload["sub_title"] = sub_title
        response = client.request_checked(
            HttpMethod.POST,
            f"/workspaces/{workspace_id}/docs/{document_id}/pages",
            json_body=payload,
        )
        return response.to_jsonable()

    @server.tool(
        name="update_document_page",
        annotations=IDEMPOTENT_WRITE_TOOL,
        description="Update a document page via PUT /workspaces/{workspace_id}/docs/{document_id}/pages/{page_id}.",
    )
    def update_document_page(
        ctx: Context,
        workspace_id: Annotated[str, Field(description="Workspace identifier.")],
        document_id: Annotated[str, Field(description="Document identifier.")],
        page_id: Annotated[str, Field(description="Page identifier." )],
        name: Annotated[
            Optional[str],
            Field(default=None, description="Updated page name."),
        ] = None,
        sub_title: Annotated[
            Optional[str],
            Field(default=None, description="Updated subtitle."),
        ] = None,
        content: Annotated[
            Optional[str],
            Field(default=None, description="Updated content."),
        ] = None,
        content_format: Annotated[
            Optional[str],
            Field(default=None, description="Format of the provided content."),
        ] = None,
        content_edit_mode: Annotated[
            Optional[str],
            Field(default=None, description="replace, append, or prepend."),
        ] = None,
    ) -> Dict[str, Any]:
        """Update a document page using PUT /workspaces/{workspace_id}/docs/{document_id}/pages/{page_id}."""

        client = _get_or_create_client(ctx)
        payload: Dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if sub_title is not None:
            payload["sub_title"] = sub_title
        if content is not None:
            payload["content"] = content
        if content_format is not None:
            payload["content_format"] = content_format
        if content_edit_mode is not None:
            payload["content_edit_mode"] = content_edit_mode
        response = client.request_checked(
            HttpMethod.PUT,
            f"/workspaces/{workspace_id}/docs/{document_id}/pages/{page_id}",
            json_body=payload,
        )
        return response.to_jsonable()

    # ------------------------------------------------------------------
    # Member management
    # ------------------------------------------------------------------
    @server.tool(
        name="get_workspace_members",
        annotations=READ_ONLY_TOOL,
        description="List members of a workspace via GET /team/{team_id}/member.",
    )
    def get_workspace_members(
        ctx: Context,
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """List workspace members using GET /team/{team_id}/member."""

        client = _get_or_create_client(ctx)
        members = client.get_workspace_members(team_id)
        return {"members": members}

    @server.tool(
        name="find_member_by_name",
        annotations=READ_ONLY_TOOL,
        description="Find a member by name or email using cached workspace membership data.",
    )
    def find_member_by_name(
        ctx: Context,
        name_or_email: Annotated[str, Field(description="Name or email to search for." )],
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Resolve a member object by fuzzy matching against username, full name, or email."""

        client = _get_or_create_client(ctx)
        members = client.get_workspace_members(team_id)
        normalized = name_or_email.strip().lower()
        for member in members:
            if normalized in {
                str(member.get("username", "")).lower(),
                str(member.get("email", "")).lower(),
                str(member.get("full_name", "")).lower(),
            }:
                return {"member": member}
        return {"member": None}

    @server.tool(
        name="resolve_assignees",
        annotations=READ_ONLY_TOOL,
        description="Resolve assignee identifiers from user-provided names, emails, or IDs using cached membership data.",
    )
    def resolve_assignees(
        ctx: Context,
        assignees: Annotated[Sequence[Any], Field(description="Identifiers, names, or emails to resolve." )],
        team_id: Annotated[
            Optional[int],
            Field(default=None, description="Team identifier overriding the session default."),
        ] = None,
    ) -> Dict[str, Any]:
        """Resolve assignee identifiers using the cached workspace membership list."""

        client = _get_or_create_client(ctx)
        resolved = _normalize_assignees(client, team_id=team_id, assignees=assignees)
        return {"userIds": resolved or []}

    @server.resource(
        "clickup://guide/tools",
        description="Human-oriented summary of the ClickUp MCP tools, including usage notes and safety hints.",
    )
    def tool_reference() -> str:
        """Return a Markdown catalogue of all registered tools and their safety hints."""

        lines: list[str] = [
            "# ClickUp MCP tool reference",
            "",
            "This catalogue lists every MCP tool exposed by the ClickUp server, "
            "including whether each tool is read-only and if it may perform destructive actions.",
            "Use it to choose the most appropriate tool for a given request.",
            "",
        ]

        for tool in sorted(server._fastmcp._tool_manager.list_tools(), key=lambda t: t.name):
            annotations = tool.annotations or ToolAnnotations()
            lines.append(f"## {tool.name}")
            description = (tool.description or "").strip()
            if description:
                lines.append(description)
            read_only = "Yes" if annotations.readOnlyHint else "No"
            destructive = "Yes" if annotations.destructiveHint else "No"
            idempotent = "Yes" if annotations.idempotentHint else "No"
            lines.append("")
            lines.append("* **Read-only:** " + read_only)
            lines.append("* **Destructive:** " + destructive)
            lines.append("* **Idempotent:** " + idempotent)
            lines.append("")

        return "\n".join(lines).strip()

    return server
