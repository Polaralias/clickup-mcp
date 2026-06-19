from __future__ import annotations

import importlib
import sys

import pytest
import server


def test_server_import_requires_explicit_api_key_or_disabled_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("CLICKUP_MCP_API_KEY", "MCP_API_KEY", "MCP_API_KEYS", "API_KEY_MODE"):
        monkeypatch.delenv(key, raising=False)

    sys.modules.pop("server", None)
    with pytest.raises(RuntimeError) as excinfo:
        importlib.import_module("server")

    message = str(excinfo.value)
    assert "CLICKUP_MCP_API_KEY" in message
    assert "API_KEY_MODE=disabled" in message
    sys.modules["server"] = server
