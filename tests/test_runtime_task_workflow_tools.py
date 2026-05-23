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
        params = kwargs.get("params") or {}
        if path == "space/space-1/tag/old-tag" and method == "PUT":
            return {}
        if path == "space/space-1/tag/new-tag" and method == "DELETE":
            return {}
        if path == "space/space-1/folder" and method == "POST":
            return {"id": "folder-1", "name": "Folder"}
        if path == "folder/folder-1" and method == "PUT":
            return {"id": "folder-1", "name": "Folder Updated"}
        if path == "folder/folder-1" and method == "DELETE":
            return {}
        if path == "list/list-1" and method == "PUT":
            return {"id": "list-1", "name": "List Updated"}
        if path == "task/task-1" and method == "PUT":
            return {"id": "task-1", "name": "Task Updated"}
        if path == "task/task-1/comment" and method == "POST":
            return {"id": "comment-1"}
        if path == "task/task-1/comment" and not kwargs:
            return {"comments": [{"id": "comment-1", "comment_text": "hello"}]}
        if path == "task/task-1/tag/alpha" and method == "DELETE":
            return {}
        if path == "team/workspace-123/task":
            if params.get("query") == "needle":
                return {
                    "tasks": [
                        {
                            "id": "task-1",
                            "name": "Needle task",
                            "status": {"status": "open", "type": "open"},
                            "priority": {"priority": "2"},
                            "due_date": "1735776000000",
                            "assignees": [{"id": "user-1", "username": "alice"}],
                        }
                    ]
                }
            return {
                "tasks": [
                    {
                        "id": "task-open",
                        "name": "Open task",
                        "status": {"status": "open", "type": "open"},
                        "priority": {"priority": "1"},
                        "due_date": "1735603200000",
                        "assignees": [{"id": "user-1", "username": "alice"}],
                    },
                    {
                        "id": "task-risk",
                        "name": "Risk task",
                        "status": {"status": "in progress", "type": "custom"},
                        "priority": {"priority": "2"},
                        "due_date": "1735948800000",
                        "assignees": [{"id": "user-2", "username": "bob"}],
                    },
                    {
                        "id": "task-closed",
                        "name": "Closed task",
                        "status": {"status": "complete", "type": "closed"},
                        "priority": {"priority": "3"},
                        "due_date": "1736035200000",
                        "assignees": [],
                    },
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


def test_space_tag_folder_list_and_task_write_tools_route_correctly() -> None:
    runtime, client = _runtime()

    space_tag_update = asyncio.run(
        runtime.dispatch(
            "space_tag_update",
            {
                "confirm": "yes",
                "spaceId": "space-1",
                "currentName": "old-tag",
                "name": "new-tag",
                "backgroundColor": "#22aa22",
                "foregroundColor": "#111111",
            },
        )
    )
    space_tag_delete = asyncio.run(
        runtime.dispatch(
            "space_tag_delete",
            {"confirm": "yes", "spaceId": "space-1", "name": "new-tag"},
        )
    )
    folder_create = asyncio.run(
        runtime.dispatch(
            "folder_create_in_space",
            {"confirm": "yes", "spaceId": "space-1", "name": "Folder"},
        )
    )
    folder_update = asyncio.run(
        runtime.dispatch(
            "folder_update",
            {"confirm": "yes", "folderId": "folder-1", "name": "Folder Updated"},
        )
    )
    folder_delete = asyncio.run(
        runtime.dispatch(
            "folder_delete",
            {"confirm": "yes", "folderId": "folder-1"},
        )
    )
    list_update = asyncio.run(
        runtime.dispatch(
            "list_update",
            {"confirm": "yes", "listId": "list-1", "name": "List Updated"},
        )
    )
    task_update = asyncio.run(
        runtime.dispatch(
            "task_update",
            {"confirm": "yes", "taskId": "task-1", "name": "Task Updated"},
        )
    )

    assert space_tag_update == {}
    assert space_tag_delete == {}
    assert folder_create == {"id": "folder-1", "name": "Folder"}
    assert folder_update == {"id": "folder-1", "name": "Folder Updated"}
    assert folder_delete == {}
    assert list_update == {"id": "list-1", "name": "List Updated"}
    assert task_update == {"id": "task-1", "name": "Task Updated"}
    assert client.calls == [
        {
            "path": "space/space-1/tag/old-tag",
            "method": "PUT",
            "body": {"tag": "new-tag", "tag_bg": "#22aa22", "tag_fg": "#111111"},
        },
        {
            "path": "space/space-1/tag/new-tag",
            "method": "DELETE",
        },
        {
            "path": "space/space-1/folder",
            "method": "POST",
            "body": {"name": "Folder"},
        },
        {
            "path": "folder/folder-1",
            "method": "PUT",
            "body": {"name": "Folder Updated"},
        },
        {
            "path": "folder/folder-1",
            "method": "DELETE",
        },
        {
            "path": "list/list-1",
            "method": "PUT",
            "body": {"name": "List Updated"},
        },
        {
            "path": "task/task-1",
            "method": "PUT",
            "body": {"name": "Task Updated"},
        },
    ]


def test_task_comment_and_tag_remove_tools_route_correctly() -> None:
    runtime, client = _runtime()

    comment_added = asyncio.run(
        runtime.dispatch(
            "task_comment_add",
            {"confirm": "yes", "taskId": "task-1", "comment": "hello"},
        )
    )
    comment_list = asyncio.run(
        runtime.dispatch("task_comment_list", {"taskId": "task-1", "limit": 5})
    )
    tag_removed = asyncio.run(
        runtime.dispatch(
            "task_tag_remove",
            {"confirm": "yes", "taskId": "task-1", "tags": ["alpha"]},
        )
    )

    assert comment_added == {"id": "comment-1"}
    assert comment_list == {"comments": [{"id": "comment-1", "comment_text": "hello"}]}
    assert tag_removed == {"results": [{}]}


def test_task_search_and_fuzzy_tools_use_search_surface() -> None:
    runtime, client = _runtime()

    search = asyncio.run(
        runtime.dispatch("task_search", {"query": "needle", "pageSize": 5})
    )
    fuzzy = asyncio.run(
        runtime.dispatch("task_search_fuzzy", {"query": "needle", "limit": 5, "teamId": "workspace-123"})
    )
    bulk = asyncio.run(
        runtime.dispatch("task_search_fuzzy_bulk", {"queries": ["needle"], "limit": 5, "teamId": "workspace-123"})
    )

    assert search["total"] == 1
    assert search["tasks"][0]["id"] == "task-1"
    assert fuzzy["total"] == 1
    assert bulk["queries"][0]["total"] == 1
    assert client.calls == [
        {
            "path": "team/workspace-123/task",
            "params": {"page": 0, "page_size": 5, "order_by": "updated", "reverse": True, "query": "needle", "subtasks": True, "include_timl": True},
        },
        {
            "path": "team/workspace-123/task",
            "params": {"page": 0, "page_size": 5, "order_by": "updated", "reverse": True, "query": "needle", "subtasks": True, "include_timl": True},
        },
        {
            "path": "team/workspace-123/task",
            "params": {"page": 0, "page_size": 5, "order_by": "updated", "reverse": True, "query": "needle", "subtasks": True, "include_timl": True},
        },
    ]


def test_task_status_and_risk_reports_return_aggregates(monkeypatch: Any) -> None:
    runtime, _client = _runtime()
    monkeypatch.setattr(server.time, "time", lambda: 1735862400.0)

    status_report = asyncio.run(
        runtime.dispatch("task_status_report", {"spaceId": "space-1"})
    )
    risk_report = asyncio.run(
        runtime.dispatch("task_risk_report", {"spaceId": "space-1"})
    )

    assert status_report["totals"]["inspected"] == 3
    assert status_report["statusCounts"]["open"] == 1
    assert status_report["statusCounts"]["in progress"] == 1
    assert status_report["statusCounts"]["complete"] == 1
    assert risk_report["overdue"]["total"] == 1
    assert risk_report["atRisk"]["total"] == 1
