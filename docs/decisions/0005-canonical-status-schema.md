# 0005 Canonical Status Schema

Date: 2026-05-22

## Status

Accepted

## Context

The repository has decided that the platform requires a single authoritative machine-readable status source for all manifest-declared tools.

That source must support:

- full-manifest enumeration
- per-tool current validation state
- per-tool end-state compliance
- evidence citations for non-validated states
- freshness semantics
- one primary next action per non-validated tool

The current bucket-first trust matrix does not provide a durable shape for these needs.

## Decision

The first canonical platform status artifact will be a tool-keyed machine-readable file at:

- `docs/status/tool-validation-status.json`

The file is authoritative even before automation exists. It is manually curated until the harness takes over generation or validation of its contents.

## Required Top-Level Fields

- `as_of`
- `source_manifest`
- `policy`
- `tools`

## Required Policy Fields

- `full_manifest_support_required`
- `end_state_requires_all_tools_validated`
- `non_validated_tools_require_evidence`
- `capability_level_compliance_internal_only`

## Tool Record Shape

Each tool record is keyed by tool name and must contain:

- `current_validation_state`
- `end_state_compliant`
- `primary_next_action`
- `evidence`

Optional fields may include:

- `notes`
- `capability_mapping_incomplete`
- `freshness`
- `related_capabilities`

## Allowed Current Validation States

The initial canonical state set is:

- `validated`
- `validated_replacement_available`
- `confirmed_broken_runtime`
- `live_failing_untrustworthy`
- `manifest_runtime_drift`
- `unvalidated_never_tested`
- `unvalidated_stale_evidence`

This set may evolve, but changes should be deliberate because downstream docs and harness reporting will depend on it.

## Field Semantics

### `current_validation_state`

Describes the present-tense product state for the tool.

### `end_state_compliant`

True only when the tool is validated and therefore satisfies the Full Support requirement.

### `primary_next_action`

The single highest-value next step needed to advance the tool toward Full Support.

Examples:

- `none`
- `direct_runtime_probe`
- `repair_implementation`
- `contract_alignment`
- `revalidate_after_change`

### `evidence`

A non-empty list for every non-validated tool.

Each evidence entry should contain:

- `source`
- `kind`
- `summary`

Optional:

- `date`
- `stale`

### `capability_mapping_incomplete`

Internal platform marker for tools that are fully enumerated but not yet exhaustively decomposed into capabilities.

This should not be treated as a product-facing acceptance field.

### `freshness`

Optional structured description of evidence freshness, especially when a classification is stale due to runtime or manifest changes.

## Consequences

- every tool gets one canonical record
- docs can consume one authority source instead of re-inventing classifications
- the status model can support the repair phase without weakening the final all-validated end state
