# 0003 Status Actionability

Date: 2026-05-22

## Status

Accepted

## Context

An authoritative status source that only describes validation state is informative but incomplete.

The repository goal is not merely to classify tools. It is to close the gap between the current product state and Full Support. That means the platform output needs to guide the next repair or verification move for each non-validated tool.

## Decision

Each non-validated tool in the authoritative platform status source will carry one `primary_next_action`.

The first platform version will use a single primary action per tool, even when a tool may later require multiple follow-on actions.

Examples include:

- direct runtime probe
- repair implementation
- contract alignment
- revalidate after change

`primary_next_action` belongs in the authoritative status source itself, not only in plans or prose.

## Consequences

- the platform output becomes operational, not just descriptive
- repair work can be prioritised directly from status data
- the first version remains simple enough to maintain because it avoids encoding a full dependency graph
