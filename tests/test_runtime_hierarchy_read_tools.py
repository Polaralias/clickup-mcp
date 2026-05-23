from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        if path == "team":
            return {"teams": [{"id": "workspace-123", "name": "Workspace A"}]}
        if path == "team/workspace-123/space":
            return {"spaces": [{"id": "space-1", "name": "Planning"}]}
        if path == "space/space-1/folder":
            return {"folders": []}
        if path == "space/space-1/list":
            return {"lists": [{"id": "list-1", "name": "Backlog"}]}
        if path == "folder/folder-1/list":
            return {"lists": [{"id": "list-2", "name": "Folder List"}]}
        raise AssertionError(f"Unexpected request path={path!r} kwargs={kwargs!r}")

    def request_v3(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs, "v3": True})
        if path == "workspaces/workspace-123/docs":
            return {"docs": []}
        raise AssertionError(f"Unexpected request_v3 path={path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_workspace_capability_snapshot_reports_docs_availability() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("workspace_capability_snapshot", {"workspaceId": "workspace-123"})
    )

    assert payload == {"workspaceId": "workspace-123", "docsAvailable": True}
    assert client.calls == [
        {
            "path": "workspaces/workspace-123/docs",
            "params": {"limit": 1},
            "v3": True,
        }
    ]


def test_workspace_and_space_listing_tools_return_wrapped_payloads() -> None:
    runtime, client = _runtime()

    workspace_payload = asyncio.run(runtime.dispatch("workspace_list", {}))
    space_payload = asyncio.run(runtime.dispatch("space_list_for_workspace", {"workspaceId": "workspace-123"}))
    folder_payload = asyncio.run(runtime.dispatch("folder_list_for_space", {"spaceId": "space-1"}))
    list_payload = asyncio.run(runtime.dispatch("list_list_for_space_or_folder", {"spaceId": "space-1"}))

    assert workspace_payload == {"teams": [{"id": "workspace-123", "name": "Workspace A"}]}
    assert space_payload == {"spaces": [{"id": "space-1", "name": "Planning"}]}
    assert folder_payload == {"folders": []}
    assert list_payload == {"lists": [{"id": "list-1", "name": "Backlog"}]}
    assert client.calls == [
        {"path": "team"},
        {"path": "team/workspace-123/space"},
        {"path": "space/space-1/folder"},
        {"path": "space/space-1/list"},
    ]


def test_workspace_overview_and_resolve_path_use_hierarchy_names() -> None:
    runtime, client = _runtime()

    overview = asyncio.run(runtime.dispatch("workspace_overview", {"workspaceId": "workspace-123"}))
    resolved = asyncio.run(runtime.dispatch("hierarchy_resolve_path", {"path": ["Workspace A", "Planning", "Backlog"]}))

    assert overview == {
        "workspaceId": "workspace-123",
        "spaces": [{"id": "space-1", "name": "Planning"}],
        "spaceCount": 1,
    }
    assert resolved == {
        "workspaceId": "workspace-123",
        "workspaceName": "Workspace A",
        "spaceId": "space-1",
        "spaceName": "Planning",
        "listId": "list-1",
        "listName": "Backlog",
    }
    assert client.calls == [
        {"path": "team/workspace-123/space"},
        {"path": "team"},
        {"path": "space/space-1/folder"},
        {"path": "space/space-1/list"},
    ]
