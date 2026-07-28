---
type: "Product Contract"
title: "Tool Trust Model"
description: "Documents Tool Trust Model for the clickup-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - clickup-mcp
  - product-contract
navigation:
  role: foundational
  order: 20
---
# Tool Trust Model

## Product Promise

The product promise of this repository is not “all ClickUp APIs are wrapped.”

It is:

> validated MCP tools for ClickUp, with explicit trust boundaries.

## Availability Policy

All tools declared in [tool_manifest_clickup.json](../../tool_manifest_clickup.json) are part of the product surface and are currently represented as `validated` in the canonical status artefact.

That means:

- manifest presence implies intended product support
- current trust status may vary by tool
- repair work should converge towards full manifest availability, not towards shrinking the tool surface by default

Current machine-readable reference:

- canonical: [docs/status/tool-validation-status.json](../status/tool-validation-status.json)
- archived predecessor: [docs/archive/2026-05-16-tool-trust-matrix.json](../archive/2026-05-16-tool-trust-matrix.json)

Current authority target:

- the harness and status artefact define the machine-readable source of truth
- docs like this one should interpret and explain that status, not duplicate it manually

## Current Validation States

The current platform model uses explicit present-tense validation states.

Current repository state:

- `validated`

## Product Requirement

Public docs and tool references should always communicate which category a tool belongs to.

Additional requirement:

- intended availability and current trust are separate concepts and should not be conflated
- machine-readable status should have a single authoritative source
- any future non-validated state must be reflected in the canonical status artefact with traceable evidence

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
