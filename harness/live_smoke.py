from __future__ import annotations

import asyncio
import os
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def _load_env_file() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    env_path = repo_root / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if len(value) >= 2 and value[:1] == value[-1:] and value[:1] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


_load_env_file()

import server


@dataclass(frozen=True)
class LiveSmokeConfig:
    workspace_id: str
    space_id: str
    doc_id: str
    write_mode: str


def has_live_smoke_config() -> bool:
    return bool(
        _env("CLICKUP_API_TOKEN", "apiKey", "API_KEY")
        and _env("CLICKUP_TEAM_ID", "TEAM_ID")
        and os.getenv("CLICKUP_LIVE_SMOKE_SPACE_ID", "").strip()
        and os.getenv("CLICKUP_LIVE_SMOKE_DOC_ID", "").strip()
    )


def load_live_smoke_config() -> LiveSmokeConfig:
    workspace_id = _env("CLICKUP_TEAM_ID", "TEAM_ID")
    space_id = os.getenv("CLICKUP_LIVE_SMOKE_SPACE_ID", "").strip()
    doc_id = os.getenv("CLICKUP_LIVE_SMOKE_DOC_ID", "").strip()
    token = _env("CLICKUP_API_TOKEN", "apiKey", "API_KEY")

    missing: list[str] = []
    if not token:
        missing.append("CLICKUP_API_TOKEN")
    if not workspace_id:
        missing.append("CLICKUP_TEAM_ID")
    if not space_id:
        missing.append("CLICKUP_LIVE_SMOKE_SPACE_ID")
    if not doc_id:
        missing.append("CLICKUP_LIVE_SMOKE_DOC_ID")
    if missing:
        raise RuntimeError("Missing live smoke env: " + ", ".join(missing))

    return LiveSmokeConfig(
        workspace_id=workspace_id,
        space_id=space_id,
        doc_id=doc_id,
        write_mode=server.runtime_config.write_access.mode,
    )


def skip_reason() -> str:
    try:
        config = load_live_smoke_config()
    except RuntimeError as exc:
        return str(exc)
    if config.write_mode == "read":
        return "WRITE_MODE/read-only configuration blocks live smoke mutations"
    return ""


def dispatch(name: str, args: dict[str, Any]) -> dict[str, Any]:
    return asyncio.run(server.runtime.dispatch(name, args))


def client() -> server.ClickUpClient:
    return server.ClickUpClient(server._clickup_token())


def unique_name(prefix: str) -> str:
    stamp = int(time.time())
    suffix = uuid.uuid4().hex[:8]
    return f"{prefix}-{stamp}-{suffix}"


def raw_member_listing(workspace_id: str) -> list[dict[str, Any]]:
    payload = client().request(f"team/{workspace_id}")
    team = payload.get("team", {}) if isinstance(payload, dict) else {}
    members = team.get("members", []) if isinstance(team, dict) else []
    return members if isinstance(members, list) else []


def raw_doc_page_listing(workspace_id: str, doc_id: str) -> list[dict[str, Any]]:
    payload = client().request_v3(f"workspaces/{workspace_id}/docs/{doc_id}/page_listing")
    if isinstance(payload, list):
        return [page for page in payload if isinstance(page, dict)]
    pages = payload.get("pages", []) if isinstance(payload, dict) else []
    return [page for page in pages if isinstance(page, dict)]


def raw_doc_pages(workspace_id: str, doc_id: str) -> list[dict[str, Any]]:
    payload = client().request_v3(f"workspaces/{workspace_id}/docs/{doc_id}/pages")
    if isinstance(payload, list):
        return [page for page in payload if isinstance(page, dict)]
    pages = payload.get("pages", []) if isinstance(payload, dict) else []
    return [page for page in pages if isinstance(page, dict)]


def raw_doc_page_read(workspace_id: str, doc_id: str, page_id: str) -> dict[str, Any]:
    payload = client().request_v3(f"workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}")
    if not isinstance(payload, dict):
        raise RuntimeError("Expected dict payload when reading doc page")
    return payload


def raw_task_read(task_id: str) -> dict[str, Any]:
    payload = client().request(f"task/{task_id}")
    if not isinstance(payload, dict):
        raise RuntimeError("Expected dict payload when reading task")
    return payload


def raw_time_entry_create(task_id: str, *, start: int, end: int, description: str = "") -> dict[str, Any]:
    payload = client().request(
        f"task/{task_id}/time",
        method="POST",
        body={"start": start, "end": end, "description": description},
    )
    if not isinstance(payload, dict):
        raise RuntimeError("Expected dict payload when creating time entry")
    return payload


def raw_time_entry_delete(workspace_id: str, entry_id: str) -> Any:
    return client().request(f"team/{workspace_id}/time_entries/{entry_id}", method="DELETE")


def create_space_tag(space_id: str, name: str, foreground: str = "#111111", background: str = "#22aa22") -> Any:
    return client().request(
        f"space/{space_id}/tag",
        method="POST",
        body={
            "tag": {
                "name": name,
                "tag_fg": foreground,
                "tag_bg": background,
            }
        },
    )


def delete_space_tag(space_id: str, name: str) -> Any:
    return client().request(f"space/{space_id}/tag/{name}", method="DELETE")


def _env(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return ""
