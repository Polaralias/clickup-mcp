from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        if path == "task/task-1" and not kwargs:
            return {
                "id": "task-1",
                "name": "Original task",
                "description": "Copied description",
                "status": {"status": "in progress"},
                "priority": {"priority": "2"},
                "assignees": [
                    {"id": "user-1", "username": "alice"},
                    {"id": "user-2", "username": "bob"},
                ],
                "tags": [
                    {"name": "alpha"},
                    {"name": "beta"},
                ],
                "due_date": "1700000000000",
                "list": {"id": "list-source"},
            }
        if path.startswith("list/") and path.endswith("/task") and kwargs.get("method") == "POST":
            return {"id": f"created-{len(self.calls)}"}
        if path.startswith("task/") and kwargs.get("method") == "PUT":
            return {"id": path.split("/")[-1], "updated": True}
        if path.startswith("task/") and kwargs.get("method") == "DELETE":
            return {"id": path.split("/")[-1], "deleted": True}
        if "/tag/" in path and kwargs.get("method") == "POST":
            parts = path.split("/")
            return {"taskId": parts[1], "tag": parts[-1], "added": True}
        raise AssertionError(f"Unexpected request: path={path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_task_duplicate_reads_source_task_and_creates_copy() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "task_duplicate",
            {
                "confirm": "yes",
                "taskId": "task-1",
                "includeAssignees": True,
            },
        )
    )

    assert client.calls == [
        {"path": "task/task-1"},
        {
            "path": "list/list-source/task",
            "method": "POST",
            "body": {
                "name": "Original task",
                "description": "Copied description",
                "status": "in progress",
                "priority": "2",
                "assignees": ["user-1", "user-2"],
                "tags": ["alpha", "beta"],
                "due_date": 1700000000000,
            },
        },
    ]
    assert payload == {"id": "created-2"}


def test_task_create_bulk_creates_each_task_with_defaults() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "task_create_bulk",
            {
                "confirm": "yes",
                "defaults": {
                    "listId": "list-default",
                    "priority": 3,
                    "tags": ["shared"],
                    "dueDate": "2026-05-22T10:00:00Z",
                },
                "tasks": [
                    {"name": "Task one"},
                    {"listId": "list-override", "name": "Task two", "tags": ["custom"]},
                ],
            },
        )
    )

    assert client.calls == [
        {
            "path": "list/list-default/task",
            "method": "POST",
                "body": {
                    "name": "Task one",
                    "priority": 3,
                    "tags": ["shared"],
                    "due_date": 1779444000000,
                },
            },
            {
                "path": "list/list-override/task",
            "method": "POST",
                "body": {
                    "name": "Task two",
                    "priority": 3,
                    "tags": ["custom"],
                    "due_date": 1779444000000,
                },
            },
        ]
    assert payload == {
        "results": [{"id": "created-1"}, {"id": "created-2"}],
        "count": 2,
    }


def test_task_update_bulk_updates_each_task_with_merged_defaults() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "task_update_bulk",
            {
                "confirm": "yes",
                "defaults": {"status": "open", "priority": 1},
                "tasks": [
                    {"taskId": "task-1", "name": "Renamed"},
                    {"taskId": "task-2", "priority": 4},
                ],
            },
        )
    )

    assert client.calls == [
        {
            "path": "task/task-1",
            "method": "PUT",
            "body": {"name": "Renamed", "status": "open", "priority": 1},
        },
        {
            "path": "task/task-2",
            "method": "PUT",
            "body": {"status": "open", "priority": 4},
        },
    ]
    assert payload == {
        "results": [
            {"id": "task-1", "updated": True},
            {"id": "task-2", "updated": True},
        ],
        "count": 2,
    }


def test_task_delete_bulk_deletes_each_task_individually() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "task_delete_bulk",
            {
                "confirm": "yes",
                "tasks": [{"taskId": "task-1"}, {"taskId": "task-2"}],
            },
        )
    )

    assert client.calls == [
        {"path": "task/task-1", "method": "DELETE"},
        {"path": "task/task-2", "method": "DELETE"},
    ]
    assert payload == {
        "results": [
            {"id": "task-1", "deleted": True},
            {"id": "task-2", "deleted": True},
        ],
        "count": 2,
    }


def test_task_tag_add_bulk_adds_tags_per_task_with_defaults() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "task_tag_add_bulk",
            {
                "confirm": "yes",
                "defaults": {"tags": ["shared"]},
                "tasks": [
                    {"taskId": "task-1"},
                    {"taskId": "task-2", "tags": ["custom", "two"]},
                ],
            },
        )
    )

    assert client.calls == [
        {"path": "task/task-1/tag/shared", "method": "POST"},
        {"path": "task/task-2/tag/custom", "method": "POST"},
        {"path": "task/task-2/tag/two", "method": "POST"},
    ]
    assert payload == {
        "results": [
            {"taskId": "task-1", "tag": "shared", "added": True},
            {"taskId": "task-2", "tag": "custom", "added": True},
            {"taskId": "task-2", "tag": "two", "added": True},
        ],
        "count": 3,
    }
