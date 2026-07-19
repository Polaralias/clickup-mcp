# Codebase Map

## Framing

This document is an archaeology artefact, not a source of truth.

- Repository documents are treated as unverified claims.
- Runtime code is treated as intent, not proof of correct behaviour.
- No live ClickUp validation was performed during this pass.

## Probable End Goal

This repository appears to be aiming at one clear product:

> A standalone, self-hosted MCP server that exposes a broad ClickUp tool surface over HTTP, with static bearer auth, Docker deployment, and basic write-safety controls.

Put differently, this project wants to let MCP clients talk to ClickUp without custom ClickUp logic in each client.

## High-Level Shape

The codebase is small and heavily centralised.

- [server.py](../server.py) is the product.
- [tool_manifest_clickup.json](../tool_manifest_clickup.json) is the public contract for tool names and schemas.
- [scripts/run_server.py](../scripts/run_server.py) is the local operator wrapper.
- [fastmcp.json](../fastmcp.json), [Dockerfile](../Dockerfile), and [docker-compose.yml](../docker-compose.yml) define packaging and deployment.
- [docs/tool-reference.md](tool-reference.md) and [docs/configuration.md](configuration.md) describe intended public behaviour.

There are no test files in the repository at the time of this pass.

## Runtime Architecture

### 1. Configuration and startup

Startup is env-driven.

- `server.py` loads env vars for ClickUp auth, MCP auth, write mode, cache TTLs, and response limits.
- `scripts/run_server.py` optionally loads `.env`, normalises host/port/path, and either:
  - runs `server.py` directly for the simple path, or
  - runs FastMCP CLI via `fastmcp.json` when reload or extra CLI args are needed.

### 2. Core transport

The service is built on FastMCP.

- `FastMCP("clickup-mcp", auth=auth)` creates the server.
- Default transport is `streamable-http`.
- Default endpoint is `/mcp`.
- Health routes are exposed at `/`, `/health`, and `/healthz`.

### 3. ClickUp access layer

`ClickUpClient` is a thin HTTP wrapper over ClickUp APIs.

- Uses `requests.Session`.
- Supports both v2 and v3 base URLs.
- Adds retries for `429`, `500`, `502`, `503`, `504`.
- Raises raw runtime errors on non-OK responses.

This is a direct API adapter, not a rich domain client.

### 4. Runtime / orchestration layer

`ClickUpRuntime` is where the actual application logic lives.

Responsibilities:

- cache workspace/space/folder/list lookups
- resolve name paths into IDs
- enforce write restrictions
- normalise task and doc previews
- generate summary/report outputs
- dispatch manifest tool names to ClickUp API calls

This class is effectively the entire service layer.

### 5. Tool registration

Tools are not hand-registered one by one.

- `tool_manifest_clickup.json` is loaded at import time
- `_register_tools(...)` iterates through the manifest
- each tool is registered as a `FunctionTool`
- all tool calls funnel into `ClickUpRuntime.dispatch(...)`

This means the manifest is the public API catalogue, while `dispatch` is the behavioural switchboard.

## Execution Flow

For a typical MCP request, the likely flow is:

1. Client calls an MCP tool over HTTP.
2. FastMCP routes that tool to the generated handler.
3. The handler calls `ClickUpRuntime.dispatch(name, kwargs)`.
4. `dispatch` may:
   - apply path-to-ID defaults
   - require destructive confirmation
   - enforce selective write rules
   - call ClickUp v2 or v3
   - reshape the response slightly
5. FastMCP returns the result.

For local operator usage, the flow starts in [scripts/run_server.py](../scripts/run_server.py), not in `server.py`.

## Domain Map

The tool manifest currently exposes 79 tools. By category:

- `system`: 3
- `hierarchy`: 14
- `member`: 4
- `tag`: 4
- `view`: 4
- `task`: 20
- `custom-field`: 3
- `reporting`: 2
- `doc`: 10
- `time`: 12
- `reference`: 2
- `uncategorized`: 1

### System / server surface

Purpose:

- prove liveness
- expose runtime constraints
- list the tool contract itself

Core tools:

- `ping`
- `health`
- `tool_catalogue`

### Workspace and hierarchy surface

Purpose:

- discover ClickUp containers
- convert human names into IDs
- support later task/doc operations

Core capabilities:

- list workspaces, spaces, folders, lists
- build hierarchy snapshots
- resolve paths like workspace -> space -> folder/list

This is foundational plumbing for the rest of the toolset.

### Member surface

Purpose:

- resolve assignees and workspace members

Core capabilities:

- list members
- search members by name
- resolve identifiers to member records

### Task surface

Purpose:

- provide CRUD plus operational helpers for tasks/subtasks

Core capabilities:

- create, update, delete, duplicate
- comment and attachment helpers
- add/remove tags
- bulk create/update/delete/tag operations
- read and list tasks
- fuzzy and structured search

This is the largest single domain and likely the primary value of the project.

### Reporting surface

Purpose:

- produce compact MCP-friendly summaries instead of only raw API payloads

Current report types:

- task status summary
- overdue / at-risk task summary

This is one of the more productised areas of the codebase because it adds derived value beyond raw passthrough.

### Docs surface

Purpose:

- interact with ClickUp docs through v3 endpoints

Core capabilities:

- create docs
- list docs
- read docs and pages
- create/update pages
- search docs

This indicates the project is trying to cover more than tasks; it wants broad ClickUp workspace utility.

### Time tracking surface

Purpose:

- expose timers, time entries, and rollup reports

Core capabilities:

- start/stop timers
- create/update/delete time entries
- list current or historical entries
- aggregate time by tag or container

### Reference surface

Purpose:

- scrape public ClickUp API reference pages

Core capabilities:

- list ClickUp API doc links
- fetch and strip a reference page to text

This is unusual. It suggests the server also wants to assist an MCP client in understanding ClickUp’s public API docs, not just operate on workspace data.

## Safety Model

There is a real, intentional safety layer, even if it is not yet validated.

### Auth

- HTTP bearer auth is optional but supported.
- Accepted keys can come from `CLICKUP_MCP_API_KEY`, `MCP_API_KEY`, or `MCP_API_KEYS`.
- Auth can be disabled with `API_KEY_MODE=disabled`.

### Write gating

Destructive or mutating tools generally require:

- `confirm="yes"` or equivalent truthy confirm
- or `dryRun=true`

Selective write mode is also implemented:

- `write`: unrestricted writes
- `read`: writes blocked
- `selective`: writes allowed only for approved spaces/lists

The write gate tries to infer affected spaces/lists from tasks and docs when they are not directly supplied.

## What Looks Solid

- The repository has a coherent product shape.
- Manifest, docs, and runtime all point to the same product idea.
- The tool manifest is fully covered by dispatch logic in static analysis.
- Python entrypoints compile.
- Packaging for local and Docker use is present.
- There is at least some intentional design around safety, caching, and output truncation.

## What Is Still Unverified

These areas should not be trusted yet:

- whether every declared tool matches a valid current ClickUp API endpoint
- whether request/response field names match real ClickUp payloads
- whether the v2/v3 boundary is correct for each tool
- whether write-safety inference always maps tasks/docs to the right space/list
- whether report outputs are accurate on real data
- whether doc endpoints are available on all workspaces/plans
- whether the HTML scraping reference tools are stable against ClickUp site changes

## Initial State Assessment

This repository is not a sprawling mystery; it is a concentrated single-file service with broad ambition.

That is good for archaeology because:

- the whole behaviour surface is inspectable quickly
- the architectural intent is readable
- there is a clear candidate for future modularisation

That is risky because:

- almost all logic is in one file
- there are no tests
- there is no proof here that the broad manifest has been validated against real ClickUp behaviour
- documents currently overstate certainty unless backed by live verification

## Working Backwards From The Product Goal

If the end goal is "public, first-class ClickUp MCP server", then the current design is servicing that goal in this order:

1. Expose a broad public tool contract through the manifest.
2. Provide a single runtime that can implement all tools quickly.
3. Make it deployable via local Python or Docker.
4. Add basic auth and write controls so it is safe enough to run.
5. Add summary/report helpers so MCP clients get higher-level outputs.

That sequence makes sense for a rapid build. The missing step is proof:

6. Verify each domain against real ClickUp environments and formalise guarantees.

## Recommended Follow-Up Investigation Containers

Because the repo is small, the next pass should be validation-focussed rather than discovery-focussed.

Suggested investigation buckets:

### 1. Tool contract validation

- manifest schema vs runtime behaviour
- required params vs actual runtime expectations
- output shape consistency

### 2. ClickUp API correctness

- endpoint-by-endpoint validation
- v2 vs v3 ownership
- payload field correctness

### 3. Safety and operational trust

- auth behaviour
- selective write enforcement
- dry-run and confirm semantics
- failure behaviour and error quality

### 4. Deployment trust

- local serve path
- FastMCP CLI path
- Docker image and compose behaviour
- health endpoint readiness

### 5. Documentation trust

- README claims vs real behaviour
- tool reference generation story
- env var truth table

## Practical Summary

The project is best understood as:

- a FastMCP-based HTTP server
- backed by a manifest-driven ClickUp tool catalogue
- implemented almost entirely in one runtime file
- aiming for broad ClickUp coverage, especially tasks, docs, hierarchy, and time
- packaged for self-hosted use
- currently plausible, coherent, and structured, but not yet proven

That is a strong starting point for turning it into a public portfolio piece, provided the next phase is verification and evidence rather than more feature growth.
