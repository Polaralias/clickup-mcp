from __future__ import annotations

from typing import Any

import pytest

from harness import live_smoke


pytestmark = [
    pytest.mark.live_smoke,
    pytest.mark.skipif(bool(live_smoke.skip_reason()), reason=live_smoke.skip_reason()),
]


def _extract_id(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, (str, int)):
            text = str(value).strip()
            if text:
                return text
    return None


def test_live_smoke_runtime_validated_write_paths() -> None:
    config = live_smoke.load_live_smoke_config()
    list_id: str | None = None
    task_id: str | None = None
    list_view_id: str | None = None
    space_view_id: str | None = None
    tag_name = live_smoke.unique_name("codex-smoke-tag")

    try:
        created_list = live_smoke.dispatch(
            "list_create_for_container",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": live_smoke.unique_name("codex-smoke-list"),
            },
        )
        list_id = _extract_id(created_list, "id", "list_id")
        assert list_id

        created_task = live_smoke.dispatch(
            "task_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-task"),
            },
        )
        task_id = _extract_id(created_task, "id", "task_id")
        assert task_id

        task_read = live_smoke.dispatch(
            "task_read",
            {
                "taskId": task_id,
                "detailLimit": 1,
            },
        )
        assert _extract_id(task_read, "id") == task_id

        task_list = live_smoke.dispatch(
            "task_list_for_list",
            {
                "listId": list_id,
                "limit": 1,
                "assigneePreviewLimit": 1,
            },
        )
        assert isinstance(task_list.get("tasks"), list)
        assert task_list["tasks"]

        created_list_view = live_smoke.dispatch(
            "list_view_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-list-view"),
                "viewType": "list",
                "tags": [tag_name],
            },
        )
        list_view_id = _extract_id(created_list_view, "id", "view_id") or _extract_id(created_list_view.get("view", {}), "id", "view_id")
        assert list_view_id

        updated_list_view = live_smoke.dispatch(
            "view_update",
            {
                "confirm": "yes",
                "viewId": list_view_id,
                "name": live_smoke.unique_name("codex-smoke-list-view-updated"),
                "filters_remove": True,
            },
        )
        assert (_extract_id(updated_list_view, "id", "view_id") or _extract_id(updated_list_view.get("view", {}), "id", "view_id")) == list_view_id

        created_space_view = live_smoke.dispatch(
            "space_view_create",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": live_smoke.unique_name("codex-smoke-space-view"),
                "viewType": "list",
            },
        )
        space_view_id = _extract_id(created_space_view, "id", "view_id") or _extract_id(created_space_view.get("view", {}), "id", "view_id")
        assert space_view_id

        tag_result = live_smoke.dispatch(
            "task_tag_add",
            {
                "confirm": "yes",
                "taskId": task_id,
                "tags": [tag_name],
            },
        )
        assert isinstance(tag_result.get("results"), list)
    finally:
        if list_view_id:
            live_smoke.dispatch("view_delete", {"confirm": "yes", "viewId": list_view_id})
        if space_view_id:
            live_smoke.dispatch("view_delete", {"confirm": "yes", "viewId": space_view_id})
        if task_id:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": task_id})
        if list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": list_id})


def test_live_smoke_replacement_member_and_docs_paths() -> None:
    config = live_smoke.load_live_smoke_config()

    members = live_smoke.raw_member_listing(config.workspace_id)
    assert isinstance(members, list)
    assert members

    pages = live_smoke.raw_doc_page_listing(config.workspace_id, config.doc_id)
    assert isinstance(pages, list)
    assert pages

    all_pages = live_smoke.raw_doc_pages(config.workspace_id, config.doc_id)
    assert isinstance(all_pages, list)
    assert all_pages

    page_id = _extract_id(pages[0], "id", "page_id")
    assert page_id

    page = live_smoke.raw_doc_page_read(config.workspace_id, config.doc_id, page_id)
    assert _extract_id(page, "id", "page_id") == page_id


def test_live_smoke_repaired_runtime_member_and_docs_paths() -> None:
    config = live_smoke.load_live_smoke_config()

    hierarchy = live_smoke.dispatch(
        "workspace_hierarchy",
        {"workspaceIds": [config.workspace_id], "maxDepth": 1},
    )
    assert hierarchy.get("count") == 1
    assert isinstance(hierarchy.get("workspaces"), list)
    assert hierarchy["workspaces"]

    members_payload = live_smoke.dispatch(
        "member_list_for_workspace",
        {"teamId": config.workspace_id},
    )
    members = members_payload.get("members")
    assert isinstance(members, list)
    assert members

    member = members[0]
    member_id = _extract_id(member, "id", "user_id", "member_id")
    member_name = member.get("username")
    member_email = member.get("email")
    assert member_id

    resolved = live_smoke.dispatch(
        "member_resolve",
        {"teamId": config.workspace_id, "identifiers": [member_id]},
    )
    assert isinstance(resolved.get("resolved"), list)
    assert resolved["resolved"]

    search_query = member_name or member_email or member_id
    searched = live_smoke.dispatch(
        "member_search_by_name",
        {"teamId": config.workspace_id, "query": str(search_query)},
    )
    assert isinstance(searched.get("results"), list)
    assert searched["results"]

    assignee_resolved = live_smoke.dispatch(
        "task_assignee_resolve",
        {"teamId": config.workspace_id, "identifiers": [member_id]},
    )
    assert isinstance(assignee_resolved.get("resolved"), list)
    assert assignee_resolved["resolved"]

    page_listing = live_smoke.dispatch(
        "doc_page_list",
        {"workspaceId": config.workspace_id, "docId": config.doc_id},
    )
    pages = page_listing.get("pages")
    assert isinstance(pages, list)
    assert pages

    page_id = _extract_id(pages[0], "id", "page_id")
    assert page_id

    page_read = live_smoke.dispatch(
        "doc_page_read",
        {"workspaceId": config.workspace_id, "docId": config.doc_id, "pageId": page_id},
    )
    assert _extract_id(page_read, "id", "page_id") == page_id

    pages_read = live_smoke.dispatch(
        "doc_pages_read",
        {"workspaceId": config.workspace_id, "docId": config.doc_id, "pageIds": [page_id]},
    )
    assert isinstance(pages_read.get("pages"), list)
    assert pages_read["pages"]

    doc_read = live_smoke.dispatch(
        "doc_read",
        {"workspaceId": config.workspace_id, "docId": config.doc_id},
    )
    assert doc_read.get("summary")
    assert isinstance(doc_read.get("pages"), list)

    doc_list = live_smoke.dispatch(
        "doc_list",
        {"workspaceId": config.workspace_id},
    )
    assert isinstance(doc_list.get("docs"), list)
    assert doc_list.get("count", 0) >= 1
    assert doc_list["docs"][0].get("summary")

    doc_search = live_smoke.dispatch(
        "doc_search",
        {"workspaceId": config.workspace_id, "query": str(doc_read.get("name") or ""), "expandPages": True},
    )
    assert isinstance(doc_search.get("docs"), list)
    assert doc_search.get("count", 0) >= 1

    doc_search_bulk = live_smoke.dispatch(
        "doc_search_bulk",
        {"workspaceId": config.workspace_id, "queries": [str(doc_read.get("name") or "")], "expandPages": True},
    )
    assert isinstance(doc_search_bulk.get("queries"), list)
    assert doc_search_bulk["queries"]


def test_live_smoke_runtime_system_and_hierarchy_read_paths() -> None:
    config = live_smoke.load_live_smoke_config()
    created_list_id: str | None = None
    created_list_name = live_smoke.unique_name("codex-smoke-hierarchy-list")

    try:
        ping = live_smoke.dispatch("ping", {"message": "smoke"})
        assert ping == {"message": "smoke"}

        health = live_smoke.dispatch("health", {"verbose": True})
        assert health.get("status") == "ok"

        tool_catalogue = live_smoke.dispatch("tool_catalogue", {})
        assert isinstance(tool_catalogue.get("tools"), list)
        assert tool_catalogue["tools"]

        workspace_list = live_smoke.dispatch("workspace_list", {})
        teams = workspace_list.get("teams")
        assert isinstance(teams, list)
        assert any(_extract_id(team, "id") == config.workspace_id for team in teams if isinstance(team, dict))

        capability_snapshot = live_smoke.dispatch(
            "workspace_capability_snapshot",
            {"workspaceId": config.workspace_id},
        )
        assert capability_snapshot.get("workspaceId") == config.workspace_id
        assert isinstance(capability_snapshot.get("docsAvailable"), bool)

        spaces_payload = live_smoke.dispatch(
            "space_list_for_workspace",
            {"workspaceId": config.workspace_id},
        )
        spaces = spaces_payload.get("spaces")
        assert isinstance(spaces, list)
        space = next((item for item in spaces if _extract_id(item, "id") == config.space_id), None)
        assert isinstance(space, dict)
        space_name = str(space.get("name") or "")
        assert space_name

        overview = live_smoke.dispatch(
            "workspace_overview",
            {"workspaceId": config.workspace_id},
        )
        assert overview.get("workspaceId") == config.workspace_id
        assert overview.get("spaceCount", 0) >= 1

        folders_payload = live_smoke.dispatch(
            "folder_list_for_space",
            {"spaceId": config.space_id},
        )
        assert isinstance(folders_payload.get("folders"), list)

        tags_payload = live_smoke.dispatch(
            "space_tag_list",
            {"spaceId": config.space_id},
        )
        assert isinstance(tags_payload.get("tags"), list)

        created_list = live_smoke.dispatch(
            "list_create_for_container",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": created_list_name,
            },
        )
        created_list_id = _extract_id(created_list, "id", "list_id")
        assert created_list_id

        lists_payload = live_smoke.dispatch(
            "list_list_for_space_or_folder",
            {"spaceId": config.space_id},
        )
        lists = lists_payload.get("lists")
        assert isinstance(lists, list)
        assert any(_extract_id(item, "id", "list_id") == created_list_id for item in lists if isinstance(item, dict))

        resolved = live_smoke.dispatch(
            "hierarchy_resolve_path",
            {"path": [str(next(team.get("name") for team in teams if isinstance(team, dict) and _extract_id(team, "id") == config.workspace_id)), space_name, created_list_name]},
        )
        assert resolved.get("workspaceId") == config.workspace_id
        assert resolved.get("spaceId") == config.space_id
        assert resolved.get("listId") == created_list_id
    finally:
        if created_list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": created_list_id})


def test_live_smoke_replacement_space_tag_payload() -> None:
    config = live_smoke.load_live_smoke_config()
    tag_name = live_smoke.unique_name("codex-smoke-space-tag")

    try:
        payload = live_smoke.create_space_tag(config.space_id, tag_name)
        assert payload is not None
    finally:
        live_smoke.delete_space_tag(config.space_id, tag_name)


def test_live_smoke_repaired_runtime_space_tag_create() -> None:
    config = live_smoke.load_live_smoke_config()
    tag_name = live_smoke.unique_name("codex-smoke-runtime-space-tag")

    try:
        payload = live_smoke.dispatch(
            "space_tag_create",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": tag_name,
                "foregroundColor": "#111111",
                "backgroundColor": "#22aa22",
            },
        )
        assert payload is not None
    finally:
        live_smoke.delete_space_tag(config.space_id, tag_name)


def test_live_smoke_repaired_runtime_list_create_from_template() -> None:
    config = live_smoke.load_live_smoke_config()
    created_list_id: str | None = None

    try:
        payload = live_smoke.dispatch(
            "list_create_from_template",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "templateId": "t-901218273536",
                "name": live_smoke.unique_name("codex-smoke-template-list"),
            },
        )
        created_list_id = _extract_id(payload, "id", "list_id") or _extract_id(payload.get("list", {}), "id", "list_id")
        assert created_list_id
    finally:
        if created_list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": created_list_id})


def test_live_smoke_repaired_task_compositions() -> None:
    config = live_smoke.load_live_smoke_config()
    list_id: str | None = None
    seed_task_id: str | None = None
    duplicate_task_id: str | None = None
    bulk_created_ids: list[str] = []
    tag_name = live_smoke.unique_name("codex-smoke-bulk-tag")

    try:
        created_list = live_smoke.dispatch(
            "list_create_for_container",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": live_smoke.unique_name("codex-smoke-compose-list"),
            },
        )
        list_id = _extract_id(created_list, "id", "list_id")
        assert list_id

        created_task = live_smoke.dispatch(
            "task_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-seed-task"),
                "description": "seed description",
            },
        )
        seed_task_id = _extract_id(created_task, "id", "task_id")
        assert seed_task_id

        duplicate_result = live_smoke.dispatch(
            "task_duplicate",
            {
                "confirm": "yes",
                "taskId": seed_task_id,
                "listId": list_id,
            },
        )
        duplicate_task_id = _extract_id(duplicate_result, "id", "task_id")
        assert duplicate_task_id
        duplicate_task = live_smoke.raw_task_read(duplicate_task_id)
        assert duplicate_task.get("name") == created_task.get("name")

        bulk_create_result = live_smoke.dispatch(
            "task_create_bulk",
            {
                "confirm": "yes",
                "defaults": {"listId": list_id},
                "tasks": [
                    {"name": live_smoke.unique_name("codex-smoke-bulk-a")},
                    {"name": live_smoke.unique_name("codex-smoke-bulk-b")},
                ],
            },
        )
        bulk_created_ids = [
            task_id
            for task_id in (_extract_id(item, "id", "task_id") for item in bulk_create_result.get("results", []))
            if task_id
        ]
        assert len(bulk_created_ids) == 2

        bulk_update_result = live_smoke.dispatch(
            "task_update_bulk",
            {
                "confirm": "yes",
                "defaults": {"status": "to do"},
                "tasks": [
                    {"taskId": bulk_created_ids[0], "name": live_smoke.unique_name("codex-smoke-updated-a")},
                    {"taskId": bulk_created_ids[1], "name": live_smoke.unique_name("codex-smoke-updated-b")},
                ],
            },
        )
        assert bulk_update_result.get("count") == 2
        updated_tasks = [live_smoke.raw_task_read(task_id) for task_id in bulk_created_ids]
        assert all(task.get("name") for task in updated_tasks)

        bulk_tag_result = live_smoke.dispatch(
            "task_tag_add_bulk",
            {
                "confirm": "yes",
                "defaults": {"tags": [tag_name]},
                "tasks": [{"taskId": task_id} for task_id in bulk_created_ids],
            },
        )
        assert bulk_tag_result.get("count") == 2
        tagged_tasks = [live_smoke.raw_task_read(task_id) for task_id in bulk_created_ids]
        assert all(tag_name in [tag.get("name") for tag in task.get("tags", []) if isinstance(tag, dict)] for task in tagged_tasks)

        bulk_delete_result = live_smoke.dispatch(
            "task_delete_bulk",
            {
                "confirm": "yes",
                "tasks": [{"taskId": task_id} for task_id in bulk_created_ids],
            },
        )
        assert bulk_delete_result.get("count") == 2
        for task_id in bulk_created_ids:
            with pytest.raises(RuntimeError):
                live_smoke.raw_task_read(task_id)
        bulk_created_ids = []
    finally:
        for task_id in bulk_created_ids:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": task_id})
        if duplicate_task_id:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": duplicate_task_id})
        if seed_task_id:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": seed_task_id})
        if list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": list_id})


def test_live_smoke_repaired_time_entry_and_report_paths() -> None:
    config = live_smoke.load_live_smoke_config()
    list_id: str | None = None
    task_id: str | None = None
    view_id: str | None = None
    entry_id: str | None = None
    timer_running = False
    tag_name = live_smoke.unique_name("codex-smoke-time-tag")
    start_ms = int(__import__("time").time() * 1000) - 120000
    end_ms = start_ms + 60000

    try:
        created_list = live_smoke.dispatch(
            "list_create_for_container",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": live_smoke.unique_name("codex-smoke-time-list"),
            },
        )
        list_id = _extract_id(created_list, "id", "list_id")
        assert list_id

        live_smoke.create_space_tag(config.space_id, tag_name)

        created_task = live_smoke.dispatch(
            "task_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-time-task"),
            },
        )
        task_id = _extract_id(created_task, "id", "task_id")
        assert task_id

        live_smoke.dispatch(
            "task_tag_add",
            {
                "confirm": "yes",
                "taskId": task_id,
                "tags": [tag_name],
            },
        )

        created_view = live_smoke.dispatch(
            "list_view_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-time-view"),
                "viewType": "list",
            },
        )
        view_id = _extract_id(created_view, "id", "view_id") or _extract_id(created_view.get("view", {}), "id", "view_id")
        assert view_id

        created_entry = live_smoke.raw_time_entry_create(
            task_id,
            start=start_ms,
            end=end_ms,
            description="codex live smoke time entry",
        )
        entry_id = _extract_id(created_entry, "id", "entry_id") or _extract_id(created_entry.get("data", {}), "id", "entry_id")
        assert entry_id

        task_entries = live_smoke.dispatch(
            "task_time_entry_list",
            {"taskId": task_id, "pageSize": 5},
        )
        assert isinstance(task_entries.get("entries"), list)
        assert any(_extract_id(entry, "id", "entry_id") == entry_id for entry in task_entries["entries"])

        entry_list = live_smoke.dispatch(
            "time_entry_list",
            {"taskId": task_id, "from": start_ms - 1000, "to": end_ms + 1000, "pageSize": 5},
        )
        assert isinstance(entry_list.get("entries"), list)
        assert any(_extract_id(entry, "id", "entry_id") == entry_id for entry in entry_list["entries"])

        container_report = live_smoke.dispatch(
            "time_report_for_container",
            {"containerType": "list", "containerId": list_id, "from": start_ms - 1000, "to": end_ms + 1000},
        )
        assert container_report.get("totalDurationMs", 0) >= 60000

        context_report = live_smoke.dispatch(
            "time_report_for_context",
            {"viewId": view_id, "from": start_ms - 1000, "to": end_ms + 1000},
        )
        assert context_report.get("totalDurationMs", 0) >= 60000

        tag_report = live_smoke.dispatch(
            "time_report_for_tag",
            {"tag": tag_name, "from": start_ms - 1000, "to": end_ms + 1000},
        )
        assert tag_report.get("totalDurationMs", 0) >= 60000

        space_tag_report = live_smoke.dispatch(
            "time_report_for_space_tag",
            {"spaceId": config.space_id, "tag": tag_name, "from": start_ms - 1000, "to": end_ms + 1000},
        )
        assert space_tag_report.get("totalDurationMs", 0) >= 60000

        timer_start = live_smoke.dispatch(
            "task_timer_start",
            {"confirm": "yes", "taskId": task_id},
        )
        assert timer_start is not None
        timer_running = True

        current_timer = live_smoke.dispatch("time_entry_current", {})
        current_data = current_timer.get("data")
        assert current_data is not None

        timer_stop = live_smoke.dispatch(
            "task_timer_stop",
            {"confirm": "yes", "taskId": task_id},
        )
        assert timer_stop is not None
        timer_running = False

        stopped_timer = live_smoke.dispatch("time_entry_current", {})
        assert stopped_timer.get("data") is None
    finally:
        if timer_running:
            live_smoke.dispatch("task_timer_stop", {"confirm": "yes", "taskId": task_id})
        if entry_id:
            live_smoke.raw_time_entry_delete(config.workspace_id, entry_id)
        if view_id:
            live_smoke.dispatch("view_delete", {"confirm": "yes", "viewId": view_id})
        if task_id:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": task_id})
        if list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": list_id})
        live_smoke.delete_space_tag(config.space_id, tag_name)


def test_live_smoke_runtime_task_and_container_workflow_tools() -> None:
    config = live_smoke.load_live_smoke_config()
    folder_id: str | None = None
    list_id: str | None = None
    task_id: str | None = None
    tag_name = live_smoke.unique_name("codex-smoke-update-tag")
    updated_tag_name = f"{tag_name}-updated"

    try:
        live_smoke.dispatch(
            "space_tag_create",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": tag_name,
                "foregroundColor": "#111111",
                "backgroundColor": "#22aa22",
            },
        )

        tag_update = live_smoke.dispatch(
            "space_tag_update",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "currentName": tag_name,
                "name": updated_tag_name,
                "foregroundColor": "#222222",
                "backgroundColor": "#33aa33",
            },
        )
        assert tag_update is not None

        folder = live_smoke.dispatch(
            "folder_create_in_space",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": live_smoke.unique_name("codex-smoke-folder"),
            },
        )
        folder_id = _extract_id(folder, "id", "folder_id")
        assert folder_id

        updated_folder = live_smoke.dispatch(
            "folder_update",
            {
                "confirm": "yes",
                "folderId": folder_id,
                "name": live_smoke.unique_name("codex-smoke-folder-updated"),
            },
        )
        assert _extract_id(updated_folder, "id", "folder_id") == folder_id

        created_list = live_smoke.dispatch(
            "list_create_for_container",
            {
                "confirm": "yes",
                "folderId": folder_id,
                "name": live_smoke.unique_name("codex-smoke-folder-list"),
            },
        )
        list_id = _extract_id(created_list, "id", "list_id")
        assert list_id

        updated_list = live_smoke.dispatch(
            "list_update",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-folder-list-updated"),
            },
        )
        assert _extract_id(updated_list, "id", "list_id") == list_id

        created_task = live_smoke.dispatch(
            "task_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-workflow-task"),
            },
        )
        task_id = _extract_id(created_task, "id", "task_id")
        assert task_id

        updated_task = live_smoke.dispatch(
            "task_update",
            {
                "confirm": "yes",
                "taskId": task_id,
                "name": live_smoke.unique_name("codex-smoke-workflow-task-updated"),
            },
        )
        assert _extract_id(updated_task, "id", "task_id") == task_id

        live_smoke.dispatch(
            "task_tag_add",
            {
                "confirm": "yes",
                "taskId": task_id,
                "tags": [updated_tag_name],
            },
        )
        removed_tag = live_smoke.dispatch(
            "task_tag_remove",
            {
                "confirm": "yes",
                "taskId": task_id,
                "tags": [updated_tag_name],
            },
        )
        assert isinstance(removed_tag.get("results"), list)

        added_comment = live_smoke.dispatch(
            "task_comment_add",
            {
                "confirm": "yes",
                "taskId": task_id,
                "comment": "codex live smoke comment",
            },
        )
        assert _extract_id(added_comment, "id")

        comment_list = live_smoke.dispatch(
            "task_comment_list",
            {"taskId": task_id, "limit": 5},
        )
        assert isinstance(comment_list.get("comments"), list)
        assert comment_list["comments"]

        task_search = live_smoke.dispatch(
            "task_search",
            {"query": str(updated_task.get("name") or ""), "pageSize": 5, "spaceId": config.space_id},
        )
        assert any(_extract_id(task, "id", "task_id") == task_id for task in task_search.get("tasks", []) if isinstance(task, dict))

        task_search_fuzzy = live_smoke.dispatch(
            "task_search_fuzzy",
            {"query": str(updated_task.get("name") or ""), "limit": 5, "teamId": config.workspace_id},
        )
        assert isinstance(task_search_fuzzy.get("tasks"), list)

        task_search_bulk = live_smoke.dispatch(
            "task_search_fuzzy_bulk",
            {"queries": [str(updated_task.get("name") or "")], "limit": 5, "teamId": config.workspace_id},
        )
        assert isinstance(task_search_bulk.get("queries"), list)
        assert task_search_bulk["queries"]

        status_report = live_smoke.dispatch(
            "task_status_report",
            {"spaceId": config.space_id},
        )
        assert isinstance(status_report.get("statusCounts"), dict)

        risk_report = live_smoke.dispatch(
            "task_risk_report",
            {"spaceId": config.space_id},
        )
        assert isinstance(risk_report.get("overdue"), dict)

        tag_delete = live_smoke.dispatch(
            "space_tag_delete",
            {"confirm": "yes", "spaceId": config.space_id, "name": updated_tag_name},
        )
        assert tag_delete is not None
    finally:
        if task_id:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": task_id})
        if list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": list_id})
        if folder_id:
            live_smoke.dispatch("folder_delete", {"confirm": "yes", "folderId": folder_id})
        try:
            live_smoke.delete_space_tag(config.space_id, tag_name)
        except Exception:
            pass


def test_live_smoke_runtime_final_surface_tools() -> None:
    config = live_smoke.load_live_smoke_config()
    list_id: str | None = None
    parent_task_id: str | None = None
    subtask_id: str | None = None
    bulk_subtask_id: str | None = None
    doc_id: str | None = None
    page_id: str | None = None

    try:
        created_list = live_smoke.dispatch(
            "list_create_for_container",
            {
                "confirm": "yes",
                "spaceId": config.space_id,
                "name": live_smoke.unique_name("codex-smoke-final-list"),
            },
        )
        list_id = _extract_id(created_list, "id", "list_id")
        assert list_id

        created_task = live_smoke.dispatch(
            "task_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "name": live_smoke.unique_name("codex-smoke-parent-task"),
            },
        )
        parent_task_id = _extract_id(created_task, "id", "task_id")
        assert parent_task_id

        created_subtask = live_smoke.dispatch(
            "subtask_create",
            {
                "confirm": "yes",
                "listId": list_id,
                "parentTaskId": parent_task_id,
                "name": live_smoke.unique_name("codex-smoke-child-task"),
            },
        )
        subtask_id = _extract_id(created_subtask, "id", "task_id")
        assert subtask_id

        bulk_subtask = live_smoke.dispatch(
            "subtask_create_bulk",
            {
                "confirm": "yes",
                "defaults": {"listId": list_id, "parentTaskId": parent_task_id},
                "subtasks": [{"name": live_smoke.unique_name("codex-smoke-bulk-child")}],
            },
        )
        bulk_subtask_id = _extract_id((bulk_subtask.get("results") or [{}])[0], "id", "task_id")
        assert bulk_subtask_id

        attachment = live_smoke.dispatch(
            "task_attachment_add",
            {
                "confirm": "yes",
                "taskId": parent_task_id,
                "filename": "codex-smoke.txt",
                "dataUri": "data:text/plain;base64,Y29kZXggc21va2UgYXR0YWNobWVudA==",
            },
        )
        assert attachment is not None

        field_list = live_smoke.dispatch(
            "list_custom_field_list",
            {"listId": list_id},
        )
        assert isinstance(field_list.get("fields"), list)

        created_doc = live_smoke.dispatch(
            "doc_create",
            {
                "confirm": "yes",
                "workspaceId": config.workspace_id,
                "name": live_smoke.unique_name("codex-smoke-doc"),
                "content": "initial doc body",
            },
        )
        doc_id = _extract_id(created_doc, "id", "doc_id")
        assert doc_id

        created_page = live_smoke.dispatch(
            "doc_page_create",
            {
                "confirm": "yes",
                "workspaceId": config.workspace_id,
                "docId": doc_id,
                "title": "Smoke Page",
                "content": "initial page body",
            },
        )
        page_id = _extract_id(created_page, "id", "page_id")
        assert page_id

        live_smoke.dispatch(
            "doc_page_update",
            {
                "confirm": "yes",
                "workspaceId": config.workspace_id,
                "docId": doc_id,
                "pageId": page_id,
                "title": "Smoke Page Updated",
                "content": "updated page body",
            },
        )

        page_read = live_smoke.dispatch(
            "doc_page_read",
            {
                "workspaceId": config.workspace_id,
                "docId": doc_id,
                "pageId": page_id,
            },
        )
        assert page_read.get("name") == "Smoke Page Updated"
    finally:
        for task_id in [bulk_subtask_id, subtask_id, parent_task_id]:
            if task_id:
                live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": task_id})
        if list_id:
            live_smoke.dispatch("list_delete", {"confirm": "yes", "listId": list_id})


def test_live_smoke_runtime_task_custom_field_tools() -> None:
    config = live_smoke.load_live_smoke_config()
    search_payload = live_smoke.dispatch(
        "task_search",
        {
            "teamId": config.workspace_id,
            "pageSize": 100,
            "includeClosed": True,
            "includeSubtasks": True,
            "includeTasksInMultipleLists": True,
        },
    )

    fixture: dict[str, Any] | None = None
    for task in search_payload.get("tasks", []):
        if not isinstance(task, dict):
            continue
        custom_fields = task.get("custom_fields") or []
        for field in custom_fields:
            if not isinstance(field, dict):
                continue
            if str(field.get("name") or "").strip().lower() != "mytestfield":
                continue
            options = ((field.get("type_config") or {}).get("options") if isinstance(field.get("type_config"), dict) else None) or []
            option_id = _extract_id(options[0], "id") if options and isinstance(options[0], dict) else None
            list_id = _extract_id(task.get("list", {}), "id", "list_id")
            if option_id and list_id:
                fixture = {"fieldId": str(field["id"]), "optionId": option_id, "listId": list_id}
                break
        if fixture:
            break

    assert fixture is not None

    task_id: str | None = None
    try:
        created_task = live_smoke.dispatch(
            "task_create",
            {
                "confirm": "yes",
                "listId": fixture["listId"],
                "name": live_smoke.unique_name("codex-smoke-custom-field-task"),
            },
        )
        task_id = _extract_id(created_task, "id", "task_id")
        assert task_id

        set_value = live_smoke.dispatch(
            "task_custom_field_set_value",
            {
                "confirm": "yes",
                "taskId": task_id,
                "fieldId": fixture["fieldId"],
                "value": fixture["optionId"],
            },
        )
        assert set_value is not None

        task_after_set = live_smoke.raw_task_read(task_id)
        matching_field = next(
            (
                field
                for field in (task_after_set.get("custom_fields") or [])
                if isinstance(field, dict) and _extract_id(field, "id") == fixture["fieldId"]
            ),
            None,
        )
        assert isinstance(matching_field, dict)
        assert matching_field.get("value") is not None

        clear_value = live_smoke.dispatch(
            "task_custom_field_clear_value",
            {
                "confirm": "yes",
                "taskId": task_id,
                "fieldId": fixture["fieldId"],
            },
        )
        assert clear_value is not None

        task_after_clear = live_smoke.raw_task_read(task_id)
        cleared_field = next(
            (
                field
                for field in (task_after_clear.get("custom_fields") or [])
                if isinstance(field, dict) and _extract_id(field, "id") == fixture["fieldId"]
            ),
            None,
        )
        assert isinstance(cleared_field, dict)
        assert "value" not in cleared_field or cleared_field.get("value") in (None, "")
    finally:
        if task_id:
            live_smoke.dispatch("task_delete", {"confirm": "yes", "taskId": task_id})
        try:
            live_smoke.delete_space_tag(config.space_id, updated_tag_name)
        except Exception:
            pass
