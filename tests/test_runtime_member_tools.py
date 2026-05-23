from __future__ import annotations

import asyncio
from typing import Any

import server


class _StubClient:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.paths: list[str] = []

    def request(self, path: str, **_: Any) -> dict[str, Any]:
        self.paths.append(path)
        return self.payload


def _runtime(payload: dict[str, Any]) -> tuple[server.ClickUpRuntime, _StubClient]:
    client = _StubClient(payload)
    runtime = server.ClickUpRuntime(
        client,
        manifest=[],
        config=server.RuntimeConfig(team_id="workspace-123"),
    )
    return runtime, client


def test_member_list_for_workspace_reads_members_from_team_payload() -> None:
    runtime, client = _runtime(
        {
            "team": {
                "members": [
                    {"user": {"id": "1", "username": "alice", "email": "alice@example.com"}},
                    {"user": {"id": "2", "username": "bob", "email": "bob@example.com"}},
                ]
            }
        }
    )

    payload = asyncio.run(runtime.dispatch("member_list_for_workspace", {"teamId": "workspace-999"}))

    assert client.paths == ["team/workspace-999"]
    assert payload == {
        "teamId": "workspace-999",
        "members": [
            {"id": "1", "username": "alice", "email": "alice@example.com"},
            {"id": "2", "username": "bob", "email": "bob@example.com"},
        ],
    }


def test_member_search_by_name_uses_normalized_team_members() -> None:
    runtime, _client = _runtime(
        {
            "team": {
                "members": [
                    {"user": {"id": "1", "username": "Alice Example", "email": "alice@example.com"}},
                    {"user": {"id": "2", "username": "Bob Example", "email": "bob@example.com"}},
                ]
            }
        }
    )

    payload = asyncio.run(runtime.dispatch("member_search_by_name", {"teamId": "workspace-999", "query": "bob"}))

    assert payload == {
        "teamId": "workspace-999",
        "results": [{"id": "2", "username": "Bob Example", "email": "bob@example.com"}],
    }


def test_member_resolve_matches_by_id_username_and_email() -> None:
    runtime, _client = _runtime(
        {
            "team": {
                "members": [
                    {"user": {"id": "1", "username": "alice", "email": "alice@example.com"}},
                    {"user": {"id": "2", "username": "bob", "email": "bob@example.com"}},
                ]
            }
        }
    )

    payload = asyncio.run(
        runtime.dispatch(
            "member_resolve",
            {"teamId": "workspace-999", "identifiers": ["2", "alice@example.com", "unknown"]},
        )
    )

    assert payload == {
        "teamId": "workspace-999",
        "resolved": [
            {"id": "2", "username": "bob", "email": "bob@example.com"},
            {"id": "1", "username": "alice", "email": "alice@example.com"},
        ],
    }


def test_task_assignee_resolve_uses_same_normalized_member_source() -> None:
    runtime, _client = _runtime(
        {
            "team": {
                "members": [
                    {"user": {"id": "1", "username": "alice", "email": "alice@example.com"}},
                    {"user": {"id": "2", "username": "bob", "email": "bob@example.com"}},
                ]
            }
        }
    )

    payload = asyncio.run(
        runtime.dispatch(
            "task_assignee_resolve",
            {"teamId": "workspace-999", "identifiers": ["bob", "alice@example.com"]},
        )
    )

    assert payload == {
        "teamId": "workspace-999",
        "resolved": [
            {"id": "2", "username": "bob", "email": "bob@example.com"},
            {"id": "1", "username": "alice", "email": "alice@example.com"},
        ],
    }
