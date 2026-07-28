---
type: "Architecture Concept"
title: "Architecture"
description: "Documents Architecture for the clickup-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - clickup-mcp
  - architecture-concept
navigation:
  role: foundational
  order: 20
---
# Architecture

## Current Reality

The repository is a manifest-driven ClickUp MCP server with most runtime behaviour concentrated in [server.py](server.py).

Current major components:

- transport and tool registration via FastMCP
- ClickUp HTTP wrapper via `ClickUpClient`
- orchestration and tool dispatch via `ClickUpRuntime`
- public tool contract via [tool_manifest_clickup.json](tool_manifest_clickup.json)
- local operator helper via [scripts/run_server.py](scripts/run_server.py)

## Current Verified State

- the checked-in harness validates the full manifest surface through [scripts/run_harness.py](scripts/run_harness.py)
- the canonical machine-readable contract status lives in [docs/status/tool-validation-status.json](docs/status/tool-validation-status.json)
- live smoke remains an optional second verification layer for disposable workspace checks

## Architectural Risks

- one-file runtime concentration
- write-safety semantics remain the highest-risk policy surface
- the repo depends on the harness entrypoints rather than a raw workstation `pytest` invocation for stable test execution

## Design Direction

The repository is publish-ready in its current shape, but future changes should preserve these boundaries:

- keep the manifest and runtime aligned in the same slice
- prefer composition over undocumented upstream convenience endpoints
- preserve the status artefact as the canonical trust surface
- keep historical evidence dated and subordinate to current contract docs

Longer-term improvements can still happen:

- split domain logic out of `server.py`
- deepen harness automation around status generation
- harden selective-write policy semantics with more explicit tests

Supporting evidence:

- [docs/codebase-map.md](docs/codebase-map.md)
- [docs/refactor-repair-plan.md](docs/refactor-repair-plan.md)

## Repository knowledge

- [Documentation map](docs/knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
