# AGENTS

## Purpose

This repository is a publish-ready, evidence-driven ClickUp MCP server.

Agent and contributor behavior should optimize for:

- correctness over surface area
- validated behavior over assumed behavior
- repair over refactor
- explicit contracts over implicit coupling

Primary domain language lives in `GLOSSARY.md`.

## Working Rules

- Treat repository documents as claims until validated.
- Treat runtime behavior as suspect until verified by static analysis, public spec comparison, or live tests.
- Do not add new feature surface before the existing tool contract is trustworthy.
- Prefer replacing broken direct API assumptions with validated composition over working primitives.
- Keep a clear separation between:
  - validated functionality
  - intended functionality
  - unsupported functionality

## Evidence Sources

Primary evidence for current repository state:

- [docs/status/tool-validation-status.json](docs/status/tool-validation-status.json)
- [docs/correct-endpoints-and-functionality.md](docs/correct-endpoints-and-functionality.md)
- [docs/live-runtime-tool-tests.md](docs/live-runtime-tool-tests.md)

## Engineering Priorities

1. Keep manifest, runtime, harness, and docs aligned in the same slice.
2. Preserve validated behavior before adding new feature surface.
3. Strengthen the harness before broadening trust claims.
4. Keep historical evidence and completed plans clearly subordinate to canonical current-state docs.

## Non-Goals

- broad refactors before behavior is stable
- adding speculative tools
- preserving invalid contracts for compatibility if they block correctness

## Shared Git Workflow

- work from a short-lived branch created from `main`
- do not commit directly to `main`
- use branch names prefixed with `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, or `test/`
- keep one logical change per branch and pull request
- open a pull request before merging to `main`, including for solo work
- prefer squash merge unless multiple commits carry durable review value
- delete the merged or closed feature branch after the work is finished; never delete `main`
- use tags in `vX.Y.Z` format for releases and do not move published tags
