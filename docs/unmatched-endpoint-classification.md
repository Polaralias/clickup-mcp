# Unmatched Endpoint Classification

Date of probe: 2026-05-16

This document classifies the `16` hardcoded path+method pairs in [server.py](../server.py) that do not have a direct match in the current downloadable public ClickUp schemas.

## Validation Source

This classification uses only the direct remote schema URLs:

- [clickup-api-v2-reference.json](https://developer.clickup.com/openapi/clickup-api-v2-reference.json)
- [ClickUp_PUBLIC_API_V3.yaml](https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml)

No page traversal was used.

## Buckets

### A. Strong stale/incorrect path candidate

The runtime path conflicts with a directly documented public-schema path.

### B. Public-schema unsupported, but not disproven

The public schema does not publish the route, but there is not enough static evidence here to call it wrong.

### C. Likely implementation shortcut that bypasses documented scoping

The runtime uses a shorter route shape than the public schema documents.

## Bucket A: Strong stale/incorrect path candidates

### `POST /v2/folder/{id}/list/template/{id}`

Runtime:

- [server.py](../server.py#L1250)

Public v2 schema evidence:

- documented route exists as `POST /v2/folder/{folder_id}/list_template/{template_id}`

Classification:

- strong stale/incorrect path candidate

Reason:

- the public schema shows a directly analogous route with `list_template`, not `list/template`

### `POST /v2/space/{id}/list/template/{id}`

Runtime:

- [server.py](../server.py#L1251)

Public v2 schema evidence:

- documented route exists as `POST /v2/space/{space_id}/list_template/{template_id}`

Classification:

- strong stale/incorrect path candidate

Reason:

- same issue as the folder-scoped variant

## Bucket B: Public-schema unsupported, but not disproven

### `GET /v2/team/{id}/member`

Runtime:

- [server.py](../server.py#L1186)

Public v2 schema evidence:

- member-related routes exist for:
  - `/v2/task/{task_id}/member`
  - `/v2/list/{list_id}/member`
- no `/v2/team/{team_id}/member` route is published

Classification:

- public-schema unsupported, but not disproven

Reason:

- there is no direct published equivalent
- the route may still be an internal or legacy API surface

### `POST /v2/task/{id}/duplicate`

Runtime:

- [server.py](../server.py#L1321)

Public v2 schema evidence:

- no duplicate route published in the downloadable v2 schema

Classification:

- public-schema unsupported, but not disproven

Reason:

- there is no direct public-schema analogue to compare against

### `POST /v2/task/bulk`

Runtime:

- [server.py](../server.py#L1340)
- [server.py](../server.py#L1343)

Public v2 schema evidence:

- no `/v2/task/bulk` route published

Classification:

- public-schema unsupported, but not disproven

Reason:

- absence from the public spec is a trust problem, but not proof of runtime invalidity

### `PUT /v2/task/bulk`

Runtime:

- [server.py](../server.py#L1346)

Classification:

- public-schema unsupported, but not disproven

### `DELETE /v2/task/bulk`

Runtime:

- [server.py](../server.py#L1349)

Classification:

- public-schema unsupported, but not disproven

### `POST /v2/task/tag/bulk`

Runtime:

- [server.py](../server.py#L1352)

Public v2 schema evidence:

- no published `/v2/task/tag/bulk` route

Classification:

- public-schema unsupported, but not disproven

## Bucket C: Likely implementation shortcuts bypassing documented scoping

These all belong to the docs page surface.

Public v3 schema documents workspace-scoped routes:

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`
- `POST /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`
- `PUT /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`

Runtime instead uses unscoped shorthand forms under `/api/v3/docs/...`.

### `GET /api/v3/docs/{id}/page_listing`

Runtime:

- [server.py](../server.py#L1427)
- [server.py](../server.py#L1446)

Classification:

- likely implementation shortcut bypassing documented scoping

Reason:

- public schema documents the workspace-scoped equivalent
- shorthand form is not in the downloadable schema

### `GET /api/v3/docs/{id}/pages/{id}`

Runtime:

- [server.py](../server.py#L1451)

Classification:

- likely implementation shortcut bypassing documented scoping

### `POST /api/v3/docs/{id}/pages`

Runtime:

- [server.py](../server.py#L1457)

Classification:

- likely implementation shortcut bypassing documented scoping

### `PUT /api/v3/docs/{id}/pages/{id}`

Runtime:

- [server.py](../server.py#L1460)

Classification:

- likely implementation shortcut bypassing documented scoping

### `POST /api/v3/docs/{id}/pages/bulk`

Runtime:

- [server.py](../server.py#L1431)
- [server.py](../server.py#L1441)

Classification:

- likely implementation shortcut bypassing documented scoping

Reason:

- no direct bulk page-read route appears in the downloadable v3 schema
- the closest documented surface is the workspace-scoped pages collection, not a bulk route

## Summary Table

### Bucket A: strong stale/incorrect path candidate

- `POST /v2/folder/{id}/list/template/{id}`
- `POST /v2/space/{id}/list/template/{id}`

### Bucket B: public-schema unsupported, but not disproven

- `GET /v2/team/{id}/member`
- `POST /v2/task/{id}/duplicate`
- `POST /v2/task/bulk`
- `PUT /v2/task/bulk`
- `DELETE /v2/task/bulk`
- `POST /v2/task/tag/bulk`

### Bucket C: likely docs-route implementation shortcut

- `GET /api/v3/docs/{id}/page_listing`
- `POST /api/v3/docs/{id}/pages/bulk`
- `GET /api/v3/docs/{id}/pages/{id}`
- `POST /api/v3/docs/{id}/pages`
- `PUT /api/v3/docs/{id}/pages/{id}`

Note:

- some runtime calls are duplicates of the same path shape, which is why the unique-path summary is shorter than the raw unmatched-call count

## Practical Conclusion

The highest-confidence static problems are now narrowed down:

1. list-template creation paths are very likely wrong or stale
2. docs page routes are very likely built against an undocumented shorthand instead of the published workspace-scoped v3 surface
3. bulk task and duplicate/member routes remain unresolved dependencies on behavior not represented in the public downloadable schemas

That gives a clear order for future live validation:

1. docs page routes
2. list-template routes
3. bulk task routes
4. team-member and task-duplicate routes
