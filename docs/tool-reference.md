---
type: "Reference"
title: "Tool Reference"
description: "Documents Tool Reference for the clickup-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - clickup-mcp
  - reference
navigation:
  role: reference
  order: 200
---
# Tool Reference

This document summarises the validated tool surface without duplicating the canonical machine-readable status record.

The authoritative machine-readable source for current tool status is:

- [docs/status/tool-validation-status.json](status/tool-validation-status.json)

This document is the narrative guide to that status source.

## Current Snapshot

As of [docs/status/tool-validation-status.json](status/tool-validation-status.json):

- `79` tools are `validated`
- `0` tools remain in non-validated states

Use the JSON artefact for exact per-tool records, evidence, and next actions.

## Evidence Backbone

The current status model is grounded in these evidence sources:

- [docs/live-runtime-tool-tests.md](live-runtime-tool-tests.md)
- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)
- [docs/manifest-runtime-drift.md](manifest-runtime-drift.md)
- [docs/non-live-validation-probe.md](non-live-validation-probe.md)
- [docs/refactor-repair-plan.md](refactor-repair-plan.md)

## Tool Domains

The manifest currently spans these broad domains:

- system
- hierarchy
- members
- tags and views
- tasks and subtasks
- docs
- time tracking
- reporting
- public-reference helpers

Repository map:

- [docs/codebase-map.md](codebase-map.md)

## Public Contract Warning

Use the canonical status artefact as the current truth source for tool readiness.

Preserve these rules when changing the runtime:

- do not treat undocumented bulk endpoints as safe implementation targets
- do not treat historical route assumptions as live guarantees
- do not widen public claims without matching regression or live evidence

Use these references instead:

- [docs/status/tool-validation-status.json](status/tool-validation-status.json)
- [docs/refactor-repair-plan.md](refactor-repair-plan.md)
- [docs/correct-endpoints-and-functionality.md](correct-endpoints-and-functionality.md)
- [docs/live-runtime-tool-tests.md](live-runtime-tool-tests.md)

## Primary Non-Live API Inputs

When validating tool behaviour against published ClickUp interfaces, use:

- [ClickUp v2 schema](https://developer.clickup.com/openapi/clickup-api-v2-reference.json)
- [ClickUp v3 schema](https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml)

## Repository knowledge

- [Documentation map](knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
