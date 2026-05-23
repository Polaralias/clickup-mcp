# Refactor and Repair Plan

Date: 2026-05-16

Update note: this document is the 2026-05-16 baseline repair assessment. For the current authoritative tool-by-tool status model and current harness outcome, use [docs/status/tool-validation-status.json](status/tool-validation-status.json), [docs/exec-plans/completed/2026-05-23-harness-engineering-plan.md](exec-plans/completed/2026-05-23-harness-engineering-plan.md), and the accepted decisions under [docs/decisions](decisions).

This document consolidates the current repository map, static validation, and live verification into a development plan for turning the repository into a trustworthy public project.

It is intentionally evidence-driven and references the supporting investigation documents created during this review.

## Evidence Index

Primary supporting documents:

- [docs/codebase-map.md](codebase-map.md)
- [docs/non-live-validation-probe.md](non-live-validation-probe.md)
- [docs/manifest-runtime-drift.md](manifest-runtime-drift.md)
- [docs/public-spec-comparison.md](public-spec-comparison.md)
- [docs/unmatched-endpoint-classification.md](unmatched-endpoint-classification.md)
- [docs/live-verification-initial.md](live-verification-initial.md)
- [docs/live-runtime-tool-tests.md](live-runtime-tool-tests.md)
- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)

Core source files:

- [server.py](../server.py)
- [scripts/run_server.py](../scripts/run_server.py)
- [tool_manifest_clickup.json](../tool_manifest_clickup.json)
- [docs/tool-reference.md](tool-reference.md)
- [docs/configuration.md](configuration.md)
- [README.md](../README.md)

## Repository State

The repository is small and centralized.

- almost all runtime behavior is concentrated in [server.py](../server.py)
- the public contract is declared in [tool_manifest_clickup.json](../tool_manifest_clickup.json)
- local operator workflow is handled by [scripts/run_server.py](../scripts/run_server.py)
- packaging and deployment are present and usable

This is good for repair work because the behavior surface is inspectable. It is risky because defects in `server.py` have wide impact.

## 1. Validated and Verified Functionality

### Repository and runtime basics

Validated:

- repository structure is coherent
- Python entrypoints compile
- local runtime helper works for diagnostics
- manifest is structurally valid
- all 79 manifest tool names are statically covered by runtime dispatch

Evidence:

- [docs/codebase-map.md](codebase-map.md)
- [docs/non-live-validation-probe.md](non-live-validation-probe.md)

### Live-valid raw API surfaces

Live-verified valid:

- `GET /v2/team`
- `GET /v2/team/{workspace_id}`
- `GET /v2/team/{workspace_id}/space`
- `GET /api/v3/workspaces/{workspace_id}/docs`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`
- `POST /v2/space/{space_id}/tag` with nested `tag` object body
- `POST /v2/space/{space_id}/list`
- `POST /v2/list/{list_id}/task`
- `PUT /v2/task/{task_id}`
- `DELETE /v2/task/{task_id}`
- `POST /v2/task/{task_id}/tag/{tag_name}`
- `DELETE /v2/space/{space_id}/tag/{tag_name}`
- `DELETE /v2/list/{list_id}`

Evidence:

- [docs/live-verification-initial.md](live-verification-initial.md)
- [docs/live-runtime-tool-tests.md](live-runtime-tool-tests.md)
- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)

### Live-valid runtime tools

Verified through `server.runtime.dispatch(...)`:

- `list_create_for_container`
- `task_create`
- `task_tag_add`
- `task_delete`
- `list_delete`

Evidence:

- [docs/live-runtime-tool-tests.md](live-runtime-tool-tests.md)

### Live-valid functional replacements

Verified as correct behavior even where current tool implementation is wrong:

- member listing from `GET /v2/team/{workspace_id}` -> `team.members`
- doc page listing from workspace-scoped v3 docs routes
- doc page reads from workspace-scoped v3 docs routes
- doc pages multi-read via `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages` plus client-side filtering
- task duplication via read-then-create composition
- bulk create via iterative single-task creates
- bulk update via iterative single-task updates
- bulk delete via iterative single-task deletes
- bulk tag add via iterative single-task tag adds

Evidence:

- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)

## 2. Validated Issues and Problems

### Live-confirmed broken runtime tools

Broken:

- `member_list_for_workspace`
- `doc_page_list`
- `doc_page_read`
- `doc_pages_read`
- `task_duplicate`
- `task_create_bulk`
- `task_tag_add_bulk`
- `space_tag_create`

Live-failing and currently untrustworthy:

- `task_update_bulk`
- `task_delete_bulk`

Evidence:

- [docs/live-runtime-tool-tests.md](live-runtime-tool-tests.md)

### Live-confirmed route-shape defects

Confirmed wrong:

- `GET /v2/team/{workspace_id}/member`
- shorthand docs routes under `/api/v3/docs/{doc_id}/...`
- `list/template/...` path shape instead of `list_template/...`

Evidence:

- [docs/live-verification-initial.md](live-verification-initial.md)
- [docs/unmatched-endpoint-classification.md](unmatched-endpoint-classification.md)

### Live-confirmed payload defect

Confirmed wrong:

- `space_tag_create` sends the wrong request body shape
- live-valid body requires nested `tag` object, not flat fields

Evidence:

- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)

### Manifest/runtime drift

Confirmed drift:

- `doc_read` default and parameter drift
- `doc_list` preview-related parameter drift
- `doc_search` and `doc_search_bulk` `expandPages` drift
- `task_time_entry_list` `pageSize` drift
- `time_entry_list` `taskId` and `pageSize` drift
- `time_report_for_context` semantic drift
- `time_report_for_container` semantic drift
- `time_report_for_tag` semantic drift
- `time_report_for_space_tag` semantic drift
- `task_list_for_list` default and parameter drift
- `task_read` `detailLimit` drift

Likely drift candidates:

- `workspace_hierarchy`
- `list_view_create`
- `space_view_create`
- `view_update`

Evidence:

- [docs/manifest-runtime-drift.md](manifest-runtime-drift.md)

### Write-safety model risks

Validated concerns:

- selective write mode depends on inferred space/list context from tasks and docs
- workspace IDs and space IDs are treated in a shared permission bucket
- correctness depends on response-shape assumptions that were not originally proven

This logic is not yet proven wrong in the same way as the route defects, but it remains a high-risk area for future work.

Evidence:

- [docs/non-live-validation-probe.md](non-live-validation-probe.md)

### Reference tooling is invalidated

Broken or stale:

- `reference_link_list`
- `reference_page_fetch`

Why:

- they target `https://clickup.com/api`
- current public docs live on `https://developer.clickup.com`
- the runtime link filter is now stale

Evidence:

- [docs/non-live-validation-probe.md](non-live-validation-probe.md)

## 3. Current Specs and Docs

### Available repository docs

Present in repo:

- [README.md](../README.md)
- [docs/configuration.md](configuration.md)
- [docs/tool-reference.md](tool-reference.md)

Value:

- good for understanding intended surface
- not reliable as a truth source without validation

Invalidated or weakened claims:

- the tool reference currently reflects manifest intent, not guaranteed runtime truth
- some documented tool defaults do not match runtime behavior
- docs tooling descriptions assume paths that are live-invalid

### Available public specs and docs

Reliable direct schema remotes:

- [clickup-api-v2-reference.json](https://developer.clickup.com/openapi/clickup-api-v2-reference.json)
- [ClickUp_PUBLIC_API_V3.yaml](https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml)

Supporting public docs:

- [developer.clickup.com](https://developer.clickup.com)
- [OpenAPI spec guide](https://developer.clickup.com/docs/open-api-spec)

Quality assessment:

- the downloadable v2/v3 schemas are the best non-live reference surface
- landing-page traversal and HTML scraping are lower-trust than the direct schemas

### Where current docs/spec assumptions are wrong

Invalidated repository assumptions:

- member listing route assumption
- docs page shorthand route assumption
- list template path assumption
- flat `space_tag_create` payload assumption
- existence or usability of several bulk task endpoints as currently implemented

Evidence:

- [docs/public-spec-comparison.md](public-spec-comparison.md)
- [docs/live-verification-initial.md](live-verification-initial.md)
- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)

## 4. Current Available Tests

### Repository tests

Current state:

- no automated test suite is present in the repository
- no `tests/` directory was found during review
- no integration harness is checked in

Implication:

- all current verification has been manual or scripted ad hoc probing

### Existing validation artifacts

What exists now instead of formal tests:

- structural static analysis documents
- public-schema comparison
- live raw-API probes
- live runtime dispatch probes
- live functional replacement probes

These are useful as evidence, but they are not regression tests.

### Recommended future test layers

Needed:

- unit tests for helper logic in `server.py`
- integration tests for runtime dispatch against mocked ClickUp responses
- selective live smoke tests for known-valid workspace operations
- contract tests to ensure manifest defaults and runtime behavior stay aligned

## 5. Context and Harness Quality for Future Development

### Current context quality

Strengths:

- codebase is small
- behavior is concentrated in one file
- current failure areas are well identified
- live workspace access has already validated the replacement behavior for several broken tools

Weaknesses:

- `server.py` is a monolith
- no automated tests
- manifest and runtime are out of sync
- docs are partially invalidated
- some public-reference helpers are stale

### Current harness quality

What is good:

- there is now a repeatable manual live-verification pattern
- disposable lists, tasks, docs pages, and tags can be exercised safely in the test workspace
- the runtime can be invoked directly via `server.runtime.dispatch(...)`

What is missing:

- reusable scripts checked into the repo for live smoke tests
- fixture management for temporary ClickUp artifacts
- deterministic cleanup wrappers
- a documented env-based test workflow
- an explicit split between current-truth verification and target-contract verification
- a stable capability-level verification model
- a single authoritative machine-readable status source

### Development readiness

The repository is ready for repair work because:

- broken areas are now concrete
- replacement behaviors are validated
- the workspace is safe for destructive testing

At the time of this 2026-05-16 baseline, it was not yet ready for confident ongoing development because:

- there is no persistent test harness
- there is no regression protection
- contract drift is still present

As of 2026-05-22, the documentation and status-model foundation for the harness has been completed. The remaining work is implementation: runtime repair, test automation, and ongoing revalidation against the canonical status artifact.

## Repair Plan

### Phase 1: Repair confirmed-broken runtime behavior

Priority:

1. fix member listing to use `GET /v2/team/{workspace_id}`
2. fix docs page tools to use workspace-scoped v3 routes and correct response-shape handling
3. fix `space_tag_create` payload shape
4. fix `list_create_from_template` path shape
5. replace broken direct implementations of:
   - `task_duplicate`
   - `task_create_bulk`
   - `task_update_bulk`
   - `task_delete_bulk`
   - `task_tag_add_bulk`
   with composition over working single-item operations

### Phase 2: Repair manifest/runtime contract drift

Priority:

1. decide whether manifest or runtime is authoritative per tool
2. align defaults and parameter semantics for docs and time tools
3. remove or implement currently ignored parameters
4. regenerate tool docs from corrected behavior

### Phase 3: Build a minimal test harness

Priority:

1. create a checked-in integration test scaffold
2. formalize a `truth` layer for current validated runtime behavior
3. formalize a `contract` layer for intended repaired behavior
4. define functional capabilities as the primary harness unit
5. make the harness authoritative for machine-readable status
6. add live smoke tests for the corrected tool set
7. add manifest/runtime consistency checks
8. document disposable workspace test conventions

### Phase 4: Re-document the project as a public artifact

Priority:

1. update README with validated scope
2. revise configuration and tool docs
3. explicitly separate:
   - validated functionality
   - unverified functionality
   - unsupported functionality

## Bottom Line

The repository is no longer in an unknown state.

It now has:

- a mapped architecture
- a list of validated working behavior
- a list of validated broken behavior
- a live-confirmed set of correct replacement API shapes
- a clear repair order

That is enough to begin a disciplined repair phase without guessing and without broad refactoring.
