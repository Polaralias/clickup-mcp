from __future__ import annotations

import asyncio
import base64
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        method = kwargs.get("method")
        if path == "list/list-1/task" and method == "POST":
            return {"id": "task-created"}
        if path == "list/list-1/field" and not kwargs:
            return {"fields": []}
        if path == "task/task-1/field/field-1" and method == "POST":
            return {"id": "field-1", "value": "hello"}
        if path == "task/task-1/field/field-1" and method == "DELETE":
            return {}
        raise AssertionError(f"Unexpected request path={path!r} kwargs={kwargs!r}")

    def request_v3(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs, "v3": True})
        method = kwargs.get("method")
        if path == "workspaces/workspace-123/docs" and method == "POST":
            return {"id": "doc-1"}
        if path == "workspaces/workspace-123/docs/doc-1/pages" and method == "POST":
            return {"id": "page-1", "name": "Page 1", "content": "body"}
        if path == "workspaces/workspace-123/docs/doc-1/pages/page-1" and method == "PUT":
            return {}
        if path == "workspaces/workspace-123/tasks/task-1/attachments" and method == "POST":
            return {"id": "attachment-1"}
        raise AssertionError(f"Unexpected request_v3 path={path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_subtask_create_and_bulk_create_compose_over_list_task_create() -> None:
    runtime, client = _runtime()

    created = asyncio.run(
        runtime.dispatch(
            "subtask_create",
            {"confirm": "yes", "listId": "list-1", "parentTaskId": "task-1", "name": "Child"},
        )
    )
    bulk = asyncio.run(
        runtime.dispatch(
            "subtask_create_bulk",
            {
                "confirm": "yes",
                "defaults": {"listId": "list-1", "parentTaskId": "task-1"},
                "subtasks": [{"name": "Bulk Child"}],
            },
        )
    )

    assert created == {"id": "task-created"}
    assert bulk == {"results": [{"id": "task-created"}], "count": 1}
    assert client.calls == [
        {
            "path": "list/list-1/task",
            "method": "POST",
            "body": {"name": "Child", "parent": "task-1"},
        },
        {
            "path": "list/list-1/task",
            "method": "POST",
            "body": {"name": "Bulk Child", "parent": "task-1"},
        },
    ]


def test_attachment_and_custom_field_tools_route_correctly() -> None:
    runtime, client = _runtime()
    data_uri = "data:text/plain;base64," + base64.b64encode(b"hello").decode()

    attachment = asyncio.run(
        runtime.dispatch(
            "task_attachment_add",
            {"confirm": "yes", "taskId": "task-1", "filename": "hello.txt", "dataUri": data_uri},
        )
    )
    fields = asyncio.run(runtime.dispatch("list_custom_field_list", {"listId": "list-1"}))
    set_value = asyncio.run(
        runtime.dispatch(
            "task_custom_field_set_value",
            {"confirm": "yes", "taskId": "task-1", "fieldId": "field-1", "value": "hello"},
        )
    )
    cleared = asyncio.run(
        runtime.dispatch(
            "task_custom_field_clear_value",
            {"confirm": "yes", "taskId": "task-1", "fieldId": "field-1"},
        )
    )

    assert attachment == {"id": "attachment-1"}
    assert fields == {"fields": []}
    assert set_value == {"id": "field-1", "value": "hello"}
    assert cleared == {}
    assert client.calls[0]["path"] == "workspaces/workspace-123/tasks/task-1/attachments"
    assert client.calls[0]["v3"] is True


def test_doc_create_and_page_write_tools_use_workspace_scoped_v3_routes() -> None:
    runtime, client = _runtime()

    created_doc = asyncio.run(
        runtime.dispatch(
            "doc_create",
            {
                "confirm": "yes",
                "workspaceId": "workspace-123",
                "folderId": "folder-1",
                "name": "Doc",
                "content": "body",
            },
        )
    )
    created_page = asyncio.run(
        runtime.dispatch(
            "doc_page_create",
            {
                "confirm": "yes",
                "workspaceId": "workspace-123",
                "docId": "doc-1",
                "title": "Page 1",
                "content": "body",
            },
        )
    )
    updated_page = asyncio.run(
        runtime.dispatch(
            "doc_page_update",
            {
                "confirm": "yes",
                "workspaceId": "workspace-123",
                "docId": "doc-1",
                "pageId": "page-1",
                "title": "Page 1 updated",
                "content": "updated",
            },
        )
    )

    assert created_doc == {"id": "doc-1"}
    assert created_page == {"id": "page-1", "name": "Page 1", "content": "body"}
    assert updated_page == {}
    assert client.calls == [
        {
            "path": "workspaces/workspace-123/docs",
            "method": "POST",
            "body": {"name": "Doc", "content": "body", "folder_id": "folder-1"},
            "v3": True,
        },
        {
            "path": "workspaces/workspace-123/docs/doc-1/pages",
            "method": "POST",
            "body": {"name": "Page 1", "content": "body"},
            "v3": True,
        },
        {
            "path": "workspaces/workspace-123/docs/doc-1/pages/page-1",
            "method": "PUT",
            "body": {"name": "Page 1 updated", "content": "updated"},
            "v3": True,
        },
    ]
