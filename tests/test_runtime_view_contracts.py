from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        if path == "view/view-1" and not kwargs:
            return {
                "id": "view-1",
                "name": "Existing View",
                "type": "list",
                "parent": {"id": "list-1", "type": 6},
                "grouping": {"field": "status", "dir": 1},
                "divide": {"field": None, "dir": None, "collapsed": []},
                "sorting": {"fields": []},
                "filters": {"op": "AND", "fields": [], "search": "", "show_closed": False},
                "columns": {"fields": []},
                "team_sidebar": {"assignees": [], "assigned_comments": False, "unassigned_tasks": False},
                "settings": {"show_task_locations": True},
            }
        if kwargs.get("method") in {"POST", "PUT"}:
            return {"id": "view-created"}
        raise AssertionError(f"Unexpected request path={path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_list_view_create_builds_required_view_body_and_merges_filters() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "list_view_create",
            {
                "confirm": "yes",
                "listId": "list-1",
                "name": "Board View",
                "viewType": "board",
                "statuses": [{"status": "in progress"}, {"name": "done"}],
                "tags": ["alpha"],
                "filters": {"op": "OR", "fields": [{"field": "assignee", "op": "EQ", "values": ["user-1"]}]},
            },
        )
    )

    assert payload == {"id": "view-created"}
    assert client.calls == [
        {
            "path": "list/list-1/view",
            "method": "POST",
            "body": {
                "name": "Board View",
                "type": "board",
                "description": None,
                "grouping": {"field": "status", "dir": 1, "ignore": False},
                "divide": {"field": None, "dir": None, "collapsed": []},
                "sorting": {"fields": []},
                "filters": {
                    "op": "OR",
                    "fields": [
                        {"field": "assignee", "op": "EQ", "values": ["user-1"]},
                        {"field": "status", "op": "ANY", "values": ["in progress", "done"]},
                        {"field": "tag", "op": "ANY", "values": ["alpha"]},
                    ],
                    "search": "",
                    "show_closed": False,
                },
                "columns": {"fields": []},
                "team_sidebar": {"assignees": [], "assigned_comments": False, "unassigned_tasks": False},
                "settings": {
                    "show_task_locations": True,
                    "show_subtask_parent_names": True,
                    "show_closed_subtasks": False,
                    "show_assignees": True,
                    "show_images": True,
                    "me_comments": True,
                    "me_subtasks": True,
                    "me_checklists": True,
                },
            },
        }
    ]


def test_space_view_create_uses_space_endpoint_with_default_view_body() -> None:
    runtime, client = _runtime()

    asyncio.run(
        runtime.dispatch(
            "space_view_create",
            {
                "confirm": "yes",
                "spaceId": "space-1",
                "name": "Space View",
            },
        )
    )

    assert client.calls[0]["path"] == "space/space-1/view"
    assert client.calls[0]["body"]["type"] == "list"
    assert client.calls[0]["body"]["filters"]["fields"] == []


def test_view_update_fetches_existing_view_and_supports_filters_remove() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "view_update",
            {
                "confirm": "yes",
                "viewId": "view-1",
                "name": "Updated View",
                "filters_remove": True,
            },
        )
    )

    assert payload == {"id": "view-created"}
    assert client.calls == [
        {"path": "view/view-1"},
        {
            "path": "view/view-1",
            "method": "PUT",
            "body": {
                "name": "Updated View",
                "type": "list",
                "description": None,
                "parent": {"id": "list-1", "type": 6},
                "grouping": {"field": "status", "dir": 1},
                "divide": {"field": None, "dir": None, "collapsed": []},
                "sorting": {"fields": []},
                "filters": {"op": "AND", "fields": [], "search": "", "show_closed": False},
                "columns": {"fields": []},
                "team_sidebar": {"assignees": [], "assigned_comments": False, "unassigned_tasks": False},
                "settings": {"show_task_locations": True},
            },
        },
    ]
