# Live Smoke Harness

This document defines the checked-in live smoke layer for the repository.

It is a truth-layer harness surface.

It proves currently validated live behaviour, validated replacement paths, and checked-in repaired-runtime smoke slices when the required environment is present.
It does not yet prove the full repaired end-state contract tool-by-tool.

## Purpose

The live smoke layer exists to give development work a repeatable live verification surface for:

- runtime tools already known to work
- replacement routes and payloads already proven live outside the runtime
- disposable write operations with deterministic cleanup

## Entrypoint

Run the live smoke suite with:

```bash
python scripts/run_live_smoke.py
```

The runner disables third-party pytest plugin autoload so workstation-specific Python installs do not change harness behaviour.

## Required Environment

Required upstream auth:

- `CLICKUP_API_TOKEN`
- `CLICKUP_TEAM_ID`

Required live smoke targeting:

- `CLICKUP_LIVE_SMOKE_SPACE_ID`
- `CLICKUP_LIVE_SMOKE_DOC_ID`

Operational requirement:

- write mode must allow mutations in the target space

The checked-in tests intentionally skip when this environment is not present.

## Current Coverage

### Runtime-validated write path

The current live smoke suite exercises:

- `ping`
- `health`
- `tool_catalogue`
- `workspace_capability_snapshot`
- `workspace_list`
- `space_list_for_workspace`
- `folder_list_for_space`
- `list_list_for_space_or_folder`
- `workspace_overview`
- `hierarchy_resolve_path`
- `space_tag_list`
- `space_tag_update`
- `space_tag_delete`
- `folder_create_in_space`
- `folder_update`
- `folder_delete`
- `list_create_for_container`
- `list_update`
- `task_create`
- `task_update`
- `task_comment_add`
- `task_comment_list`
- `task_tag_add`
- `task_tag_remove`
- `task_search`
- `task_search_fuzzy`
- `task_search_fuzzy_bulk`
- `task_status_report`
- `task_risk_report`
- `task_timer_start`
- `task_timer_stop`
- `time_entry_create_for_task`
- `time_entry_update`
- `time_entry_delete`
- `time_entry_current`
- `subtask_create`
- `subtask_create_bulk`
- `task_attachment_add`
- `list_custom_field_list`
- `task_custom_field_set_value`
- `task_custom_field_clear_value`
- `doc_create`
- `doc_page_create`
- `doc_page_update`
- `task_delete`
- `list_delete`

This path verifies core read-only runtime surfaces, creates disposable list and task artefacts where needed for hierarchy proof, applies a disposable tag, and cleans up the created artefacts.

### Validated replacement path

The current live smoke suite also verifies the already validated replacement behaviour for:

- member listing from `GET /v2/team/{workspace_id}` via `team.members`
- doc page listing from workspace-scoped v3 docs routes
- doc page reads from workspace-scoped v3 docs routes
- nested-body `space_tag_create` payload using `POST /v2/space/{space_id}/tag`

### Repaired runtime path

The current live smoke suite also contains a bounded repaired-runtime slice for:

- `member_list_for_workspace`
- `member_resolve`
- `member_search_by_name`
- `task_assignee_resolve`
- `list_create_from_template`
- `doc_page_list`
- `doc_page_read`
- `doc_pages_read`
- `space_tag_create`
- `task_duplicate`
- `task_create_bulk`
- `task_update_bulk`
- `task_delete_bulk`
- `task_tag_add_bulk`
- `task_read`
- `task_list_for_list`
- `workspace_hierarchy`
- `list_view_create`
- `space_view_create`
- `view_update`
- `view_delete`
- `task_time_entry_list`
- `time_entry_list`
- `time_report_for_container`
- `time_report_for_context`
- `time_report_for_tag`
- `time_report_for_space_tag`

This slice creates disposable lists, tasks, views, tags, and time entries, exercises the repaired composition-based runtime tools, verifies side effects through raw API reads, and cleans up the created artefacts in the same run.

## Safety Rules

- use only a dedicated disposable test space
- use generated names for every created artefact
- clean up created list, task, and space tag artefacts in the same run
- keep the suite bounded and fast
- do not widen coverage to speculative tools before the current repair tranche lands

## Current Boundary

This live smoke layer is intentionally not:

- a contract-layer suite
- a full capability inventory
- an automated source for `docs/status/tool-validation-status.json`

Those are possible future improvements, not active publish blockers.
