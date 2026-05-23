from __future__ import annotations

import re
from pathlib import Path

from harness.status_validation import validate_status_artifact


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_status_artifact_matches_manifest_contract() -> None:
    result = validate_status_artifact(REPO_ROOT)
    assert result.errors == []


def test_tool_reference_snapshot_counts_match_status_artifact() -> None:
    tool_reference = (REPO_ROOT / "docs" / "tool-reference.md").read_text(encoding="utf-8")
    result = validate_status_artifact(REPO_ROOT)
    assert result.errors == []

    documented_counts = {
        state: int(count)
        for count, state in re.findall(r"- `(\d+)` tools are `([^`]+)`", tool_reference)
    }

    for state, count in documented_counts.items():
        assert result.state_counts[state] == count
