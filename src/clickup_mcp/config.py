"""Runtime configuration helpers for the ClickUp MCP server."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, MutableMapping, Optional, Set

DEFAULT_BATCH_SIZE = 10
DEFAULT_CONCURRENCY = 3
DEFAULT_RETRY_COUNT = 3
DEFAULT_RETRY_DELAY = 1.0
MAX_CONCURRENCY = 10
MAX_RETRY_COUNT = 6


@dataclass(frozen=True)
class ToolGate:
    """Allow/deny configuration for tool registration."""

    enabled: Optional[Set[str]]
    disabled: Set[str]

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "ToolGate":
        enabled_raw = env.get("ENABLED_TOOLS", "").strip()
        disabled_raw = env.get("DISABLED_TOOLS", "").strip()
        enabled: Optional[Set[str]]
        if enabled_raw:
            enabled = {item.strip() for item in enabled_raw.split(",") if item.strip()}
        else:
            enabled = None
        disabled: Set[str] = {item.strip() for item in disabled_raw.split(",") if item.strip()}
        return cls(enabled=enabled, disabled=disabled)

    def is_enabled(self, name: str) -> bool:
        normalised = name.strip()
        if not normalised:
            return False
        if self.enabled is not None:
            return normalised in self.enabled
        return normalised not in self.disabled


@dataclass(frozen=True)
class ServerConfig:
    """Consolidated configuration used by the MCP runtime."""

    api_token: Optional[str]
    default_team_id: Optional[int]
    batch_size: int = DEFAULT_BATCH_SIZE
    concurrency: int = DEFAULT_CONCURRENCY
    retry_count: int = DEFAULT_RETRY_COUNT
    retry_delay: float = DEFAULT_RETRY_DELAY
    tool_gate: ToolGate = ToolGate(enabled=None, disabled=set())

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "ServerConfig":
        source = env or os.environ
        api_token = source.get("CLICKUP_API_TOKEN")
        default_team_raw = source.get("CLICKUP_TEAM_ID")
        default_team_id = int(default_team_raw) if default_team_raw else None
        batch_size = _clamped_int(source.get("BULK_BATCH_SIZE"), DEFAULT_BATCH_SIZE, minimum=1)
        concurrency = _clamped_int(
            source.get("BULK_CONCURRENCY"),
            DEFAULT_CONCURRENCY,
            minimum=1,
            maximum=MAX_CONCURRENCY,
        )
        retry_count = _clamped_int(
            source.get("BULK_RETRY_COUNT"),
            DEFAULT_RETRY_COUNT,
            minimum=0,
            maximum=MAX_RETRY_COUNT,
        )
        retry_delay = _clamped_float(source.get("BULK_RETRY_DELAY_SEC"), DEFAULT_RETRY_DELAY, minimum=0.0)
        gate = ToolGate.from_env(source)
        return cls(
            api_token=api_token,
            default_team_id=default_team_id,
            batch_size=batch_size,
            concurrency=concurrency,
            retry_count=retry_count,
            retry_delay=retry_delay,
            tool_gate=gate,
        )

    def batch_options(self) -> MutableMapping[str, int | float]:
        """Return default batch execution options."""

        return {
            "batch_size": self.batch_size,
            "concurrency": self.concurrency,
            "retry_count": self.retry_count,
            "retry_delay": self.retry_delay,
        }


def _clamped_int(value: Optional[str], default: int, *, minimum: int, maximum: Optional[int] = None) -> int:
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _clamped_float(value: Optional[str], default: float, *, minimum: float) -> float:
    try:
        parsed = float(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, parsed)


__all__ = ["ServerConfig", "ToolGate"]
