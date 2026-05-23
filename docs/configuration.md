# Configuration

This document describes the repository’s current validated configuration model.

It documents the current operational configuration surface of the server and the boundaries that remain highest-risk.

## Core Runtime Variables

### Required for upstream ClickUp access

- `CLICKUP_API_TOKEN`
- `CLICKUP_TEAM_ID` or `TEAM_ID`

Validated:

- these values are required for live ClickUp calls
- the runtime resolves workspace/team ID from these env vars when not explicitly provided in tool inputs

### MCP auth variables

- `CLICKUP_MCP_API_KEY`
- `MCP_API_KEY`
- `MCP_API_KEYS`
- `API_KEY_MODE`

Intended model:

- static bearer auth for MCP clients
- optionally disabled with `API_KEY_MODE=disabled`

Design reference:

- [docs/design-docs/auth-principles.md](design-docs/auth-principles.md)

### Runtime binding and transport

- `MCP_HOST` or `HOST`
- `MCP_PORT` or `PORT`
- `MCP_PATH`
- `MCP_TRANSPORT` or `FASTMCP_TRANSPORT`

Validated:

- local helper commands use these values
- default local transport is HTTP via FastMCP

### Write-safety configuration

- `WRITE_MODE`
- `READ_ONLY_MODE`
- `SELECTIVE_WRITE`
- `WRITE_ALLOWED_SPACES`
- `WRITE_ALLOWED_LISTS`

Important note:

- the write-safety surface exists and is exposed by the runtime health output
- selective write inference remains the highest-risk policy area and should only change with matching harness updates

Design reference:

- [docs/design-docs/write-safety-principles.md](design-docs/write-safety-principles.md)

### Runtime tuning

- `CLICKUP_HTTP_TIMEOUT_MS`
- `CHAR_LIMIT`
- `MAX_ATTACHMENT_MB`
- `REPORTING_MAX_TASKS`
- `DEFAULT_RISK_WINDOW_DAYS`
- `HIERARCHY_CACHE_TTL_MS`
- `HIERARCHY_CACHE_TTL_SECONDS`
- `SPACE_CONFIG_CACHE_TTL_MS`
- `SPACE_CONFIG_CACHE_TTL_SECONDS`

## Local Usage

Typical local workflow:

```bash
python scripts/run_server.py doctor
python scripts/run_server.py url
python scripts/run_server.py serve
python scripts/run_harness.py
```

## Test and Harness Workflow

Checked-in local harness commands:

- `python scripts/validate_harness.py`
- `python scripts/run_harness.py`
- `python scripts/run_live_smoke.py`

`run_harness.py` disables third-party pytest plugin autoload before running the repo tests so harness execution is less dependent on workstation-specific Python installations.

### Live smoke targeting

Optional test-only variables:

- `CLICKUP_LIVE_SMOKE_SPACE_ID`
- `CLICKUP_LIVE_SMOKE_DOC_ID`

These are used only by the checked-in live smoke harness.

Reference:

- [docs/live-smoke.md](live-smoke.md)

## Docker and Packaging

Repository packaging files:

- [Dockerfile](../Dockerfile)
- [docker-compose.yml](../docker-compose.yml)
- [fastmcp.json](../fastmcp.json)

Current status:

- packaging exists and is usable
- runtime correctness is proved by the harness, not by packaging files alone
- the compose file can now render and start a bounded local health check without a local `.env` file

Typical Docker validation workflow:

```bash
docker build -t clickup-mcp:local .
docker run --rm -p 3004:3004 -e API_KEY_MODE=disabled clickup-mcp:local
curl http://127.0.0.1:3004/health
```

## Configuration Confidence

### High confidence

- upstream ClickUp token and workspace/team ID requirements
- local host/port/path resolution
- presence of MCP bearer auth configuration

### Medium confidence

- runtime tuning knobs
- Docker defaults

### Lower confidence

- selective write behavior as a product-grade safety guarantee

## Supporting Evidence

- [docs/codebase-map.md](codebase-map.md)
- [docs/non-live-validation-probe.md](non-live-validation-probe.md)
- [docs/status/tool-validation-status.json](status/tool-validation-status.json)
