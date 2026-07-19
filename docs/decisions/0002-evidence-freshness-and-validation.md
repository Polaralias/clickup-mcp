# 0002 Evidence Freshness And Validation

Date: 2026-05-22

## Status

Accepted

## Context

The platform needs to turn unknowns into knowns without overstating what has actually been proven.

During repair, some tools will be:

- never directly tested
- indirectly classified from related evidence
- previously tested, but at risk of becoming outdated after runtime or manifest changes

Without a freshness rule, the authoritative status source can silently carry forward outdated conclusions.

## Decision

The authoritative platform status model will:

- distinguish `unvalidated because never tested` from `unvalidated because evidence is stale`
- treat relevant runtime changes as making prior related evidence stale
- treat relevant manifest changes as making prior related evidence stale
- keep a tool non-validated until a direct validating check exists, even when strong indirect evidence improves its classification

A pure time-based expiry may be added later, but it is not required for the initial platform model.

## Consequences

- the platform can separate missing evidence from ageing evidence
- repair planning can target the right next action for each unvalidated tool
- indirect evidence remains useful for classification without being allowed to masquerade as validation
- future automation can invalidate stale classifications deterministically after runtime or manifest changes
