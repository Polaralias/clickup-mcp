---
type: "Delivery Plan"
title: "Tech Debt Tracker"
description: "Documents Tech Debt Tracker for the clickup-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - clickup-mcp
  - delivery-plan
navigation:
  role: supporting
  order: 100
---
# Tech Debt Tracker

## High Priority

- repair live-confirmed broken tool implementations
- align manifest defaults and runtime behaviour
- eliminate stale docs-route and template-route assumptions
- keep the canonical status artefact aligned with repair work

## Medium Priority

- split `server.py` by domain
- improve error normalisation
- formalise response-shape adapters for v3 docs routes

## Low Priority

- broaden product and operator documentation after repair work stabilises

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
