# 0001 Platform Status Model

Date: 2026-05-22

## Status

Accepted

## Context

The repository needs an authoritative platform status source that can describe the current repair state without weakening the final product promise of Full Support.

The current checked-in status artefact is evidence-backed but ad hoc. The repository needed a clearer decision on:

- what the authoritative status record must contain
- whether acceptance is measured at tool level, capability level, or both
- whether non-validated classifications may exist without cited evidence

## Decision

The authoritative platform status model will:

- enumerate every manifest-declared tool from the start
- record a `current_validation_state` for each tool
- record an `end_state_compliant` signal for each tool
- require checked-in evidence citations for every non-validated classification

`end_state_compliant` is true only when the tool is validated and therefore satisfies the Full Support end-state requirement.

Capability-level compliance may exist internally during repair and refactor work, but it is not part of the final product-facing status surface.

## Consequences

- the platform can describe transitional repair states without diluting the end-state requirement
- final product reporting can stay simple: a tool is either end-state compliant or it is not
- capability-first validation remains useful for engineering, but does not become a confusing public acceptance surface
- uncited non-validated classifications are not acceptable in the authoritative status source
