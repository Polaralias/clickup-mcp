from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

REQUIRED_TOP_LEVEL_FIELDS = {
    "as_of",
    "source_manifest",
    "policy",
    "tools",
}

REQUIRED_POLICY_FIELDS = {
    "full_manifest_support_required",
    "end_state_requires_all_tools_validated",
    "non_validated_tools_require_evidence",
    "capability_level_compliance_internal_only",
}

REQUIRED_TOOL_FIELDS = {
    "current_validation_state",
    "end_state_compliant",
    "primary_next_action",
    "evidence",
}

ALLOWED_CURRENT_VALIDATION_STATES = {
    "validated",
    "repaired_regression_tested_live_pending",
    "validated_replacement_available",
    "confirmed_broken_runtime",
    "live_failing_untrustworthy",
    "manifest_runtime_drift",
    "unvalidated_never_tested",
    "unvalidated_stale_evidence",
}


@dataclass(frozen=True)
class StatusValidationResult:
    errors: list[str]
    manifest_tool_names: list[str]
    state_counts: Counter[str]


def _repo_root(start: Path | None = None) -> Path:
    if start is None:
        return Path(__file__).resolve().parents[1]
    resolved = start.resolve()
    if resolved.is_dir():
        return resolved
    return resolved.parent


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _repo_relative(path: Path, repo_root: Path) -> str:
    try:
        return path.relative_to(repo_root).as_posix()
    except ValueError:
        return str(path)


def validate_status_artifact(repo_root: Path | None = None) -> StatusValidationResult:
    root = _repo_root(repo_root)
    manifest_path = root / "tool_manifest_clickup.json"
    status_path = root / "docs" / "status" / "tool-validation-status.json"

    errors: list[str] = []
    manifest = _load_json(manifest_path)
    status = _load_json(status_path)

    manifest_tools = manifest.get("tools")
    if not isinstance(manifest_tools, list):
        return StatusValidationResult(
            errors=["tool_manifest_clickup.json is missing a top-level tools array"],
            manifest_tool_names=[],
            state_counts=Counter(),
        )

    manifest_tool_names = [str(tool.get("name") or "").strip() for tool in manifest_tools]
    if any(not name for name in manifest_tool_names):
        errors.append("tool_manifest_clickup.json contains at least one blank tool name")

    missing_top_level = REQUIRED_TOP_LEVEL_FIELDS - set(status)
    if missing_top_level:
        errors.append(
            "status artifact is missing top-level fields: "
            + ", ".join(sorted(missing_top_level))
        )

    as_of = status.get("as_of")
    if not isinstance(as_of, str):
        errors.append("status artifact field 'as_of' must be an ISO date string")
    else:
        try:
            date.fromisoformat(as_of)
        except ValueError:
            errors.append("status artifact field 'as_of' is not a valid ISO date")

    source_manifest = status.get("source_manifest")
    if source_manifest != "tool_manifest_clickup.json":
        errors.append("status artifact field 'source_manifest' must equal 'tool_manifest_clickup.json'")

    policy = status.get("policy")
    if not isinstance(policy, dict):
        errors.append("status artifact field 'policy' must be an object")
    else:
        missing_policy_fields = REQUIRED_POLICY_FIELDS - set(policy)
        if missing_policy_fields:
            errors.append(
                "status artifact policy is missing fields: "
                + ", ".join(sorted(missing_policy_fields))
            )
        for field_name in REQUIRED_POLICY_FIELDS & set(policy):
            if not isinstance(policy[field_name], bool):
                errors.append(f"status artifact policy field '{field_name}' must be boolean")

    tools = status.get("tools")
    if not isinstance(tools, dict):
        errors.append("status artifact field 'tools' must be an object keyed by tool name")
        return StatusValidationResult(errors, manifest_tool_names, Counter())

    status_tool_names = list(tools.keys())
    manifest_set = set(manifest_tool_names)
    status_set = set(status_tool_names)

    missing_in_status = sorted(manifest_set - status_set)
    extra_in_status = sorted(status_set - manifest_set)
    if missing_in_status:
        errors.append(
            "status artifact is missing manifest tools: " + ", ".join(missing_in_status)
        )
    if extra_in_status:
        errors.append(
            "status artifact contains non-manifest tools: " + ", ".join(extra_in_status)
        )

    state_counts: Counter[str] = Counter()
    for tool_name in manifest_tool_names:
        record = tools.get(tool_name)
        if not isinstance(record, dict):
            errors.append(f"tool '{tool_name}' does not have an object status record")
            continue

        missing_tool_fields = REQUIRED_TOOL_FIELDS - set(record)
        if missing_tool_fields:
            errors.append(
                f"tool '{tool_name}' is missing fields: "
                + ", ".join(sorted(missing_tool_fields))
            )
            continue

        state = record.get("current_validation_state")
        if state not in ALLOWED_CURRENT_VALIDATION_STATES:
            errors.append(
                f"tool '{tool_name}' has invalid current_validation_state: {state!r}"
            )
        else:
            state_counts[state] += 1

        end_state_compliant = record.get("end_state_compliant")
        if not isinstance(end_state_compliant, bool):
            errors.append(f"tool '{tool_name}' field 'end_state_compliant' must be boolean")

        primary_next_action = record.get("primary_next_action")
        if not isinstance(primary_next_action, str) or not primary_next_action.strip():
            errors.append(
                f"tool '{tool_name}' field 'primary_next_action' must be a non-empty string"
            )

        evidence = record.get("evidence")
        if not isinstance(evidence, list):
            errors.append(f"tool '{tool_name}' field 'evidence' must be a list")
            continue

        if state == "validated":
            if end_state_compliant is not True:
                errors.append(
                    f"tool '{tool_name}' is validated but not marked end_state_compliant"
                )
            if primary_next_action != "none":
                errors.append(
                    f"tool '{tool_name}' is validated but primary_next_action is not 'none'"
                )
        else:
            if end_state_compliant is True:
                errors.append(
                    f"tool '{tool_name}' is non-validated but marked end_state_compliant"
                )
            if not evidence:
                errors.append(
                    f"tool '{tool_name}' is non-validated but has no evidence entries"
                )

        for index, evidence_entry in enumerate(evidence):
            if not isinstance(evidence_entry, dict):
                errors.append(
                    f"tool '{tool_name}' evidence entry {index} must be an object"
                )
                continue
            for required_field in ("source", "kind", "summary"):
                value = evidence_entry.get(required_field)
                if not isinstance(value, str) or not value.strip():
                    errors.append(
                        f"tool '{tool_name}' evidence entry {index} is missing "
                        f"'{required_field}'"
                    )

            source = evidence_entry.get("source")
            if isinstance(source, str) and source.startswith("docs/"):
                source_path = root / Path(source)
                if not source_path.exists():
                    errors.append(
                        f"tool '{tool_name}' evidence entry {index} points to missing source "
                        f"{_repo_relative(source_path, root)}"
                    )

    return StatusValidationResult(errors=errors, manifest_tool_names=manifest_tool_names, state_counts=state_counts)


def format_status_summary(result: StatusValidationResult) -> str:
    ordered_states = sorted(result.state_counts)
    summary = ", ".join(
        f"{state}={result.state_counts[state]}" for state in ordered_states
    )
    return f"tools={len(result.manifest_tool_names)}; {summary}"
