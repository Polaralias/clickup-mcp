# Technical Implementation: Views, Lists, and Dashboards Configuration

This document outlines the technical plan for extending the ClickUp MCP server to support comprehensive configuration of Views (with advanced filtering), Lists (including templates), and Dashboards.

## 1. Overview

The goal is to enable AI agents to:
1.  Create and configure **Dashboards** (within API limits).
2.  Create **Lists** of all types, including from templates.
3.  Apply **Advanced Filtering** to views (assignees, dates, custom fields, etc.).

## 2. Dashboards Configuration

### 2.1 API Capabilities and Limitations

*   **Standalone Dashboards:** The ClickUp Public API (v2) does **not** currently expose endpoints to create or configure top-level Dashboards (`/dashboard` endpoints are missing from the public reference).
*   **Dashboard Views:** The API supports creating a **Dashboard View** on a Space, Folder, or List. This allows embedding dashboard-like functionality within the hierarchy.
*   **Cards:** There is **no public API support** for programmatically creating or configuring specific Dashboard Cards (e.g., "Calculation", "Text Block", "Chat"). Cards must be configured via the ClickUp UI.

### 2.2 Implementation Strategy

Since we cannot create top-level Dashboards or configure Cards programmatically, we will focus on enabling **Dashboard Views**.

*   **Tool:** Enhance `clickup_create_space_view` and `clickup_create_list_view` (and potentially a new `clickup_create_folder_view`) to explicitly support `viewType: "dashboard"`.
*   **Documentation:** The tool description must clarify that while a Dashboard View can be created, its content (Cards) must be set up manually or via templates.

## 3. List Configuration

### 3.1 Supported List Types

The server currently supports creating empty lists in Spaces and Folders. We will extend this to support **List Templates**, which is the primary way to create pre-configured lists (including Sprint setups, specific statuses, and custom fields).

### 3.2 New Tool: `clickup_create_list_from_template`

*   **Purpose:** Create a new list based on an existing template.
*   **API Endpoint:** `POST /space/{space_id}/list/template/{template_id}` or `POST /folder/{folder_id}/list/template/{template_id}`.
*   **Inputs:**
    *   `templateId` (Required): The ID of the template to use.
    *   `spaceId` (Optional): Target Space ID.
    *   `folderId` (Optional): Target Folder ID.
    *   `name` (Optional): Name for the new list.
*   **Logic:**
    *   Requires a `templateId`.
    *   Must specify either `spaceId` or `folderId` as the destination.

### 3.3 Enhancing `clickup_create_list`

Ensure the existing tool supports all available configuration options during creation:
*   `priority`: Default priority level.
*   `assignee`: Default assignee.
*   `status`: Default status (if applicable).
*   `dueDate`: Default due date.

## 4. Advanced Filtering for Views

The current implementation only supports `statuses` and `tags` as simple arrays. The ClickUp API supports a complex `filters` object for Views, enabling logic like `(Assignee IS Me AND Due Date IS Today) OR (Tag IS 'Urgent')`.

### 4.1 Filter Object Structure

The `filters` payload in `POST /view` and `PUT /view` accepts a JSON structure:

```json
{
  "filters": {
    "op": "AND", // or "OR"
    "fields": [
      {
        "field": "status",
        "op": "EQ",
        "values": ["to do", "in progress"]
      },
      {
        "field": "assignee",
        "op": "ANY",
        "values": ["12345"] // or ["me"]
      },
      {
        "field": "dueDate",
        "op": "EQ",
        "values": [{ "op": "today" }]
      }
    ],
    "search": "string query",
    "show_closed": false
  }
}
```

### 4.2 Schema Definition (Zod)

We will define a reusable `ViewFilter` schema in `src/mcp/schemas/structure.ts`.

```typescript
const FilterOperator = z.enum(["AND", "OR"]);
const FieldOperator = z.enum(["EQ", "NOT", "GT", "LT", "GTE", "LTE", "ANY", "ALL", "NOT ANY", "NOT ALL"]);

const FilterValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()), // For tags, statuses
  z.object({ op: z.string(), value: z.unknown().optional() }) // For dynamic dates like { op: "today" }
]);

const FilterField = z.object({
  field: z.string().describe("Field name (e.g. status, assignee, priority, dueDate, cf_{id})."),
  op: FieldOperator,
  values: z.array(FilterValue),
});

const ViewFilters = z.object({
  op: FilterOperator.default("AND"),
  fields: z.array(FilterField),
  search: z.string().optional(),
  show_closed: z.boolean().optional()
});
```

### 4.3 Tool Updates

1.  **`clickup_create_list_view` / `clickup_create_space_view`:**
    *   Add `filters: ViewFilters.optional()` to the input schema.
    *   Deprecate (but support backward compatibility for) `statuses` and `tags` by mapping them into the `filters` structure if `filters` is not provided.

2.  **`clickup_update_view`:**
    *   Add `filters: ViewFilters.optional()`.
    *   Add `filters_remove: z.boolean().optional()` to allow clearing filters.

## 5. Implementation Plan

### Step 1: Schema Definitions
*   Modify `src/mcp/schemas/structure.ts` to include the `ViewFilters` schema.
*   Update `CreateListViewInput`, `CreateSpaceViewInput`, and `UpdateViewInput` to include the `filters` field.

### Step 2: Infrastructure Updates
*   Verify `src/infrastructure/clickup/ClickUpClient.ts` passes the body correctly in `createListView`, `createSpaceView`, and `updateView`. (It currently accepts `Record<string, unknown>`, so no change needed unless type safety is enforced).
*   Add `createListFromTemplate` method to `ClickUpClient`.

### Step 3: Application Logic (Use Cases)
*   **`src/application/usecases/hierarchy/CreateListView.ts` & `CreateSpaceView.ts`**:
    *   Construct the payload.
    *   If legacy `tags` or `statuses` are provided *and* `filters` is missing, construct the `filters` object to maintain backward compatibility.
    *   Example mapping:
        ```typescript
        if (!input.filters && (input.tags || input.statuses)) {
           const fields = [];
           if (input.tags) fields.push({ field: "tag", op: "ANY", values: input.tags });
           if (input.statuses) fields.push({ field: "status", op: "EQ", values: input.statuses.map(s => s.status || s.name) });
           payload.filters = { op: "AND", fields };
        }
        ```
*   **`src/application/usecases/hierarchy/UpdateView.ts`**:
    *   Similar mapping logic.
*   **Create `src/application/usecases/hierarchy/CreateListFromTemplate.ts`**:
    *   Implement the use case to call the new client method.

### Step 4: Tool Registration
*   Register `clickup_create_list_from_template` in `src/mcp/registerTools.ts`.
*   Update descriptions of view tools to mention advanced filtering capabilities.

## 6. Verification
*   **Unit Tests:**
    *   Test filter construction logic (legacy vs new).
    *   Test `createListFromTemplate` validation.
*   **Manual/Integration Verification:**
    *   Create a view with complex filters (e.g., "Due Today AND High Priority") and verify in ClickUp UI.
    *   Create a list from a known template and verify structure.
