from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self, response: dict[str, Any] | None = None) -> None:
        self.response = response or {"ok": True}
        self.calls: list[dict[str, Any]] = []

    def request(self, path: str, **kwargs: Any) -> dict[str, Any]:
        self.calls.append({"path": path, **kwargs})
        return self.response


def _runtime() -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient()
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_space_tag_create_sends_nested_tag_payload() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "space_tag_create",
            {
                "confirm": "yes",
                "spaceId": "space-123",
                "name": "Release",
                "foregroundColor": "#111111",
                "backgroundColor": "#22aa22",
            },
        )
    )

    assert payload == {"ok": True}
    assert client.calls == [
        {
            "path": "space/space-123/tag",
            "method": "POST",
            "body": {
                "tag": {
                    "name": "Release",
                    "tag_fg": "#111111",
                    "tag_bg": "#22aa22",
                }
            },
        }
    ]


def test_list_create_from_template_uses_list_template_route() -> None:
    runtime, client = _runtime()

    payload = asyncio.run(
        runtime.dispatch(
            "list_create_from_template",
            {
                "confirm": "yes",
                "spaceId": "space-123",
                "templateId": "template-456",
                "name": "Sprint Board",
                "useTemplateOptions": True,
            },
        )
    )

    assert payload == {"ok": True}
    assert client.calls == [
        {
            "path": "space/space-123/list_template/template-456",
            "method": "POST",
            "body": {
                "name": "Sprint Board",
                "use_template_options": True,
            },
        }
    ]
