# Troubleshooting Initialization Failures

The dedicated ClickUp tool branch added a hard dependency on the
[`dateparser`](https://dateparser.readthedocs.io/) package so the server can
turn natural-language dates into ClickUp timestamps. The import happens at
module load time in `clickup_mcp.server` and will raise
`ModuleNotFoundError: No module named 'dateparser'` if the runtime has not
installed the library yet.

When that happens the Smithery runtime aborts before the server can finish
registering tools, which appears as an initialization failure. Resolve the
problem by installing the new dependency (for example by running
`uv sync`, `uv pip install dateparser`, or updating your deployment
requirements). When deploying on Smithery you cannot install packages inside
the container manually, so make sure the `uv.lock` file is committed with the
new dependency—Smithery automatically runs `uv sync` during startup using the
lock file, ensuring `dateparser` is downloaded without manual intervention.

Relevant code:

* `from dateparser import parse as parse_date` in
  [`src/clickup_mcp/server.py`](../src/clickup_mcp/server.py)
* The dependency is declared in [`pyproject.toml`](../pyproject.toml)
* The resolved package list in [`uv.lock`](../uv.lock) ensures Smithery downloads
  `dateparser` during provisioning
