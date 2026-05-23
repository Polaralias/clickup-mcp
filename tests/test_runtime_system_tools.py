from __future__ import annotations

import asyncio

import server


def _dispatch(name: str, args: dict | None = None) -> dict:
    return asyncio.run(server.runtime.dispatch(name, args or {}))


def test_ping_echoes_message() -> None:
    assert _dispatch("ping", {"message": "hello"}) == {"message": "hello"}


def test_health_reports_runtime_safety_configuration() -> None:
    payload = _dispatch("health", {"verbose": True})

    assert payload["status"] == "ok"
    assert payload["server"] == "clickup-mcp"
    assert payload["writeMode"] in {"write", "read", "selective"}
    assert isinstance(payload["charLimit"], int)
    assert isinstance(payload["maxAttachmentMb"], int)
    assert isinstance(payload["reportingMaxTasks"], int)
    assert isinstance(payload["defaultRiskWindowDays"], int)


def test_tool_catalogue_mirrors_manifest_tool_count() -> None:
    payload = _dispatch("tool_catalogue")

    assert "tools" in payload
    assert isinstance(payload["tools"], list)
    assert len(payload["tools"]) == len(server.manifest)
