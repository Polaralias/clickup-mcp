from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def request_v3(self, path: str, **kwargs: Any) -> Any:
        self.calls.append({"path": path, **kwargs})
        if path == "workspaces/workspace-123/docs/doc-1":
            return {
                "id": "doc-1",
                "name": "Doc One",
                "workspace": {"id": "workspace-123", "name": "Main"},
                "space": {"id": "space-1", "name": "Planning"},
                "folder": {"id": "folder-1", "name": "Docs"},
            }
        if path == "workspaces/workspace-123/docs/doc-1/page_listing":
            return [
                {"id": "page-1", "title": "Overview", "content": "Overview body"},
                {"id": "page-2", "title": "Details", "content": "Details body"},
            ]
        if path == "workspaces/workspace-123/docs/doc-1/pages":
            return [
                {"id": "page-1", "title": "Overview", "content": "Overview body"},
                {"id": "page-2", "title": "Details", "content": "Details body"},
            ]
        if path == "workspaces/workspace-123/docs":
            docs = [
                {
                    "id": "doc-1",
                    "name": "Doc One",
                    "workspace": {"id": "workspace-123", "name": "Main"},
                    "space": {"id": "space-1", "name": "Planning"},
                    "folder": {"id": "folder-1", "name": "Docs"},
                }
            ]
            return {"docs": docs}
        raise AssertionError(f"Unexpected request_v3 path: {path!r} kwargs={kwargs!r}")


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_doc_read_defaults_include_pages_and_applies_page_limit() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "doc_read",
            {"workspaceId": "workspace-123", "docId": "doc-1", "pageLimit": 1},
        )
    )

    assert client.calls == [
        {"path": "workspaces/workspace-123/docs/doc-1"},
        {"path": "workspaces/workspace-123/docs/doc-1/page_listing"},
    ]
    assert len(payload["pages"]) == 1
    assert payload["pages"][0]["id"] == "page-1"
    assert payload["summary"]["pageCount"] == 1
    assert payload["summary"]["pagePreviews"][0]["pageId"] == "page-1"


def test_doc_list_defaults_include_previews() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch("doc_list", {"workspaceId": "workspace-123"})
    )

    assert client.calls == [
        {"path": "workspaces/workspace-123/docs", "params": {"search": None, "limit": None, "page": None, "space_id": None, "folder_id": None}},
        {"path": "workspaces/workspace-123/docs/doc-1/page_listing"},
    ]
    assert payload["count"] == 1
    assert payload["docs"][0]["summary"]["pageCount"] == 2
    assert len(payload["docs"][0]["summary"]["pagePreviews"]) == 2


def test_doc_search_expand_pages_enriches_results() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "doc_search",
            {"workspaceId": "workspace-123", "query": "doc", "expandPages": True},
        )
    )

    assert client.calls == [
        {"path": "workspaces/workspace-123/docs", "params": {"search": "doc", "limit": None}},
        {"path": "workspaces/workspace-123/docs/doc-1/page_listing"},
    ]
    assert payload["count"] == 1
    assert payload["docs"][0]["summary"]["pageCount"] == 2


def test_doc_search_bulk_expand_pages_enriches_each_query() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "doc_search_bulk",
            {"workspaceId": "workspace-123", "queries": ["one", "two"], "expandPages": True},
        )
    )

    assert client.calls == [
        {"path": "workspaces/workspace-123/docs", "params": {"search": "one", "limit": None}},
        {"path": "workspaces/workspace-123/docs/doc-1/page_listing"},
        {"path": "workspaces/workspace-123/docs", "params": {"search": "two", "limit": None}},
        {"path": "workspaces/workspace-123/docs/doc-1/page_listing"},
    ]
    assert len(payload["queries"]) == 2
    assert payload["queries"][0]["count"] == 1
    assert payload["queries"][0]["docs"][0]["summary"]["pageCount"] == 2
