from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        method = kwargs.get("method")
        if path == "team/workspace-123/time_entries/start" and method == "POST":
            return {"data": {"timer_started": True}}
        if path == "team/workspace-123/time_entries/stop" and method == "POST":
            return {"data": {"timer_stopped": True}}
        if path == "team/workspace-123/time_entries" and method == "POST":
            return {"id": "entry-1"}
        if path == "team/workspace-123/time_entries/entry-1" and method == "PUT":
            return {"data": [{"id": "entry-1", "description": "updated"}]}
        if path == "team/workspace-123/time_entries/entry-1" and method == "DELETE":
            return {}
        if path == "team/workspace-123/time_entries/current":
            return {"data": None}
        raise AssertionError(f"Unexpected request path={path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_task_timer_start_uses_workspace_time_start_endpoint() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("task_timer_start", {"confirm": "yes", "taskId": "task-1"})
    )

    assert payload == {"data": {"timer_started": True}}
    assert client.calls == [
        {
            "path": "team/workspace-123/time_entries/start",
            "method": "POST",
            "body": {"tid": "task-1"},
        }
    ]


def test_task_timer_stop_uses_workspace_time_stop_endpoint() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("task_timer_stop", {"confirm": "yes", "taskId": "task-1"})
    )

    assert payload == {"data": {"timer_stopped": True}}
    assert client.calls == [
        {
            "path": "team/workspace-123/time_entries/stop",
            "method": "POST",
        }
    ]


def test_time_entry_create_for_task_uses_workspace_time_entry_endpoint() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "time_entry_create_for_task",
            {
                "confirm": "yes",
                "taskId": "task-1",
                "start": "2026-05-23T10:00:00Z",
                "end": "2026-05-23T10:01:00Z",
                "description": "manual entry",
            },
        )
    )

    assert payload == {"id": "entry-1"}
    assert client.calls == [
        {
            "path": "team/workspace-123/time_entries",
            "method": "POST",
            "body": {
                "start": 1779530400000,
                "end": 1779530460000,
                "description": "manual entry",
                "tid": "task-1",
            },
        }
    ]


def test_time_entry_update_delete_and_current_use_workspace_endpoints() -> None:
    runtime, client = _runtime()

    updated = asyncio.run(
        runtime.dispatch(
            "time_entry_update",
            {
                "confirm": "yes",
                "entryId": "entry-1",
                "start": "2026-05-23T10:00:00Z",
                "end": "2026-05-23T10:02:00Z",
                "description": "updated",
            },
        )
    )
    deleted = asyncio.run(
        runtime.dispatch("time_entry_delete", {"confirm": "yes", "entryId": "entry-1"})
    )
    current = asyncio.run(runtime.dispatch("time_entry_current", {}))

    assert updated == {"data": [{"id": "entry-1", "description": "updated"}]}
    assert deleted == {}
    assert current == {"data": None}
    assert client.calls == [
        {
            "path": "team/workspace-123/time_entries/entry-1",
            "method": "PUT",
            "body": {
                "start": 1779530400000,
                "end": 1779530520000,
                "description": "updated",
            },
        },
        {
            "path": "team/workspace-123/time_entries/entry-1",
            "method": "DELETE",
        },
        {
            "path": "team/workspace-123/time_entries/current",
        },
    ]
