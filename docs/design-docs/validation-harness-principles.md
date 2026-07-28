---
type: "Validation Evidence"
title: "Validation Harness Principles"
description: "Documents Validation Harness Principles for the clickup-mcp repository."
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
# Validation Harness Principles

## Desired End State

The repository should include a repeatable validation harness that supports:

- static contract checks
- public-spec comparison
- local integration tests
- disposable live smoke tests

The harness should be explicitly multi-layered:

- `truth` layer: proves what the repository does today
- `contract` layer: proves what the repaired product is supposed to do

These layers should not be collapsed into a single pass/fail surface while repair work is still in progress.

## Layer Model

### Truth layer

Purpose:

- preserve current validated knowledge
- detect accidental changes in known runtime behaviour
- keep broken behaviour visible until it is intentionally repaired

Typical checks:

- current live-valid tools still succeed
- current live-broken tools still fail in expected ways until repaired
- current route, payload, and response-shape observations remain reproducible

### Contract layer

Purpose:

- define the desired post-repair product behaviour
- drive engineering towards the intended public-quality tool surface

Typical checks:

- repaired tools match validated replacement endpoint and payload shapes
- manifest and runtime semantics align
- public documentation matches actual runtime behaviour

### Relationship between layers

- truth is present-tense
- contract is target-state
- a tool may be truth-validated and contract-failing during the repair phase
- that state is acceptable if it is documented explicitly

## Unit of Verification

The primary harness unit should be the functional capability, not the raw endpoint or tool name.

### Why capability is the right unit

- endpoints are too low-level and can change without changing product behaviour
- tool names are not enough when implementation shifts from direct endpoint calls to composed flows
- large domains are too coarse for precise regression tracking

### Capability shape

Each capability should record:

- capability name
- truth-layer status
- contract-layer status
- runtime tool or tools involved
- endpoint or composition path involved
- fixture requirements
- cleanup requirements

### Examples

- member listing
- docs page listing
- docs page read
- task duplication
- bulk task create
- bulk task update
- bulk task delete
- bulk tag add

The capability remains stable even if:

- a route changes
- a payload shape changes
- implementation moves from one endpoint to several composed operations

## Authority Model

The harness should be authoritative for machine-readable status.

The documentation should be authoritative for narrative interpretation.

### Harness authority

The harness should own:

- capability status
- truth-layer pass/fail state
- contract-layer pass/fail state
- machine-readable evidence outputs

### Documentation authority

The docs should own:

- why a capability matters
- what the desired end state is
- why a broken state is acceptable temporarily
- what trade-offs or design decisions led to the current direction

### Rule

Docs should summarise harness state, not invent a competing status system.

If a status is important enough to repeat in docs, it should reference the harness-owned machine-readable source.

## Harness Requirements

- deterministic setup
- deterministic cleanup
- explicit env-based credentials
- safe disposable naming conventions
- machine-readable pass/fail output
- machine-readable distinction between truth failures and contract failures

## Failure Semantics

During any future repair or drift tranche:

- truth-layer failures are immediate regressions
- contract-layer failures are expected until the relevant repair is completed

The harness should make this distinction obvious in output and reporting.

## Why This Matters

The repository now has the documented status model and authority boundaries needed to support durable regression protection work.

## Repository knowledge

- [Documentation map](../knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
