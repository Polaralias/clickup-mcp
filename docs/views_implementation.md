# Views Implementation Plan

This document details the enhancement of view creation and update tools for the ClickUp MCP server to support tag filtering.

## Overview

We are enhancing the existing tools `list_view_create`, `space_view_create`, and `view_update` to support tag filters.

## Enhanced Tools

### 1. `list_view_create` & `space_view_create`

**Enhanced Input Schema:**
- `tags`: string[] (optional) - Array of tag names to filter by.
- Existing fields (`name`, `description`, `viewType`, `statuses`) remain unchanged.

**Logic:**
- Accept `tags` in the input.
- Construct the `filters` object payload using `buildViewFilters`.
- If `tags` are present, map them to:
  ```json
  { "field": "tag", "op": "ANY", "values": ["tag1", "tag2"] }
  ```
- If `statuses` are present, they are also included in the `filters` object.

### 2. `view_update`

**Enhanced Input Schema:**
- `tags`: string[] (optional) - Array of tag names to filter by.

**Logic:**
- Similar to creation, use `buildViewFilters` to construct the payload.

## Shared Logic (`buildViewFilters`)

Located in `src/application/usecases/hierarchy/structureShared.ts`.

It takes `statuses` and `tags` and produces the ClickUp API `filters` object.

```typescript
function buildViewFilters(statuses?: string[], tags?: string[]) {
  // If only statuses: return legacy { statuses } format.
  // If tags are present: return new complex format { op: "AND", fields: [...] }
}
```

## Implementation Files

1.  `src/mcp/schemas/structure.ts`: Update Zod schemas.
2.  `src/application/usecases/hierarchy/structureShared.ts`: Add helper function.
3.  `src/application/usecases/hierarchy/CreateListView.ts`: Update logic.
4.  `src/application/usecases/hierarchy/CreateSpaceView.ts`: Update logic.
5.  `src/application/usecases/hierarchy/UpdateView.ts`: Update logic.
