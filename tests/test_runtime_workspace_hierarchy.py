from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append(path)
        if path == "team":
            return {
                "teams": [
                    {"id": "workspace-1", "name": "Alpha"},
                    {"id": "workspace-2", "name": "Beta"},
                ]
            }
        if path == "team/workspace-1/space":
            return {"spaces": [{"id": "space-a", "name": "Planning"}]}
        if path == "team/workspace-2/space":
            return {"spaces": [{"id": "space-b", "name": "Ops"}]}
        if path == "space/space-a/folder":
            return {"folders": [{"id": "folder-a", "name": "Folder A"}]}
        if path == "space/space-b/folder":
            return {"folders": [{"id": "folder-b", "name": "Folder B"}]}
        if path == "space/space-a/list":
            return {"lists": [{"id": "list-a", "name": "List A"}]}
        if path == "space/space-b/list":
            return {"lists": [{"id": "list-b", "name": "List B"}]}
        if path == "folder/folder-a/list":
            return {"lists": [{"id": "folder-list-a", "name": "Folder List A"}]}
        if path == "folder/folder-b/list":
            return {"lists": [{"id": "folder-list-b", "name": "Folder List B"}]}
        raise AssertionError(f"Unexpected request: {path!r} {kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-1"),
    )
    return runtime, client


def test_workspace_hierarchy_supports_multi_workspace_inputs_and_max_depth() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "workspace_hierarchy",
            {
                "workspaceNames": ["Alpha", "Beta"],
                "maxWorkspaces": 1,
                "maxDepth": 1,
            },
        )
    )

    assert client.calls == ["team", "team/workspace-1/space"]
    assert payload["count"] == 1
    assert payload["workspaces"] == [
        {
            "workspaceId": "workspace-1",
            "workspaceName": "Alpha",
            "hierarchy": [
                {"space": {"id": "space-a", "name": "Planning"}, "folders": [], "lists": []}
            ],
        }
    ]
    assert payload["workspaceId"] == "workspace-1"
    assert len(payload["hierarchy"]) == 1


def test_workspace_hierarchy_force_refresh_busts_cache() -> None:
    runtime, client = _runtime()

    first = asyncio.run(runtime.dispatch("workspace_hierarchy", {"workspaceIds": ["workspace-1"], "maxDepth": 0}))
    second = asyncio.run(
        runtime.dispatch(
            "workspace_hierarchy",
            {"workspaceIds": ["workspace-1"], "maxDepth": 0, "forceRefresh": True},
        )
    )

    assert first["count"] == 1
    assert second["count"] == 1
    assert client.calls == ["team", "team/workspace-1/space", "team", "team/workspace-1/space"]


def test_workspace_hierarchy_depth_three_includes_folder_and_space_lists() -> None:
    runtime, _client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("workspace_hierarchy", {"workspaceIds": ["workspace-1"], "maxDepth": 3})
    )

    entry = payload["workspaces"][0]["hierarchy"][0]
    assert entry["lists"] == [{"id": "list-a", "name": "List A"}]
    assert entry["folders"] == [
        {
            "folder": {"id": "folder-a", "name": "Folder A"},
            "lists": [{"id": "folder-list-a", "name": "Folder List A"}],
        }
    ]
