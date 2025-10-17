import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict
from unittest import TestCase
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

try:  # noqa: E402 - allow tests to skip when optional dependencies missing
    from clickup_mcp.config import ServerConfig, ToolGate
    from clickup_mcp.server import (  # type: ignore
        ClickUpConfig,
        ClickUpResponse,
        HttpMethod,
        create_server,
    )
    from clickup_mcp.services.clickup.bulk_service import BulkService
    from clickup_mcp.services.clickup.utils import BatchResult, ClickUpServiceError, process_batch
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

    def test_tool_gating_respects_allowlist(self):
        gate = ToolGate(enabled={"get_task"}, disabled=set())
        config = ServerConfig(
            api_token=None,
            default_team_id=None,
            batch_size=5,
            concurrency=2,
            retry_count=1,
            retry_delay=0.5,
            tool_gate=gate,
        )

        with patch("clickup_mcp.server.RUNTIME_CONFIG", config):
            gated_server = create_server()

        tool_names = gated_server._fastmcp._tool_manager._tools.keys()
        self.assertIn("get_task", tool_names)
        self.assertNotIn("create_task", tool_names)

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

    def test_get_workspace_tasks_uses_clickup_team_endpoint(self):
        client = DummyClient()
        get_workspace_tasks = self.tool_manager.get_tool("get_workspace_tasks").fn

        with patch("clickup_mcp.server._get_or_create_client", return_value=client), \
            patch("clickup_mcp.server._normalize_assignees", return_value=[654]):
            result = get_workspace_tasks(
                ctx=object(),
                team_id=555,
                list_ids=["list-1"],
                tags=["urgent"],
                include_closed=True,
                reverse=True,
                detail_level="summary",
                subtasks=False,
                due_date_gt=1700000000,
                assignees=["someone"],
            )

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(len(client.calls), 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, HttpMethod.GET)
        self.assertEqual(path, "/team/555/task")
        query = kwargs.get("query_params")
        self.assertIsInstance(query, dict)
        self.assertEqual(query.get("page"), 0)
        self.assertEqual(query.get("list_ids[]"), ["list-1"])
        self.assertEqual(query.get("tags[]"), ["urgent"])
        self.assertEqual(query.get("include_closed"), "true")
        self.assertEqual(query.get("reverse"), "true")
        self.assertEqual(query.get("detail_level"), "summary")
        self.assertEqual(query.get("subtasks"), "false")
        self.assertEqual(query.get("due_date_gt"), 1700000000000)
        self.assertEqual(query.get("assignees[]"), [654])

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

    def test_create_bulk_tasks_delegates_to_service(self):
        calls: Dict[str, Any] = {}

        def fake_create_bulk_tasks(**kwargs: Any) -> BatchResult:
            calls.update(kwargs)
            return BatchResult(successful=[{"id": "task-1"}], failed=[], totals={"success": 1, "failure": 0, "total": 1})

        service = SimpleNamespace(create_bulk_tasks=fake_create_bulk_tasks)
        create_bulk = self.tool_manager.get_tool("create_bulk_tasks").fn
        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_bulk_service", return_value=service):
            result = create_bulk(
                ctx=ctx,
                tasks=[{"name": "New Task"}],
                list_id="list-555",
                options={"concurrency": 5},
            )

        self.assertEqual(result["totals"]["success"], 1)
        self.assertEqual(calls["default_list_id"], "list-555")
        self.assertEqual(calls["options"], {"concurrency": 5})

    def test_update_bulk_tasks_delegates_to_service(self):
        captured: Dict[str, Any] = {}

        def fake_update_bulk_tasks(**kwargs: Any) -> BatchResult:
            captured.update(kwargs)
            return BatchResult(successful=[{"id": "task-1"}], failed=[], totals={"success": 1, "failure": 0, "total": 1})

        service = SimpleNamespace(update_bulk_tasks=fake_update_bulk_tasks)
        update_bulk = self.tool_manager.get_tool("update_bulk_tasks").fn
        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_bulk_service", return_value=service):
            result = update_bulk(
                ctx=ctx,
                tasks=[{"taskId": "task-123", "status": "open"}],
                team_id=123,
            )

        self.assertEqual(result["totals"]["total"], 1)
        self.assertEqual(captured["team_id"], 123)
        self.assertEqual(captured["tasks"][0]["status"], "open")

    def test_delete_bulk_tasks_delegates_to_service(self):
        captured: Dict[str, Any] = {}

        def fake_delete_bulk_tasks(**kwargs: Any) -> BatchResult:
            captured.update(kwargs)
            return BatchResult(successful=[], failed=[{"error": "boom"}], totals={"success": 0, "failure": 1, "total": 1})

        service = SimpleNamespace(delete_bulk_tasks=fake_delete_bulk_tasks)
        delete_bulk = self.tool_manager.get_tool("delete_bulk_tasks").fn
        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_bulk_service", return_value=service):
            result = delete_bulk(
                ctx=ctx,
                tasks=[{"taskId": "CUS-1"}],
            )

        self.assertEqual(result["totals"]["failure"], 1)
        self.assertEqual(captured["tasks"][0]["taskId"], "CUS-1")

    def test_move_bulk_tasks_delegates_to_service(self):
        captured: Dict[str, Any] = {}

        def fake_move_bulk_tasks(**kwargs: Any) -> BatchResult:
            captured.update(kwargs)
            return BatchResult(successful=[{"id": "task-1"}], failed=[], totals={"success": 1, "failure": 0, "total": 1})

        service = SimpleNamespace(move_bulk_tasks=fake_move_bulk_tasks)
        move_bulk = self.tool_manager.get_tool("move_bulk_tasks").fn
        ctx = SimpleNamespace(session=SimpleNamespace())

        with patch("clickup_mcp.server._get_bulk_service", return_value=service):
            result = move_bulk(
                ctx=ctx,
                tasks=[{"taskId": "CUS-42"}],
                target_list_name="Inbox",
            )

        self.assertEqual(result["totals"]["success"], 1)
        self.assertEqual(captured["target_list_name"], "Inbox")


class DummyBulkClient:
    def __init__(self):
        self.calls = []
        self.default_team = 999

    def request_checked(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        return ClickUpResponse(status_code=200, headers={}, data={"ok": True})

    def ensure_team_id(self, team_id):
        return team_id or self.default_team

    def resolve_list_id(self, *, team_id, list_id=None, list_name=None):
        if list_id:
            return list_id
        if list_name:
            return f"resolved-{list_name}"
        raise ValueError("List identifier required")

    def resolve_task_id(self, *, team_id, task_id=None, task_name=None, list_id=None):
        if task_id:
            return task_id
        if task_name:
            return f"resolved-{task_name}"
        return "resolved-task"

    def uses_oauth_authentication(self):
        return False


class BulkServiceTests(TestCase):
    def test_create_bulk_tasks_calls_single_endpoint(self):
        client = DummyBulkClient()
        service = BulkService(client)

        result = service.create_bulk_tasks(
            tasks=[{"name": "Task"}],
            default_list_id="list-1",
            team_id=None,
            options={"concurrency": 1, "retry_count": 0},
        )

        self.assertEqual(result.totals["success"], 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(path, "/list/list-1/task")
        self.assertEqual(kwargs.get("json_body"), {"name": "Task"})

    def test_update_bulk_tasks_adds_custom_query_params(self):
        client = DummyBulkClient()
        service = BulkService(client)

        result = service.update_bulk_tasks(
            tasks=[{"customTaskId": "CUS-1", "status": "open"}],
            team_id=None,
            options={"concurrency": 1, "retry_count": 0},
        )

        self.assertEqual(result.totals["success"], 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, "PUT")
        self.assertEqual(path, "/task/CUS-1")
        self.assertIn("custom_task_ids", kwargs.get("query_params", {}))

    def test_delete_bulk_tasks_invokes_task_endpoint(self):
        client = DummyBulkClient()
        service = BulkService(client)

        result = service.delete_bulk_tasks(
            tasks=[{"taskId": "task-123"}],
            team_id=None,
            options={"concurrency": 1, "retry_count": 0},
        )

        self.assertEqual(result.totals["success"], 1)
        method, path, kwargs = client.calls[0]
        self.assertEqual(method, "DELETE")
        self.assertEqual(path, "/task/task-123")
        self.assertEqual(kwargs.get("query_params"), {})


@pytest.mark.asyncio
async def test_process_batch_collects_failures():
    async def processor(item: str):
        if item == "bad":
            raise RuntimeError("boom")
        return item

    result = await process_batch(
        ["good", "bad"],
        processor,
        {"retry_count": 0, "continue_on_error": True, "concurrency": 1},
    )

    assert result.totals == {"success": 1, "failure": 1, "total": 2}
    assert result.failed[0]["error"].lower().startswith("boom")


@pytest.mark.asyncio
async def test_process_batch_halts_when_continue_disabled():
    async def processor(item: str):
        if item == "fail":
            raise RuntimeError("fail")
        return item

    with pytest.raises(ClickUpServiceError):
        await process_batch(
            ["ok", "fail", "skip"],
            processor,
            {"retry_count": 0, "continue_on_error": False, "concurrency": 1},
        )
