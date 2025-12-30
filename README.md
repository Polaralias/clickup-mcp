# ClickUp MCP Server

A Model Context Protocol (MCP) server for the ClickUp API, enabling AI agents to interact with your ClickUp workspace.

## Features

- **Hierarchical Access**: Navigate through Spaces, Folders, and Lists.
- **Task Management**: Create, read, update, and delete tasks.
- **Time Tracking**: Log time entries and view reports.
- **Selective Permissions**: Configure read-only access or whitelist specific Spaces/Lists.
- **Secure Authentication**: Supports API Key authentication and a persistent session flow with encrypted storage.
- **Deployment Options**: Run locally via Docker, deploy to Cloudflare Workers, or use Smithery.

## Quick Start (Local Docker)

The easiest way to run the server locally is using Docker Compose. This sets up the MCP server along with a Postgres database for session storage.

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose installed.
- A ClickUp API Key (Settings -> Apps -> Generate API Key).

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/clickup-mcp-server.git
    cd clickup-mcp-server
    ```

2.  **Generate a Master Key:**
    You need a 32-byte hex string for encryption. You can generate one using:
    ```bash
    openssl rand -hex 32
    ```

3.  **Update `docker-compose.yml` (Optional):**
    The default `docker-compose.yml` is set up for production. For local testing, ensure the environment variables match your needs. You can pass variables directly or use an `.env` file.

    **Required Environment Variables:**
    - `MASTER_KEY`: The 64-character hex string generated above.
    - `POSTGRES_USER`: Database user (default: postgres).
    - `POSTGRES_PASSWORD`: Database password (default: postgres).
    - `POSTGRES_DB`: Database name (default: clickup_mcp).

4.  **Run with Docker Compose:**
    ```bash
    # Set the MASTER_KEY explicitly if not in .env
    MASTER_KEY=your_generated_hex_key docker-compose up --build
    ```

5.  **Access the Configuration UI:**
    Open your browser to `http://localhost:8081`.

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | The port the server listens on. | No | `8081` |
| `TRANSPORT` | Transport mode (`http` or `stdio`). Use `http` for Docker. | No | `http` |
| `MASTER_KEY` | 32-byte hex key for encrypting secrets. | **Yes** | - |
| `DATABASE_URL` | Postgres connection string. | **Yes** (or via specific PG vars) | - |
| `POSTGRES_HOST` | Database host. | No | `db` |
| `POSTGRES_PORT` | Database port. | No | `5432` |
| `POSTGRES_USER` | Database user. | No | `postgres` |
| `POSTGRES_PASSWORD` | Database password. | No | `postgres` |
| `POSTGRES_DB` | Database name. | No | `clickup_mcp` |

## Reverse Proxy Configuration (Nginx Proxy Manager)

This server is designed to work behind a reverse proxy like Nginx Proxy Manager (NPM). This is useful for exposing the server securely over HTTPS.

### Configuration Steps

1.  **Deploy the Server:** Ensure the Docker container is running and accessible (e.g., on port `8081`).
2.  **Add Proxy Host in NPM:**
    - **Domain Names**: `your-mcp-server.domain.com`
    - **Scheme**: `http`
    - **Forward Hostname / IP**: `host.docker.internal` (or the container name/IP if on the same network).
    - **Forward Port**: `8081`
    - **Block Common Exploits**: Checked.
3.  **SSL**: Request a Let's Encrypt certificate.
4.  **Advanced**:
    - The server is configured to trust headers from the proxy (`X-Forwarded-For`, `X-Forwarded-Proto`, etc.). No special "Custom Nginx Configuration" is typically required for basic operation.

## Authentication Flow

This server supports a standard OAuth 2.0-style flow for creating secure sessions, which is critical when running in a multi-user environment or behind a proxy.

### How it Works

1.  **Initiation**:
    The client (e.g., an AI agent or a web dashboard) directs the user to the Configuration UI with a `redirect_uri` parameter:
    `https://your-server.com/?redirect_uri=https://client-app.com/callback`

2.  **Configuration**:
    The user enters their ClickUp API Key and configures permissions (Read Only, Selective Write) in the UI.

3.  **Authorization**:
    When the user clicks "Connect", the server:
    - Creates a persistent **Connection** record (encrypted API key).
    - Generates a short-lived **Authorization Code**.
    - Redirects the user back to the `redirect_uri` with the code:
      `https://client-app.com/callback?code=generated_auth_code`

4.  **Token Exchange**:
    The client application blindly exchanges this code for a long-lived **Session Token**:
    - **POST** `/api/auth/token`
    - **Body**: `{ "code": "generated_auth_code", "redirect_uri": "https://client-app.com/callback" }`
    - **Response**: `{ "accessToken": "session_id:session_secret" }`

5.  **API Usage**:
    The client uses this token to make authenticated requests:
    - **Header**: `Authorization: Bearer session_id:session_secret`
    - **Header**: `MCP-Session-ID: session_id` (Optional but recommended for stateful context)

This flow ensures the sensitive API Key never leaves the server's secure storage after initial entry, and the Client Application never handles the raw API Credentials.

## Deployment on Cloudflare Workers

1.  **Install dependencies:** `npm install`
2.  **Build:** `npm run build`
3.  **Deploy:** `npx wrangler deploy`

See `wrangler.jsonc` for configuration details.

## Deployment with Smithery

To run the ClickUp MCP server using [Smithery](https://smithery.ai):

```bash
npx -y @smithery/cli run clickup-mcp-server --config "{\"teamId\":\"123456\",\"apiKey\":\"pk_...\"}"
```

## License

MIT
