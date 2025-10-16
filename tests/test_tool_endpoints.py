import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

try:  # noqa: E402 - allow tests to skip when optional dependencies missing
    from clickup_mcp.server import (
        ClickUpConfig,
        ClickUpResponse,
        HttpMethod,
        TaskLookupFields,
        create_server,
    )
except ModuleNotFoundError as exc:  # pragma: no cover - exercised in minimal CI environments
    pytest.skip(f"clickup_mcp.server dependencies missing: {exc}", allow_module_level=True)


class ClickUpConfigTests(TestCase):
    def test_base_url_rewrites_clickup_host(self):
        config = ClickUpConfig(base_url="https://clickup.com/api/v2")
        self.assertEqual(str(config.base_url), "https://api.clickup.com/api/v2")

    def test_base_url_rewrites_app_hostname_and_trailing_slash(self):
        config = ClickUpConfig(base_url="https://app.clickup.com/")
        self.assertEqual(str(config.base_url), "https://api.clickup.com/api/v2")


class DummyClient:
    def __init__(self):
        self.calls = []

    def request_checked(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        return ClickUpResponse(status_code=200, headers={}, data={"ok": True})

    def ensure_team_id(self, team_id):
        return team_id or 999


class ToolEndpointTests(TestCase):
    def setUp(self):
        server = create_server()
        self.tool_manager = server._fastmcp._tool_manager

    def test_get_tasks_uses_clickup_list_endpoint(self):
        client = DummyClient()
        get_tasks = self.tool_manager.get_tool("get_tasks").fn

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._resolve_list_identifier", return_value="list-123"), \
            patch("clickup_mcp.server._normalize_assignees", return_value=[321]):
            result = get_tasks(
                ctx=object(),
                list_name="Inbox",
                assignees=["someone@example.com"],
                include_closed=True,
                archived=False,
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.GET)
        self.assertEqual(path, "/list/list-123/task")
        query = kwargs.get("query_params")
        self.assertIsInstance(query, dict)
        self.assertEqual(query.get("assignees[]"), [321])
        self.assertEqual(query.get("include_closed"), "true")
        self.assertEqual(query.get("archived"), "false")

    def test_get_task_uses_clickup_task_endpoint(self):
        client = DummyClient()
        get_task = self.tool_manager.get_tool("get_task").fn

        def augment(client_arg, task_id, team_id=None, query_params=None):
            self.assertIs(client_arg, client)
            self.assertEqual(task_id, "task-abc")
            self.assertEqual(query_params, {"include_subtasks": "true"})
            return {"include_subtasks": "true", "team_id": 999}

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._resolve_task_identifier", return_value="task-abc"), \
            patch("clickup_mcp.server._augment_task_query_params", side_effect=augment):
            result = get_task(
                ctx=object(),
                task_name="Quarterly Planning",
                include_subtasks=True,
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.GET)
        self.assertEqual(path, "/task/task-abc")
        self.assertEqual(kwargs.get("query_params"), {"include_subtasks": "true", "team_id": 999})

    def test_get_list_uses_clickup_list_endpoint(self):
        client = DummyClient()
        get_list = self.tool_manager.get_tool("get_list").fn

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._resolve_list_identifier", return_value="list-777"):
            result = get_list(ctx=object(), list_name="Backlog")

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.GET)
        self.assertEqual(path, "/list/list-777")
        self.assertFalse(kwargs)

    def test_tool_annotations_mark_read_only_and_destructive_behaviour(self):
        get_tasks_tool = self.tool_manager.get_tool("get_tasks")
        self.assertTrue(get_tasks_tool.annotations.readOnlyHint)
        self.assertFalse(get_tasks_tool.annotations.destructiveHint)

        create_task_tool = self.tool_manager.get_tool("create_task")
        self.assertFalse(create_task_tool.annotations.readOnlyHint)
        self.assertFalse(create_task_tool.annotations.destructiveHint)

        delete_task_tool = self.tool_manager.get_tool("delete_task")
        self.assertFalse(delete_task_tool.annotations.readOnlyHint)
        self.assertTrue(delete_task_tool.annotations.destructiveHint)

    def test_get_list_description_points_to_get_tasks(self):
        get_list_tool = self.tool_manager.get_tool("get_list")
        self.assertIn("Use get_tasks", get_list_tool.description)

    def test_create_bulk_tasks_sets_custom_query_params(self):
        client = DummyClient()
        create_bulk = self.tool_manager.get_tool("create_bulk_tasks").fn

        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._resolve_list_identifier", return_value="list-555"):
            result = create_bulk(
                ctx=ctx,
                tasks=[
                    {
                        "name": "New Task",
                        "listId": "list-555",
                        "custom_id": "CUS-123",
                    }
                ],
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.POST)
        self.assertEqual(path, "/task/bulk")
        self.assertEqual(
            kwargs.get("json_body"),
            {
                "team_id": 999,
                "tasks": [
                    {
                        "list_id": "list-555",
                        "name": "New Task",
                        "custom_id": "CUS-123",
                    }
                ],
            },
        )
        self.assertEqual(
            kwargs.get("query_params"),
            {"custom_task_ids": "true", "team_id": 999},
        )
        session_id = ctx.session._clickup_client_session_id
        self.assertEqual(
            kwargs.get("headers"),
            {"X-Client-Session-Id": session_id, "Team-ID": "999"},
        )

    def test_delete_bulk_tasks_sets_custom_query_params(self):
        client = DummyClient()
        delete_bulk = self.tool_manager.get_tool("delete_bulk_tasks").fn

        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._resolve_task_identifier", return_value="CUS-1"):
            result = delete_bulk(
                ctx=ctx,
                tasks=[{"taskId": "CUS-1"}],
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.DELETE)
        self.assertEqual(path, "/task/bulk")
        self.assertEqual(
            kwargs.get("json_body"),
            {"team_id": 999, "task_ids": ["CUS-1"]},
        )
        self.assertEqual(
            kwargs.get("query_params"),
            {"custom_task_ids": "true", "team_id": 999},
        )
        session_id = ctx.session._clickup_client_session_id
        self.assertEqual(
            kwargs.get("headers"),
            {"X-Client-Session-Id": session_id, "Team-ID": "999"},
        )

    def test_move_bulk_tasks_sets_custom_query_params(self):
        client = DummyClient()
        move_bulk = self.tool_manager.get_tool("move_bulk_tasks").fn

        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._resolve_list_identifier", return_value="list-999"), \
            patch("clickup_mcp.server._resolve_task_identifier", return_value="CUS-42"):
            result = move_bulk(
                ctx=ctx,
                tasks=[{"taskId": "CUS-42"}],
                destination_list_id="list-999",
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.POST)
        self.assertEqual(path, "/task/move/bulk")
        self.assertEqual(
            kwargs.get("json_body"),
            {
                "team_id": 999,
                "list_id": "list-999",
                "task_ids": ["CUS-42"],
            },
        )
        self.assertEqual(
            kwargs.get("query_params"),
            {"custom_task_ids": "true", "team_id": 999},
        )
        session_id = ctx.session._clickup_client_session_id
        self.assertEqual(
            kwargs.get("headers"),
            {"X-Client-Session-Id": session_id, "Team-ID": "999"},
        )

    def test_update_bulk_tasks_includes_team_header_for_oauth(self):
        client = DummyClient()
        client.uses_oauth_authentication = lambda: True
        update_bulk = self.tool_manager.get_tool("update_bulk_tasks").fn

        ctx = SimpleNamespace(session=SimpleNamespace())

        lookup = TaskLookupFields("task-123", None, None, None, None)

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._extract_task_lookup_fields", return_value=lookup), \
            patch("clickup_mcp.server._normalize_assignees", return_value=None), \
            patch("clickup_mcp.server._resolve_task_identifier", return_value="task-123"):
            result = update_bulk(
                ctx=ctx,
                tasks=[{"taskId": "task-123", "status": "In Progress"}],
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.PUT)
        self.assertEqual(path, "/task/bulk")
        session_id = ctx.session._clickup_client_session_id
        self.assertEqual(
            kwargs.get("headers"),
            {"X-Client-Session-Id": session_id, "Team-ID": "999"},
        )

    def test_update_bulk_tasks_handles_alphanumeric_task_ids(self):
        client = DummyClient()
        update_bulk = self.tool_manager.get_tool("update_bulk_tasks").fn

        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._normalize_assignees", return_value=None), \
            patch("clickup_mcp.server._resolve_task_identifier") as resolve_mock:
            result = update_bulk(
                ctx=ctx,
                tasks=[{"taskId": "869avmhjm", "status": "complete"}],
            )

        self.assertEqual(result["status_code"], 200)
        resolve_mock.assert_not_called()
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.PUT)
        self.assertEqual(path, "/task/bulk")
        self.assertEqual(
            kwargs.get("json_body"),
            {"team_id": 999, "tasks": [{"id": "869avmhjm", "status": "complete"}]},
        )
        self.assertEqual(kwargs.get("query_params"), {"team_id": 999})
