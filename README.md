# ClickUp MCP Server

This repository packages the ClickUp MCP server so it can run locally or in container platforms while keeping the Smithery deployment flow intact.

## Prerequisites
- Docker 24+
- Docker Compose v2

## Configuration
Populate the runtime values directly in [`docker-compose.yml`](./docker-compose.yml):
- `TEAM_ID`: ClickUp workspace identifier.
- `CLICKUP_API_TOKEN`: personal ClickUp API token.
- `PORT`: HTTP port exposed by the container (default `8081`).
- `TRANSPORT`: transport protocol; keep as `http` for container runs.
- `CHAR_LIMIT`: maximum characters returned before responses are truncated.
- `MAX_ATTACHMENT_MB`: largest upload size allowed (in megabytes).
- `READ_ONLY_MODE`: set to `true` to disable mutating tools.

## Running with Docker Compose
1. Update the values in [`docker-compose.yml`](./docker-compose.yml) for your ClickUp workspace.
2. Build and start the service:
   ```
   docker compose up --build
   ```
3. The MCP HTTP endpoint listens on `http://localhost:8081/mcp` and the health check is available at `http://localhost:8081/health`.

Smithery deployments continue to rely on [`smithery.yaml`](./smithery.yaml) and are unaffected by the Docker Compose setup.
