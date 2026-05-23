from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request_v3(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        if path == "workspaces/workspace-123/docs/doc-1/page_listing":
            return [
                {"id": "page-1", "title": "Overview", "content": "Overview body"},
                {"id": "page-2", "title": "Details", "content": "Details body"},
            ]
        if path == "workspaces/workspace-123/docs/doc-1/pages":
            return [
                {"id": "page-1", "title": "Overview", "content": "Overview body"},
                {"id": "page-2", "title": "Details", "content": "Details body"},
                {"id": "page-3", "title": "Ignored", "content": "Ignored body"},
            ]
        if path == "workspaces/workspace-123/docs/doc-1/pages/page-2":
            return {"id": "page-2", "title": "Details", "content": "Details body"}
        raise AssertionError(f"Unexpected request_v3 path: {path}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_doc_page_list_uses_workspace_scoped_route_and_list_payload() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(runtime.dispatch("doc_page_list", {"workspaceId": "workspace-123", "docId": "doc-1"}))

    assert client.calls == [{"path": "workspaces/workspace-123/docs/doc-1/page_listing"}]
    assert payload == {
        "pages": [
            {
                "id": "page-1",
                "title": "Overview",
                "content": "Overview body",
                "preview": "Overview body",
                "previewTruncated": False,
            },
            {
                "id": "page-2",
                "title": "Details",
                "content": "Details body",
                "preview": "Details body",
                "previewTruncated": False,
            },
        ],
        "count": 2,
    }


def test_doc_pages_read_filters_requested_ids_from_workspace_collection() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "doc_pages_read",
            {"workspaceId": "workspace-123", "docId": "doc-1", "pageIds": ["page-2", "page-1"]},
        )
    )

    assert client.calls == [{"path": "workspaces/workspace-123/docs/doc-1/pages"}]
    assert payload == {
        "pages": [
            {
                "id": "page-1",
                "title": "Overview",
                "content": "Overview body",
                "preview": "Overview body",
                "previewTruncated": False,
            },
            {
                "id": "page-2",
                "title": "Details",
                "content": "Details body",
                "preview": "Details body",
                "previewTruncated": False,
            },
        ],
        "count": 2,
    }


def test_doc_page_read_uses_workspace_scoped_page_route() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "doc_page_read",
            {"workspaceId": "workspace-123", "docId": "doc-1", "pageId": "page-2"},
        )
    )

    assert client.calls == [{"path": "workspaces/workspace-123/docs/doc-1/pages/page-2"}]
    assert payload == {
        "id": "page-2",
        "title": "Details",
        "content": "Details body",
        "preview": "Details body",
        "previewTruncated": False,
    }
