---
type: "Repository Knowledge"
title: "Correct Endpoints and Functionality"
description: "Documents Correct Endpoints and Functionality for the clickup-mcp repository."
timestamp: 2026-07-28T21:55:36Z
authority: canonical
verification: untested
owner: polaralias
tags:
  - clickup-mcp
  - repository-knowledge
navigation:
  role: supporting
  order: 100
---
# Correct Endpoints and Functionality

Date of probe: 2026-05-16

This document maps currently broken runtime tools to the live-valid endpoint shape or functional replacement validated against the test workspace.

## Scope

Validated live with real workspace access:

- replacement endpoint shape where the runtime path is wrong
- replacement payload shape where the runtime body is wrong
- composition strategy where no direct working bulk/duplicate endpoint was validated

## Replacement Map

### `member_list_for_workspace`

Current runtime:

- [server.py](../server.py#L1186)
- uses `GET /v2/team/{workspace_id}/member`
- live result: `404`

Live-valid replacement:

- `GET /v2/team/{workspace_id}`

Live evidence:

- returned `200`
- response contains `team.members`
- validated member count from real workspace

Correct functionality:

- implement member listing by reading `team.members` from `GET /v2/team/{workspace_id}`
- `member_search_by_name`, `member_resolve`, and `task_assignee_resolve` can use that same payload as their backing source

### `doc_page_list`

Current runtime:

- [server.py](../server.py#L1446)
- uses `GET /api/v3/docs/{doc_id}/page_listing`
- live result: `404`

Live-valid replacement:

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing`

Live evidence:

- returned `200`
- returned a list of page metadata objects

Correct functionality:

- use the workspace-scoped route
- expect a list payload, not a dict with `pages`

### `doc_page_read`

Current runtime:

- [server.py](../server.py#L1451)
- uses `GET /api/v3/docs/{doc_id}/pages/{page_id}`
- live result: `404`

Live-valid replacement:

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/{page_id}`

Live evidence:

- returned `200`
- returned a page object containing content and metadata

Correct functionality:

- use the workspace-scoped route

### `doc_pages_read`

Current runtime:

- [server.py](../server.py#L1441)
- uses `POST /api/v3/docs/{doc_id}/pages/bulk`
- live result: `404`

Candidate alternative tested:

- `POST /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages/bulk`
- live result: `405`

Live-valid replacement:

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages`

Live evidence:

- returned `200`
- returned a list of page objects for the doc

Correct functionality:

- fetch all pages from the workspace-scoped pages collection
- filter client-side by requested `pageIds`

### `space_tag_create`

Current runtime:

- [server.py](../server.py#L1212)
- sends flat body fields like `tag`, `tag_bg`, `tag_fg`
- live result: `400 Tag missing from body`

Live-valid replacement payload:

```json
{
  "tag": {
    "name": "<tag-name>",
    "tag_fg": "#111111",
    "tag_bg": "#22aa22"
  }
}
```

Live evidence:

- flat payloads all failed with `TAGS_020`
- nested `tag` object payload succeeded with `200`
- created tags were confirmed by `GET /v2/space/{space_id}/tag`

Correct functionality:

- keep the existing route `POST /v2/space/{space_id}/tag`
- change the request body shape to nested `tag`

### `list_create_from_template`

Current runtime:

- [server.py](../server.py#L1250)
- uses:
  - `POST /v2/folder/{folder_id}/list/template/{template_id}`
  - `POST /v2/space/{space_id}/list/template/{template_id}`

Live-valid replacement shape:

- `POST /v2/folder/{folder_id}/list_template/{template_id}`
- `POST /v2/space/{space_id}/list_template/{template_id}`

Live evidence:

- runtime path shape returned plain `404`
- underscore path shape returned structured `Template not found`, which means the route was recognised

Correct functionality:

- replace `list/template` with `list_template`

## Composition Replacements

These tools did not validate as working direct endpoints. Live testing supports implementing them as composed operations over working single-item endpoints.

### `task_duplicate`

Current runtime:

- [server.py](../server.py#L1321)
- uses `POST /v2/task/{task_id}/duplicate`
- live result: `404`

Live-validated functional replacement:

1. `GET /v2/task/{task_id}`
2. extract copyable fields
3. `POST /v2/list/{list_id}/task` with copied content

Live evidence:

- composition was executed successfully
- created duplicate task was verified in the temporary list

Correct functionality:

- implement duplicate as read-then-create composition

### `task_create_bulk`

Current runtime:

- [server.py](../server.py#L1338)
- uses `POST /v2/task/bulk`
- live result: `405`

Live-validated functional replacement:

- loop `POST /v2/list/{list_id}/task` for each item

Live evidence:

- created multiple tasks successfully during the composition probe

Correct functionality:

- implement bulk create as iterative single-task create

### `task_update_bulk`

Current runtime:

- [server.py](../server.py#L1344)
- uses `PUT /v2/task/bulk`
- live result from runtime path was not trustworthy

Live-validated functional replacement:

- loop `PUT /v2/task/{task_id}` for each item

Live evidence:

- multiple updates succeeded during the composition probe

Correct functionality:

- implement bulk update as iterative single-task update

### `task_delete_bulk`

Current runtime:

- [server.py](../server.py#L1347)
- uses `DELETE /v2/task/bulk`
- live result was not trustworthy

Live-validated functional replacement:

- loop `DELETE /v2/task/{task_id}`

Live evidence:

- cleanup deletions succeeded for all temporary tasks

Correct functionality:

- implement bulk delete as iterative single-task delete

### `task_tag_add_bulk`

Current runtime:

- [server.py](../server.py#L1350)
- uses `POST /v2/task/tag/bulk`
- live result: `404`

Live-validated functional replacement:

- loop `POST /v2/task/{task_id}/tag/{tag_name}`

Live evidence:

- bulk-style tagging succeeded by composition across multiple tasks

Correct functionality:

- implement bulk tag add as iterative single-task tag add

## Notes on Docs Response Shape

An additional implementation detail matters for the docs tools:

- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/page_listing` returned a list
- `GET /api/v3/workspaces/{workspace_id}/docs/{doc_id}/pages` returned a list
- current runtime assumes dict-like payload handling in some places

So the fix is not only path replacement; response handling must also match the live payload shape.

## Practical Conclusion

The broken tools now fall into a clear repair model:

### Direct endpoint/payload fixes

- `member_list_for_workspace`
- `doc_page_list`
- `doc_page_read`
- `doc_pages_read`
- `space_tag_create`
- `list_create_from_template`

### Composition-based replacements

- `task_duplicate`
- `task_create_bulk`
- `task_update_bulk`
- `task_delete_bulk`
- `task_tag_add_bulk`

This is now a validated implementation target, not a guess.

## Repository knowledge

- [Documentation map](knowledge/documentation-map.md) — RKE-managed reading order and relationship hub.
