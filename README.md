# ClickUp MCP Server
[![smithery badge](https://smithery.ai/badge/@Polaralias/clickup-mcp)](https://smithery.ai/server/@Polaralias/clickup-mcp)

An MCP server for the entire [ClickUp REST API](https://clickup.com/api) built with
[Smithery](https://smithery.ai). The server exposes generic tools that let you
call any documented endpoint from Smithery-compatible clients, plus helper tools
for scraping the public documentation.

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

- `call_clickup_api` – Perform any ClickUp API request. Supports path and query
  parameters, JSON bodies, form payloads, and multipart file uploads (base64
  encoded).
- `list_clickup_reference_links` – Scrape the navigation links from the official
  ClickUp API documentation to discover endpoint pages.
- `fetch_clickup_reference_page` – Download and sanitize a documentation page to
  provide the language model with the relevant guidance.

The server also ships a `clickup://guide/configuration` resource and a
`call_endpoint_prompt` prompt template to help agents prepare API calls.

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

### Installing via Smithery

To install ClickUp automatically via [Smithery](https://smithery.ai/server/@Polaralias/clickup-mcp):

```bash
npx -y @smithery/cli install @Polaralias/clickup-mcp
```
