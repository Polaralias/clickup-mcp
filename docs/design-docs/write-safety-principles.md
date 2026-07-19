# Write Safety Principles

## Desired End State

Write safety should be based on explicit policy and predictable scope resolution.

## Current Problem

The repository currently mixes:

- explicit container IDs
- inferred task/doc context
- workspace and space identifiers in overlapping permission logic

That may work, but it is not yet proven enough to be treated as a public-quality guarantee.

## Design Requirements

- define the permission model for workspace, space, folder, list, task, and doc writes
- make explicit IDs the primary trust path
- keep inference as a fallback, not the normative contract
- test selective-write behaviour with disposable live artefacts
