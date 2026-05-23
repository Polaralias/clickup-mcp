# Manifest vs Runtime Drift

Date of probe: 2026-05-16

This report compares the declared MCP contract in [tool_manifest_clickup.json](../tool_manifest_clickup.json) with the current implementation in [server.py](../server.py).

## Scope

Validated:

- manifest structural validity
- runtime coverage of declared tool names
- parameter and default drift visible from static inspection

Not validated:

- live ClickUp behavior
- whether undocumented endpoints still work in production

## Baseline

Static checks passed:

- manifest tool count: `79`
- duplicate tool names: none
- malformed `required` declarations: none
- dispatch coverage of manifest tool names: complete

That means the contract is structurally tidy.

The problem is behavioral drift, not manifest formatting.

## Drift Types

### 1. Declared parameter is ignored

The schema advertises an input that the runtime does not use.

### 2. Declared default is not actually honored

The schema implies a behavior when the caller omits a field, but the runtime behaves differently.

### 3. Tool name implies richer behavior than the implementation provides

The tool exists, but the implementation is narrower than the contract suggests.

## Confirmed Drift

### `doc_read`

Manifest:

- `includePages` default `true`
- `pageLimit` default `20`
- `previewCharLimit` accepted

Runtime:

- [server.py](../server.py#L1422) only includes pages when `args.get("includePages")` is truthy
- if the caller omits `includePages`, runtime behavior is effectively falsey, not default-true
- `pageLimit` is never applied to page metadata or detailed pages

Assessment:

- confirmed default drift on `includePages`
- confirmed ignored parameter on `pageLimit`

### `doc_list`

Manifest:

- `includePreviews` default `true`
- `previewPageLimit` default `3`
- `previewCharLimit` accepted

Runtime:

- [server.py](../server.py#L1418) passes only `search`, `limit`, `page`, `spaceId`, `folderId`
- no preview-building logic exists in this branch
- `includePreviews`, `previewPageLimit`, and `previewCharLimit` are ignored here

Assessment:

- confirmed ignored parameters
- contract is broader than implementation

### `doc_search`

Manifest:

- `expandPages` default `false`

Runtime:

- [server.py](../server.py#L1461) executes a plain workspace doc search and returns docs
- `expandPages` is never read

Assessment:

- confirmed ignored parameter

### `doc_search_bulk`

Manifest:

- `expandPages` default `false`

Runtime:

- [server.py](../server.py#L1465) loops through queries and returns raw search payloads
- `expandPages` is never read

Assessment:

- confirmed ignored parameter

### `task_time_entry_list`

Manifest:

- `pageSize` default `20`

Runtime:

- [server.py](../server.py#L1493) simply calls `task/{taskId}/time`
- `pageSize` is not forwarded or applied

Assessment:

- confirmed ignored parameter

### `time_entry_list`

Manifest:

- accepts `taskId`
- `page` default `0`
- `pageSize` default `20`

Runtime:

- [server.py](../server.py#L1498) only forwards `from`, `to`, and `page`
- `taskId` is ignored
- `pageSize` is ignored

Assessment:

- confirmed ignored parameters

### `time_report_for_context`

Manifest:

- advertises a rich context filter surface: `workspaceId`, `spaceId`, `listId`, `taskId`, `viewId`, `filterQuery`, `status`, `statuses`, `tagIds`, paging controls, and sampling controls

Runtime:

- there is no dedicated `if name == "time_report_for_context"` block
- [server.py](../server.py#L1502) falls through to:
  - call `time_entry_list`
  - total the returned durations
  - return `entries`, `entryCount`, and `totalDurationMs`

Assessment:

- confirmed semantic drift
- the implemented behavior is much narrower than the tool contract suggests

### `time_report_for_container`

Manifest:

- advertises container-scoped aggregation by `containerType` and `containerId`

Runtime:

- handled by the same fallthrough branch as `time_report_for_context`
- no dedicated container scoping logic is present in the time block

Assessment:

- confirmed semantic drift

### `time_report_for_tag`

Manifest:

- advertises tag-scoped aggregation

Runtime:

- also handled by the same fallthrough branch at [server.py](../server.py#L1502)
- no tag filter is applied in the time-entry request path

Assessment:

- confirmed semantic drift

### `time_report_for_space_tag`

Manifest:

- advertises space-and-tag-scoped aggregation

Runtime:

- also handled by the generic fallthrough branch
- no dedicated space-tag logic exists in the time section

Assessment:

- confirmed semantic drift

### `task_list_for_list`

Manifest defaults:

- `limit=20`
- `page=0`
- `includeClosed=false`
- `includeSubtasks=true`
- `includeTasksInMultipleLists=true`
- `assigneePreviewLimit=5`

Runtime:

- [server.py](../server.py#L1390) only forwards `page`, `subtasks`, and `include_timl`
- `includeClosed` is ignored
- `assigneePreviewLimit` is ignored
- default `limit=20` is not enforced; runtime defaults to `len(tasks)` or `100`

Assessment:

- confirmed ignored parameters
- confirmed default drift on `limit`

### `task_read`

Manifest:

- accepts `detailLimit`

Runtime:

- [server.py](../server.py#L1387) resolves the task ID and returns the raw task payload
- `detailLimit` is never used

Assessment:

- confirmed ignored parameter

## Lower-Confidence Drift Candidates

These look suspicious from static reading, but need either runtime verification or deeper tracing before calling them confirmed defects.

### `workspace_hierarchy`

Manifest advertises:

- `workspaceIds`
- `workspaceNames`
- `workspaces`
- `maxDepth`
- `maxWorkspaces`
- `concurrency`
- `forceRefresh`

Runtime:

- [server.py](../server.py#L1168) only uses a single resolved workspace ID and local max-per-container slicing

Assessment:

- highly likely drift
- worth validating separately because the contract implies multi-workspace behavior

### `list_view_create` / `space_view_create` / `view_update`

Manifest advertises `statuses`, `tags`, and in one case `filters_remove`.

Runtime:

- [server.py](../server.py#L1257)
- [server.py](../server.py#L1260)
- [server.py](../server.py#L1263)

These branches only forward `name`, `type`, `description`, and `filters`.

Assessment:

- likely ignored parameters
- needs API-shape confirmation before final judgment

## What Is Not Drift

Some earlier naive text scans overstated drift because certain tools pass `args` through helper functions.

Examples:

- `task_search` uses `_search_params(...)`, so `query`, `listIds`, `tagIds`, `status`, `statuses`, `includeSubtasks`, and `includeTasksInMultipleLists` are part of the effective behavior
- `task_status_report` and `task_risk_report` use helper functions that consume several declared filters

So the main issue is not “everything is broken.” The issue is that specific tool contracts are materially ahead of implementation.

## Practical Conclusion

The manifest is currently best treated as:

- structurally valid
- useful as an intent catalogue
- not yet a trustworthy behavioral specification

Before this repo is presented as a first-class public integration, the contract should be tightened around:

- docs tool defaults and preview semantics
- time reporting scope and filter behavior
- list/task listing defaults
- multi-workspace hierarchy semantics
