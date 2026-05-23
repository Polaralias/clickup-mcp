# clickup-mcp

Validated ClickUp MCP server with a fully checked-in tool surface and evidence-backed documentation.

## Current Status

As of 2026-05-23, the repository’s canonical status artifact reports `79/79` manifest-declared tools as `validated`.

What the repository currently proves:

- the full manifest surface is covered by the checked-in status artifact at [docs/status/tool-validation-status.json](docs/status/tool-validation-status.json)
- the checked-in harness passes through [scripts/run_harness.py](scripts/run_harness.py)
- runtime regressions are covered by checked-in tests for system, hierarchy, members, docs, views, tasks, time tracking, custom fields, and final-surface tool behavior
- live smoke coverage exists for disposable live ClickUp verification when the required environment is configured
- earlier repair and drift tranches are preserved as dated evidence rather than left as active plans

What to trust first:

- [GLOSSARY.md](GLOSSARY.md)
- [docs/status/tool-validation-status.json](docs/status/tool-validation-status.json)
- [docs/tool-reference.md](docs/tool-reference.md)
- [docs/configuration.md](docs/configuration.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/PLANS.md](docs/PLANS.md)

## Verification

Primary local verification entrypoints:

```bash
python scripts/validate_harness.py
python scripts/run_harness.py
python scripts/run_live_smoke.py
```

`run_harness.py` is the authoritative local test entrypoint. It disables third-party pytest plugin autoload so workstation-specific Python installs do not change harness behavior.

Live smoke usage, environment, and cleanup boundaries are documented in [docs/live-smoke.md](docs/live-smoke.md).

## Repository Structure

Core implementation:

- [server.py](server.py)
- [scripts/run_server.py](scripts/run_server.py)
- [tool_manifest_clickup.json](tool_manifest_clickup.json)

Canonical documentation:

- [AGENTS.md](AGENTS.md)
- [GLOSSARY.md](GLOSSARY.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/design-docs/index.md](docs/design-docs/index.md)
- [docs/product-specs/index.md](docs/product-specs/index.md)

Historical evidence and completed plan surfaces:

- [docs/refactor-repair-plan.md](docs/refactor-repair-plan.md)
- [docs/live-runtime-tool-tests.md](docs/live-runtime-tool-tests.md)
- [docs/exec-plans/completed/2026-05-22-runtime-repair-plan.md](docs/exec-plans/completed/2026-05-22-runtime-repair-plan.md)
- [docs/exec-plans/completed/2026-05-23-harness-engineering-plan.md](docs/exec-plans/completed/2026-05-23-harness-engineering-plan.md)

## Local Runtime

Local helper commands:

```bash
python scripts/run_server.py doctor
python scripts/run_server.py url
python scripts/run_server.py serve
```

## Docker

The repository supports a fresh-clone container validation path without requiring a local `.env` file or a pre-created external Docker network.

Build the image directly:

```bash
docker build -t clickup-mcp:local .
```

Run a bounded local smoke check:

```bash
docker run --rm -p 3004:3004 -e API_KEY_MODE=disabled clickup-mcp:local
```

Then query:

```bash
curl http://127.0.0.1:3004/health
```

Compose remains available for local runtime use:

```bash
docker compose up --build
```

Provide `CLICKUP_API_TOKEN` and `CLICKUP_TEAM_ID` through `.env` or the shell when you want live ClickUp-backed calls rather than just local health validation.

## Tool Surface

The full declared tool surface lives in [tool_manifest_clickup.json](tool_manifest_clickup.json).

The current authoritative validation view lives in:

- [docs/status/tool-validation-status.json](docs/status/tool-validation-status.json)

Current tool-status guidance:

- [docs/tool-reference.md](docs/tool-reference.md)
- [docs/product-specs/tool-trust-model.md](docs/product-specs/tool-trust-model.md)

## Configuration

Validated configuration guidance lives in:

- [docs/configuration.md](docs/configuration.md)

## Public API Reference Inputs

Primary non-live API references:

- [ClickUp v2 schema](https://developer.clickup.com/openapi/clickup-api-v2-reference.json)
- [ClickUp v3 schema](https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml)

Repository reference note:

- [docs/references/clickup-openapi-refs.txt](docs/references/clickup-openapi-refs.txt)
