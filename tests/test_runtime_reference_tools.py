from __future__ import annotations

import asyncio

import pytest
import requests

import server


class _Response:
    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        return None


def _runtime() -> server.ClickUpRuntime:
    return server.ClickUpRuntime(
        client=server.runtime._client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )


def test_reference_link_list_reads_official_llms_index_and_honors_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    llms_index = """# ClickUp Documentation
## Guides
- [Views](https://developer.clickup.com/docs/views.md): Work with views using the ClickUp API.
- [Tasks](https://developer.clickup.com/docs/tasks.md): Work with tasks using the ClickUp API.
## API Reference
- [Get Task](https://developer.clickup.com/reference/gettask.md): View information about a task.
- [Get Tasks](https://developer.clickup.com/reference/gettasks.md): View the tasks in a List.
"""

    def _fake_get(url: str, timeout: int) -> _Response:
        assert url == "https://developer.clickup.com/llms.txt"
        assert timeout == 10
        return _Response(llms_index)

    monkeypatch.setattr(requests, "get", _fake_get)

    payload = asyncio.run(_runtime().dispatch("reference_link_list", {"limit": 2}))

    assert payload == {
        "links": [
            {
                "label": "Views",
                "url": "https://developer.clickup.com/docs/views.md",
                "section": "Guides",
                "description": "Work with views using the ClickUp API.",
            },
            {
                "label": "Tasks",
                "url": "https://developer.clickup.com/docs/tasks.md",
                "section": "Guides",
                "description": "Work with tasks using the ClickUp API.",
            },
        ]
    }


def test_reference_page_fetch_reads_markdown_and_honors_preview_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    markdown = "# Get Task\n\nView information about a task.\n\n## Path Params\n\n`task_id` required\n"

    def _fake_get(url: str, timeout: int) -> _Response:
        assert url == "https://developer.clickup.com/reference/gettask.md"
        assert timeout == 10
        return _Response(markdown)

    monkeypatch.setattr(requests, "get", _fake_get)

    payload = asyncio.run(
        _runtime().dispatch(
            "reference_page_fetch",
            {
                "url": "https://developer.clickup.com/reference/gettask.md",
                "maxCharacters": 20,
            },
        )
    )

    assert payload == {
        "source": "https://developer.clickup.com/reference/gettask.md",
        "body": "# Get Task\n\nView inf",
        "truncated": True,
    }


def test_reference_page_fetch_rejects_non_official_urls() -> None:
    with pytest.raises(ValueError, match="Only developer.clickup.com"):
        asyncio.run(
            _runtime().dispatch(
                "reference_page_fetch",
                {"url": "https://example.com/not-clickup"},
            )
        )
