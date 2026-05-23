# Non-Live Validation Probe

Date of probe: 2026-05-16

This document records static and public-doc validation findings gathered before connecting the server to a live ClickUp workspace.

## Scope

Validated here:

- internal write-scope inference logic
- generic HTTP wrapper behavior
- manifest and runtime contract consistency
- public ClickUp docs / OpenAPI references
- reference scraping behavior against the current public site

Not validated here:

- live ClickUp auth behavior
- real workspace permissions
- real data payload correctness
- end-to-end tool execution

## Executive Read

The repository is coherent, but several important non-live risks are already visible:

1. selective write protection relies on inferred container context that is brittle and partially heuristic
2. the public tool manifest overstates behavior in multiple places because some declared parameters are ignored
3. the reference scraping tools are already stale against the current public ClickUp docs site
4. some hardcoded API paths do not appear in ClickUp’s currently published OpenAPI specs
5. the generic HTTP wrapper is intentionally thin and provides no schema-aware safety beyond retries and status handling

## Key Findings

### 1. Selective write enforcement mixes explicit IDs with inferred IDs

Relevant code:

- [server.py](../server.py#L724)
- [server.py](../server.py#L659)
- [server.py](../server.py#L679)
- [server.py](../server.py#L698)

Behavior:

- `_ensure_write_allowed(...)` first extracts explicit `spaceId` / `listId` style values from tool args.
- If none are present, it attempts to infer scope from up to 5 task IDs.
- If that still fails, it attempts to infer scope from up to 5 doc IDs.
- It then checks inferred or explicit spaces/lists against configured allowlists.

Why this is risky:

- task-derived scope depends on the exact shape of `GET /task/{id}` responses
- list-to-space resolution depends on follow-up `GET /list/{id}` responses
- doc-derived scope depends on doc metadata shape from v3 endpoints
- if any of those payload assumptions drift, write protection can fail closed or fail ambiguously

Static conclusion:

- the logic is directionally sensible
- the safety model is only as reliable as several unverified response-shape assumptions
- it should not yet be treated as a proven guardrail

### 2. Workspace IDs are treated as write-scope identifiers alongside space IDs

Relevant code:

- [server.py](../server.py#L731)
- [server.py](../server.py#L754)

Observation:

- `_ensure_write_allowed(...)` collects `workspaceId`, `teamId`, and `spaceId` into the same `space_ids` set.
- those values are then checked against `allowed_spaces`.

Why this matters:

- the code currently collapses team/workspace and space identifiers into one permission bucket
- that may be intended, but it is semantically blurry and increases the chance of false denies or misleading error messages

Static conclusion:

- this area needs explicit policy clarification before claiming the write model is trustworthy

### 3. The HTTP wrapper is intentionally thin and non-validating

Relevant code:

- [server.py](../server.py#L318)

Current wrapper guarantees:

- auth token presence
- v2 vs v3 base URL selection
- removal of `None` query params
- retry on `429`, `500`, `502`, `503`, `504`
- JSON parse when response content type includes `application/json`

What it does not do:

- request schema validation
- response schema validation
- endpoint-aware parameter translation
- endpoint-aware pagination handling
- structured error normalization beyond `RuntimeError("ClickUp {status}: {text}")`

Static conclusion:

- the wrapper is fine as a transport shim
- it is not a safety boundary and should not be treated as one

### 4. The reference link scraper is currently broken against ClickUp’s public docs site

Relevant code:

- [server.py](../server.py#L1269)
- [server.py](../server.py#L1289)

Observed public-doc behavior on 2026-05-16:

- `https://clickup.com/api` redirects to `https://developer.clickup.com`
- the landing page contains relative links like `/reference` and `/docs/...`
- the current implementation only keeps links starting with `https://clickup.com/api`

Result:

- the current `reference_link_list` logic produced `0` matched links during this probe

Implication:

- this feature cannot be considered operational even before live workspace testing

### 5. `reference_page_fetch` is now too narrowly allowlisted

Relevant code:

- [server.py](../server.py#L1289)

Behavior:

- it rejects any URL not starting with `https://clickup.com/api`

Problem:

- current public ClickUp docs are served from `https://developer.clickup.com`

Static conclusion:

- the runtime allowlist has not kept up with the public docs domain move

### 6. Manifest parameters and runtime behavior drift in several tools

This repo’s manifest is structurally valid:

- 79 tools
- no duplicate tool names
- no missing required-property declarations

But several tools declare parameters that runtime logic does not actually use.

Examples:

- `doc_list` declares `includePreviews` and `previewPageLimit`, but runtime ignores them
- `doc_read` declares `pageLimit`, but runtime ignores it
- `doc_search` declares `expandPages`, but runtime ignores it
- `task_time_entry_list` declares `pageSize`, but runtime ignores it
- `time_entry_list` declares `taskId` and `pageSize`, but runtime ignores them
- `time_report_for_context` declares a rich filter/report surface, but runtime falls through to a generic time-entry totalizer

Relevant code:

- [server.py](../server.py#L1418)
- [server.py](../server.py#L1422)
- [server.py](../server.py#L1461)
- [server.py](../server.py#L1493)
- [server.py](../server.py#L1498)
- [server.py](../server.py#L1502)

Static conclusion:

- the manifest is not yet a reliable behavioral contract
- some tools are broader on paper than in implementation

### 7. Some hardcoded endpoints do not appear in ClickUp’s published OpenAPI specs

Public spec sources discovered during this probe:

- v2 JSON spec: `https://developer.clickup.com/openapi/clickup-api-v2-reference.json`
- v3 spec: `https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml`

Static endpoint comparison found hardcoded paths with no direct match in those published specs.

Examples:

- `/v2/team/{id}/member`
- `/v2/task/{id}/duplicate`
- `/v2/task/bulk`
- `/v2/task/tag/bulk`
- `/v2/folder/{id}/list/template/{id}`
- `/v2/space/{id}/list/template/{id}`

Docs-related v3 mismatch:

- server uses `docs/{docId}/page_listing` and `docs/{docId}/pages/...`
- published v3 spec currently documents workspace-scoped forms:
  - `/api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing`
  - `/api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`
  - `/api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`

Important caution:

- absence from the published spec does not prove an endpoint is invalid
- it does prove the repo currently relies on assumptions not supported by the public spec alone

## Public Reference Checks

The following public sources were reachable on 2026-05-16:

- ClickUp developer home: `https://developer.clickup.com`
- Supported MCP tools: `https://developer.clickup.com/docs/mcp-tools`
- OpenAPI spec guide: `https://developer.clickup.com/docs/open-api-spec`
- v2 OpenAPI JSON: `https://developer.clickup.com/openapi/clickup-api-v2-reference.json`
- v3 OpenAPI spec: `https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml`

Useful public observations:

- ClickUp now publicly documents its own MCP server and supported tools.
- The public docs include direct spec download links for v2 and v3.
- The docs site domain and URL shapes have moved away from the assumptions in the repo’s reference scraper.

## Practical Confidence Levels

### Reasonably strong

- repository shape and startup flow
- manifest structural validity
- static tool registration model
- presence of a real write-safety concept

### Medium confidence

- path resolution logic
- report-generation intent
- Docker/local runtime story

### Low confidence

- selective write inference correctness
- manifest-to-runtime behavioral accuracy
- docs tool path correctness
- bulk/template endpoint correctness
- reference scraping tools

## Suggested Next Validation Pass

Before touching a live workspace, the highest-value next checks are:

1. build a formal manifest-vs-runtime drift report
2. compare every hardcoded ClickUp path against the published v2/v3 specs
3. isolate docs endpoints and determine whether workspace-scoped v3 paths are required everywhere
4. specify the intended write-permission model for workspace IDs vs space IDs vs list IDs
5. decide whether the reference tools should target `developer.clickup.com` pages or the downloadable OpenAPI specs directly

## Bottom Line

The repository is not blocked on basic discovery anymore.

It is blocked on contract trust:

- trust that tool schemas describe real behavior
- trust that write protection resolves the right scope
- trust that public-reference helpers still point at the real docs
- trust that hardcoded paths match current public ClickUp interfaces

Those are all now concrete, testable questions.
