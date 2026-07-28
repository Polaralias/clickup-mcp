---
type: "Product Contract"
title: "Tool Contract Principles"
description: "Documents Tool Contract Principles for the clickup-mcp repository."
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
# Tool Contract Principles

## Desired End State

For every public tool:

- inputs are implemented as documented
- defaults are honoured as documented
- output shape is stable enough to depend on
- unsupported options are removed rather than implied

## Current Problem

The manifest is structurally valid but not yet fully behaviourally true.

Evidence:

- [docs/manifest-runtime-drift.md](../manifest-runtime-drift.md)

## Design Rule

If implementation and manifest disagree, resolve the disagreement quickly and document the outcome.

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
