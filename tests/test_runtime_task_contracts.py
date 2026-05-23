from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        if path == "task/task-1":
            return {
                "id": "task-1",
                "name": "Primary task",
                "status": {"status": "in progress", "type": "custom"},
                "priority": {"priority": "2"},
                "date_created": "1700000000000",
                "date_updated": "1700003600000",
                "list": {"id": "list-1", "name": "Backlog", "url": "https://example.com/list-1"},
                "assignees": [
                    {"id": "user-1", "username": "alice"},
                    {"id": "user-2", "username": "bob"},
                    {"id": "user-3", "username": "charlie"},
                ],
                "subtask_count": 2,
                "url": "https://example.com/task-1",
            }
        if path == "list/list-1/task":
            return {
                "tasks": [
                    {
                        "id": "task-1",
                        "name": "Primary task",
                        "status": {"status": "open", "type": "open"},
                        "date_created": "1700000000000",
                        "date_updated": "1700003600000",
                        "list": {"id": "list-1", "name": "Backlog", "url": "https://example.com/list-1"},
                        "assignees": [
                            {"id": "user-1", "username": "alice"},
                            {"id": "user-2", "username": "bob"},
                            {"id": "user-3", "username": "charlie"},
                            {"id": "user-4", "username": "dana"},
                            {"id": "user-5", "username": "evan"},
                            {"id": "user-6", "username": "fran"},
                        ],
                    },
                    {
                        "id": "task-2",
                        "name": "Secondary task",
                        "status": {"status": "closed", "type": "closed"},
                        "date_created": "1700007200000",
                        "date_updated": "1700010800000",
                        "list": {"id": "list-1", "name": "Backlog", "url": "https://example.com/list-1"},
                        "assignees": [],
                    },
                ]
            }
        raise AssertionError(f"Unexpected request path: {path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_task_read_returns_normalized_task_and_honors_detail_limit() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("task_read", {"taskId": "task-1", "detailLimit": 2})
    )

    assert client.calls == [{"path": "task/task-1"}]
    assert payload["id"] == "task-1"
    assert payload["createdDate"] == "2023-11-14T22:13:20Z"
    assert payload["updatedDate"] == "2023-11-14T23:13:20Z"
    assert payload["listId"] == "list-1"
    assert payload["listName"] == "Backlog"
    assert payload["listUrl"] == "https://example.com/list-1"
    assert len(payload["assignees"]) == 2
    assert payload["assigneesTruncated"] is True
    assert payload["subtaskCount"] == 2


def test_task_list_for_list_honors_defaults_and_assignee_preview_limit() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("task_list_for_list", {"listId": "list-1"})
    )

    assert client.calls == [
        {
            "path": "list/list-1/task",
            "params": {
                "page": 0,
                "subtasks": True,
                "include_timl": True,
                "include_closed": False,
            },
        }
    ]
    assert payload["total"] == 2
    assert len(payload["tasks"]) == 2
    assert payload["tasks"][0]["createdDate"] == "2023-11-14T22:13:20Z"
    assert payload["tasks"][0]["updatedDate"] == "2023-11-14T23:13:20Z"
    assert len(payload["tasks"][0]["assignees"]) == 5
    assert payload["tasks"][0]["assigneesTruncated"] is True


def test_task_list_for_list_applies_limit_argument() -> None:
    runtime, _client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("task_list_for_list", {"listId": "list-1", "limit": 1})
    )

    assert payload["total"] == 2
    assert len(payload["tasks"]) == 1
    assert payload["tasks"][0]["id"] == "task-1"
