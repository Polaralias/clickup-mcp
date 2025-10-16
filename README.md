# ClickUp MCP Server

An MCP server for the entire [ClickUp REST API](https://clickup.com/api) built with
[Smithery](https://smithery.ai). The server exposes dedicated tools for every
documented operation (derived from the public OpenAPI spec) along with helper
utilities for browsing the public documentation.

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (installed automatically by Smithery CLI)
- A ClickUp personal API token or OAuth access token

## Configuration

When launching the server through Smithery you can provide session-scoped
configuration parameters:

| Setting | Description |
| --- | --- |
| `api_token` | **Required.** ClickUp API token used for Bearer authentication. |
| `base_url` | Optional override for the ClickUp API base URL. Defaults to `https://api.clickup.com/api/v2`. |
| `default_team_id` | Optional team identifier automatically injected into requests when `include_team_id` is enabled. |
| `request_timeout` | Timeout in seconds for outbound requests (default `30`). |
| `default_headers` | Extra headers merged into every ClickUp request. |

## Available tools

The server exposes a curated catalogue of tools that wrap the official ClickUp
REST API with task-focused helpers. Categories include:

- **Task management** – create, update, move, duplicate, search, and delete
  tasks, as well as comment, file attachment, and tag operations.
- **Hierarchy and metadata** – fetch workspace hierarchy, lists, folders,
  spaces, and tags with high level name resolution helpers.
- **Time tracking** – start/stop timers and manage manual time entries.
- **ClickUp Docs** – manage documents and document pages.
- **Workspace members** – list and resolve members for assignment.

Documentation helpers remain available through the `list_clickup_reference_links`
and `fetch_clickup_reference_page` tools.

For a complete description of every tool, including safety hints that
differentiate read-only, idempotent, and destructive operations, reference the
`clickup://guide/tools` resource. Configuration guidance lives at
`clickup://guide/configuration`.

## Run locally

```bash
# start the development server on port 8081
uv run dev

# open the Smithery playground connected to your local server
uv run playground
```

## Deploy

1. Commit your changes and push the repository to GitHub.
2. Visit [smithery.ai/new](https://smithery.ai/new) and select this project.
3. Provide your production configuration (usually just the API token) and deploy.

Once deployed you can install the server from the Smithery registry or reference
it directly from any MCP-compatible client.
