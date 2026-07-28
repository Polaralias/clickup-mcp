---
type: "Validation Evidence"
title: "Live Verification: Initial Pass"
description: "Documents Live Verification: Initial Pass for the clickup-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: evidence
verification: verified-limited
owner: polaralias
tags:
  - clickup-mcp
  - validation-evidence
navigation:
  role: reference
  order: 200
---
# Live Verification: Initial Pass

Date of probe: 2026-05-16

This document records the first live verification pass against a real ClickUp workspace.

Token source and workspace ID were supplied directly by the repository owner for verification purposes and are intentionally not repeated here.

## Scope

This pass focussed on:

- validating core read access
- validating the highest-risk unmatched endpoints
- confirming whether runtime docs-page routes match live behaviour

This pass did not perform intentional mutations.

## Live Baseline

Confirmed working read access:

- `GET /v2/team`
- `GET /v2/team/{workspace_id}/space`
- `GET /api/v3/workspaces/{workspace_id}/docs`

Observed live results:

- accessible workspaces returned: `1`
- spaces returned for the supplied workspace: `5`
- docs returned for the supplied workspace: `3`

## High-Confidence Live Findings

### 1. `GET /v2/team/{workspace_id}/member` does not work live

Runtime path:

- [server.py](../server.py#L1186)

Live result:

- status: `404`
- body: `404 page not found`

Conclusion:

- the current member-list implementation is not valid for this live workspace
- this is now a live-verified issue, not just a public-schema mismatch

### 2. Runtime docs-page shorthand routes are wrong live

Runtime paths:

- [server.py](../server.py#L1427)
- [server.py](../server.py#L1431)
- [server.py](../server.py#L1446)
- [server.py](../server.py#L1451)
- [server.py](../server.py#L1457)
- [server.py](../server.py#L1460)

Live comparison using a real doc ID from the workspace:

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}` -> `200`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing` -> `200`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages` -> `200`
- `GET /api/v3/docs/{doc_id}/page_listing` -> `404`
- `GET /api/v3/docs/{doc_id}/pages` -> `404`

Conclusion:

- the workspace-scoped v3 docs routes are the live-valid form
- the shorthand `/api/v3/docs/...` routes used by the runtime are live-invalid on this workspace

This is now the clearest confirmed implementation defect in the repo.

### 3. `list/template/...` routes appear live-invalid, while `list_template/...` routes are live-recognised

Runtime paths:

- [server.py](../server.py#L1250)
- [server.py](../server.py#L1251)

Probe behaviour using fake IDs to avoid mutation:

- `POST /v2/folder/{fake}/list/template/{fake}` -> `404 page not found`
- `POST /v2/space/{fake}/list/template/{fake}` -> `404 page not found`
- `POST /v2/folder/{fake}/list_template/{fake}` -> `404` with structured JSON `Template not found`
- `POST /v2/space/{fake}/list_template/{fake}` -> `404` with structured JSON `Template not found`

Conclusion:

- the runtime path shape is very likely wrong
- the public-schema path shape is also the live-recognised one

### 4. Bulk-task endpoints remain unresolved, but some runtime assumptions are now more suspicious

Runtime paths:

- [server.py](../server.py#L1340)
- [server.py](../server.py#L1346)
- [server.py](../server.py#L1349)
- [server.py](../server.py#L1352)

Non-destructive probes:

- `POST /v2/task/bulk?team_id=...` with empty tasks -> `405 method not allowed`
- `PUT /v2/task/bulk?team_id=...` with empty tasks -> `400` with JSON `Task ID invalid`
- `DELETE /v2/task/bulk?team_id=...` with empty task IDs -> `401 Team not authorized`
- `POST /v2/task/tag/bulk?team_id=...` with empty operations -> `404 page not found`

Conclusion:

- these routes are still not confidently classified from a safe probe alone
- `POST /v2/task/tag/bulk` is especially suspicious because it returns plain `404`
- `POST /v2/task/bulk` also looks weak because the live response is `405 method not allowed`

These need a more careful validation strategy before being trusted.

### 5. `POST /v2/task/{id}/duplicate` remains suspicious

Runtime path:

- [server.py](../server.py#L1321)

Safe fake-ID probe:

- result: `404 page not found`

Conclusion:

- still unresolved, but not strengthened by live testing
- remains a distrust candidate

## Additional Route-Semantics Checks

For comparison, clearly valid endpoint shapes with fake IDs did not generally produce plain route-style `404`s.

Examples:

- `GET /v2/list/{fake}` -> `400` with structured `List ID invalid`
- `GET /v2/task/{fake}` -> `401 Team not authorized`

Interpretation:

- when a route is live-recognised, ClickUp often returns a structured auth/validation error
- several repo endpoints instead returned raw `404 page not found`, which is stronger evidence of bad path shape

## Confidence Changes

### Now live-confirmed invalid

- `GET /v2/team/{workspace_id}/member`
- shorthand docs-page routes under `/api/v3/docs/{doc_id}/...`
- runtime `list/template/...` path shape

### Still unresolved

- task duplicate
- task bulk operations
- task tag bulk

### Live-confirmed valid

- `GET /v2/team`
- `GET /v2/team/{workspace_id}/space`
- `GET /api/v3/workspaces/{workspace_id}/docs`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`

## Practical Conclusion

The repo has now moved from static suspicion to live-confirmed defects in at least three important places:

1. member listing route
2. docs page routes
3. list-template route shape

That is enough evidence to justify a repair phase without needing to wait for every remaining endpoint to be live-classified.

## Repository knowledge

- [Documentation map](knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
