from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        params = kwargs.get("params") or {}

        if path == "team/workspace-123/time_entries":
            task_id = params.get("task_id")
            list_id = params.get("list_id")
            if task_id == "task-1":
                return {
                    "data": [
                        {
                            "id": "entry-1",
                            "duration": "60000",
                            "task": {"id": "task-1", "name": "Tagged task"},
                            "task_location": {"list_id": "list-1", "space_id": "space-1"},
                        },
                        {
                            "id": "entry-2",
                            "duration": "30000",
                            "task": {"id": "task-1", "name": "Tagged task"},
                            "task_location": {"list_id": "list-1", "space_id": "space-1"},
                        },
                    ]
                }
            if task_id == "task-2":
                return {
                    "data": [
                        {
                            "id": "entry-3",
                            "duration": "15000",
                            "task": {"id": "task-2", "name": "View task"},
                            "task_location": {"list_id": "list-1", "space_id": "space-1"},
                        }
                    ]
                }
            if list_id == "list-1":
                return {
                    "data": [
                        {
                            "id": "entry-10",
                            "duration": "45000",
                            "task": {"id": "task-10", "name": "Container task"},
                            "task_location": {"list_id": "list-1", "space_id": "space-1"},
                        }
                    ]
                }
            return {"data": []}

        if path == "team/workspace-123/task":
            if params.get("tags[]") == ["alpha"]:
                return {
                    "tasks": [
                        {
                            "id": "task-1",
                            "name": "Tagged task",
                            "status": {"status": "open", "type": "open"},
                            "tags": [{"name": "alpha"}],
                            "parent": None,
                        }
                    ]
                }
            if params.get("space_ids[]") == ["space-1"] and params.get("tags[]") == ["alpha"]:
                return {
                    "tasks": [
                        {
                            "id": "task-1",
                            "name": "Tagged task",
                            "status": {"status": "open", "type": "open"},
                            "tags": [{"name": "alpha"}],
                            "parent": None,
                        }
                    ]
                }
            raise AssertionError(f"Unexpected team task params: {params!r}")

        if path == "view/view-1/task":
            return {
                "tasks": [
                    {
                        "id": "task-2",
                        "name": "View task",
                        "status": {"status": "open", "type": "open"},
                        "tags": [],
                        "parent": None,
                    }
                ]
            }

        raise AssertionError(f"Unexpected request path={path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_time_entry_list_returns_normalized_entries_and_honors_defaults() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "time_entry_list",
            {
                "taskId": "task-1",
                "from": "2026-05-01T00:00:00Z",
                "to": "2026-05-02T00:00:00Z",
            },
        )
    )

    assert client.calls == [
        {
                "path": "team/workspace-123/time_entries",
                "params": {
                    "start_date": 1777593600000,
                    "end_date": 1777680000000,
                    "page": 0,
                    "task_id": "task-1",
                    "include_location_names": True,
                },
        }
    ]
    assert payload["entryCount"] == 2
    assert payload["totalDurationMs"] == 90000
    assert payload["page"] == 0
    assert payload["pageSize"] == 20
    assert payload["entries"][0]["id"] == "entry-1"


def test_task_time_entry_list_composes_over_time_entry_list() -> None:
    runtime, _client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("task_time_entry_list", {"taskId": "task-1", "pageSize": 1})
    )

    assert payload["entryCount"] == 1
    assert payload["totalDurationMs"] == 60000
    assert payload["entries"][0]["id"] == "entry-1"


def test_time_report_for_container_uses_direct_location_filter() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "time_report_for_container",
            {
                "containerType": "list",
                "containerId": "list-1",
            },
        )
    )

    assert client.calls == [
        {
            "path": "team/workspace-123/time_entries",
            "params": {
                "start_date": None,
                "end_date": None,
                "page": 0,
                "list_id": "list-1",
                "include_location_names": True,
            },
        }
    ]
    assert payload["scope"] == {
        "workspaceId": "workspace-123",
        "containerType": "list",
        "containerId": "list-1",
    }
    assert payload["entryCount"] == 1
    assert payload["totalDurationMs"] == 45000
    assert payload["taskCount"] == 1


def test_time_report_for_tag_searches_tasks_then_aggregates_task_entries() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "time_report_for_tag",
            {
                "tag": "alpha",
            },
        )
    )

    assert client.calls == [
        {
            "path": "team/workspace-123/task",
            "params": {
                "page": 0,
                "page_size": 50,
                "order_by": "updated",
                "reverse": True,
                "subtasks": True,
                "include_timl": True,
                "tags[]": ["alpha"],
            },
        },
        {
            "path": "team/workspace-123/time_entries",
            "params": {
                "start_date": None,
                "end_date": None,
                "page": 0,
                "task_id": "task-1",
                "include_location_names": True,
            },
        },
    ]
    assert payload["scope"] == {
        "workspaceId": "workspace-123",
        "tag": "alpha",
    }
    assert payload["entryCount"] == 2
    assert payload["totalDurationMs"] == 90000
    assert payload["taskCount"] == 1


def test_time_report_for_context_supports_view_task_composition() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "time_report_for_context",
            {
                "viewId": "view-1",
            },
        )
    )

    assert client.calls == [
        {
            "path": "view/view-1/task",
            "params": {"page": 0},
        },
        {
            "path": "team/workspace-123/time_entries",
            "params": {
                "start_date": None,
                "end_date": None,
                "page": 0,
                "task_id": "task-2",
                "include_location_names": True,
            },
        },
    ]
    assert payload["scope"] == {
        "workspaceId": "workspace-123",
        "viewId": "view-1",
    }
    assert payload["entryCount"] == 1
    assert payload["totalDurationMs"] == 15000
    assert payload["taskCount"] == 1


def test_time_report_for_space_tag_scopes_task_search_to_space() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "time_report_for_space_tag",
            {
                "spaceId": "space-1",
                "tag": "alpha",
            },
        )
    )

    assert client.calls == [
        {
            "path": "team/workspace-123/task",
            "params": {
                "page": 0,
                "page_size": 50,
                "order_by": "updated",
                "reverse": True,
                "space_ids[]": ["space-1"],
                "subtasks": True,
                "include_timl": True,
                "tags[]": ["alpha"],
            },
        },
        {
            "path": "team/workspace-123/time_entries",
            "params": {
                "start_date": None,
                "end_date": None,
                "page": 0,
                "task_id": "task-1",
                "include_location_names": True,
            },
        },
    ]
    assert payload["scope"] == {
        "workspaceId": "workspace-123",
        "spaceId": "space-1",
        "tag": "alpha",
    }
    assert payload["entryCount"] == 2
    assert payload["totalDurationMs"] == 90000
