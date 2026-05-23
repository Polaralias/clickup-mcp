# Public Spec Comparison

Date of probe: 2026-05-16

This report compares hardcoded ClickUp API calls in [server.py](../server.py) with the direct downloadable public ClickUp API schemas.

## Schema Targets

Per current validation target, this comparison uses the remote schema URLs directly.

- v2 schema: [clickup-api-v2-reference.json](https://developer.clickup.com/openapi/clickup-api-v2-reference.json)
- v3 schema: [ClickUp_PUBLIC_API_V3.yaml](https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml)

Notes:

- both URLs were reachable on 2026-05-16
- the v3 URL ends in `.yaml` but was served as JSON and parsed successfully
- no page traversal was needed for this probe

## Baseline

Public schema availability:

- v2 OpenAPI version: `3.1.0`
- v2 documented paths: `82`
- v3 OpenAPI version: `3.0.0`
- v3 documented paths: `23`

Runtime extraction:

- hardcoded ClickUp client calls found in `server.py`: `69`
- path+method pairs matching public schemas: `53`
- path+method pairs without a direct public-schema match: `16`

## Direct Matches

Most of the core read/write surface does have a direct public-schema counterpart.

Examples that matched:

- `GET /v2/team`
- `GET /v2/team/{id}/space`
- `GET /v2/space/{id}/folder`
- `GET /v2/space/{id}/list`
- `GET /v2/folder/{id}/list`
- `GET /v2/task/{id}`
- `GET /v2/list/{id}`
- `POST /v2/list/{id}/task`
- `PUT /v2/task/{id}`
- `DELETE /v2/task/{id}`
- `POST /v2/task/{id}/comment`
- `POST /v2/task/{id}/attachment`
- `POST /v2/task/{id}/tag/{id}`
- `DELETE /v2/task/{id}/tag/{id}`
- `GET /v2/list/{id}/field`
- `POST /v2/task/{id}/field/{id}`
- `DELETE /v2/task/{id}/field/{id}`
- `POST /api/v3/workspaces/{id}/docs`
- `GET /api/v3/workspaces/{id}/docs`
- `GET /api/v3/workspaces/{id}/docs/{id}`

That is enough to say the server is not operating on fantasy endpoints across the board.

## No Direct Public-Schema Match

The following hardcoded path+method pairs do not appear in the current downloadable public schemas.

### Member endpoint

- `GET /v2/team/{id}/member`
  - runtime: [server.py](../server.py#L1186)

Public-spec note:

- the v2 schema includes task/list member endpoints
- it does not include `team/{team_id}/member`

### List-template creation endpoints

- `POST /v2/folder/{id}/list/template/{id}`
  - runtime: [server.py](../server.py#L1250)
- `POST /v2/space/{id}/list/template/{id}`
  - runtime: [server.py](../server.py#L1251)

Public-spec note:

- current v2 schema documents:
  - `/v2/folder/{folder_id}/list_template/{template_id}`
  - `/v2/space/{space_id}/list_template/{template_id}`

This is not just undocumented behavior; it is also a path-shape mismatch.

### Task duplication

- `POST /v2/task/{id}/duplicate`
  - runtime: [server.py](../server.py#L1321)

Public-spec note:

- no direct duplicate endpoint was present in the current downloadable v2 schema

### Bulk task operations

- `POST /v2/task/bulk`
  - runtime: [server.py](../server.py#L1340)
- `POST /v2/task/bulk`
  - runtime: [server.py](../server.py#L1343)
- `PUT /v2/task/bulk`
  - runtime: [server.py](../server.py#L1346)
- `DELETE /v2/task/bulk`
  - runtime: [server.py](../server.py#L1349)
- `POST /v2/task/tag/bulk`
  - runtime: [server.py](../server.py#L1352)

Public-spec note:

- the currently downloadable v2 schema does not publish these bulk task routes

### Docs page routes

Runtime uses shortened doc-page paths without workspace scoping:

- `GET /api/v3/docs/{id}/page_listing`
  - runtime: [server.py](../server.py#L1427)
- `POST /api/v3/docs/{id}/pages/bulk`
  - runtime: [server.py](../server.py#L1431)
- `POST /api/v3/docs/{id}/pages/bulk`
  - runtime: [server.py](../server.py#L1441)
- `GET /api/v3/docs/{id}/page_listing`
  - runtime: [server.py](../server.py#L1446)
- `GET /api/v3/docs/{id}/pages/{id}`
  - runtime: [server.py](../server.py#L1451)
- `POST /api/v3/docs/{id}/pages`
  - runtime: [server.py](../server.py#L1457)
- `PUT /api/v3/docs/{id}/pages/{id}`
  - runtime: [server.py](../server.py#L1460)

Public-spec note:

- the downloadable v3 schema currently documents workspace-scoped forms instead:
  - `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing`
  - `POST /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`
  - `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`

There is also no published bulk page-read route in the downloadable v3 schema.

## Interpretation

These unmatched routes fall into three buckets.

### 1. Probably undocumented but possibly real

Examples:

- `GET /v2/team/{id}/member`
- `POST /v2/task/{id}/duplicate`
- `/v2/task/bulk`

These may still work in production, but the public schema does not support them as part of a non-live validation story.

### 2. Probably stale path shape

Examples:

- `list/template/...` in runtime vs `list_template/...` in public v2 schema

This is a stronger warning sign because the public spec points to a directly different path.

### 3. Probably wrong docs-page path construction

Examples:

- runtime omits workspace scope from page-list and page-read/write routes

This is the clearest current mismatch between runtime assumptions and public spec.

## Reference Tool Implication

If this repository keeps any “reference” or “spec” helper surface, the reliable public targets should now be the schema remotes themselves:

- [clickup-api-v2-reference.json](https://developer.clickup.com/openapi/clickup-api-v2-reference.json)
- [ClickUp_PUBLIC_API_V3.yaml](https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml)

That gives a stable validation anchor without:

- landing-page scraping
- relative-link traversal
- dependence on current docs-site navigation markup

## Practical Conclusion

The public-schema comparison supports two conclusions at once:

1. the server is partly grounded in the published API surface, because most hardcoded path+method pairs do match
2. the highest-risk areas are now clearly identified, because `16` hardcoded path+method pairs do not have direct public-schema support

Before live ClickUp testing, the most defensible next static action would be to classify each unmatched route as one of:

- publicly documented equivalent exists under a different path
- publicly undocumented but intentionally used
- likely stale or incorrect
