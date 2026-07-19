# 0004 Canonical Status Artefact

Date: 2026-05-22

## Status

Accepted

## Context

The repository previously used [docs/archive/2026-05-16-tool-trust-matrix.json](../archive/2026-05-16-tool-trust-matrix.json), a bucket-first historical artefact whose original location implied generation that did not exist.

The platform needs a single authoritative machine-readable source that matches the decisions already made about:

- full-manifest enumeration
- per-tool current validation state
- per-tool end-state compliance
- evidence requirements
- freshness semantics
- primary next action

## Decision

The current bucket-based trust matrix will be replaced by a new canonical status artefact.

The canonical artefact will:

- be tool-keyed first
- keep the full per-tool record together in one place
- serve as the single authoritative machine-readable status source
- live outside `docs/generated/` until it is actually produced by automation

The archived trust matrix should be treated as an interim, ad hoc artefact rather than the long-term platform shape.

## Consequences

- status ownership becomes clearer because each tool has one canonical record
- the repository avoids implying automation maturity it does not yet have
- future generation can be added later without changing the conceptual ownership model
