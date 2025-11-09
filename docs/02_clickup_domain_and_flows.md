# ClickUp Domain Reference and Key Flows for the LLM

This document gives a compact mental model of ClickUp and the main flows the MCP server should support. It is meant to guide design choices when rebuilding or extending the server.

## 1. Core ClickUp concepts

### 1.1 Hierarchy

ClickUp has a nested hierarchy. For this server, the important levels are:

- **Workspace (team)**  
  Top level container. A user can belong to multiple workspaces.

- **Space**  
  The primary subdivision under a workspace. Often used for teams, products or functions.

- **Folder**  
  Optional grouping inside a space. Some spaces may not use folders.

- **List**  
  Concrete container for tasks. Tasks always live in a list.

- **Task**  
  The core unit of work. Tasks can have:
  - Title, description, status, priority, due dates
  - Assignees, watchers, tags
  - Comments, attachments
  - Time entries

- **Subtasks**  
  Tasks can have subtasks. The server should be aware of this, but does not need to expose all subtask features if they are not required by the tool set.

### 1.2 Docs

ClickUp docs behave somewhat like pages in a wiki. For the MCP server we care about:

- Doc containers (often associated with a workspace or space)
- Pages inside a doc
- Page content as rich text or markdown like blocks

The server deals with docs at two levels:

- A summary view for search and listing
- A detailed view for selected pages within token limits

### 1.3 Tags

Tags are labels that can apply across lists and spaces. They are central for:

- Grouping related work (projects, clients, epics)
- Filtering tasks and time entries
- Building reports

The server should treat tags as important first class filters, especially for reporting tools.

### 1.4 Time tracking

Time tracking in ClickUp is associated with tasks and users. The relevant concepts are:

- Time entries (start, end, duration, user, task, notes)
- Running timers
- Reporting aggregations over date ranges, tags and containers

## 2. Key flows to support

The server’s tools and behaviours should make these flows easy and efficient for an AI agent.

### 2.1 Hierarchy discovery and navigation

Tools should allow an agent to:

- List workspaces the token can access
- For a workspace, list spaces
- For a space, list folders and lists
- Resolve a human readable path to concrete IDs

Example expectations:

- Given a path like “Workspace: ACME, Space: Engineering, List: Backend”, the server should provide tools that resolve these labels to IDs for use in other tools.
- Tools should help the agent avoid guessing IDs and instead follow a resolve-then-act pattern.

### 2.2 Task lifecycle

The server should expose a coherent set of task tools, including at least:

- Create task in a given list
- Update a task’s core fields
- Add comments and attachments
- Move or duplicate a task
- Add and remove tags
- Delete a task with strong safety requirements

Behavioural expectations:

- Writes and deletions are explicit and require confirmation.
- Tools return enough structured data (IDs, key fields, links) for follow up actions.
- Latent interactions such as automatic notifications are left to ClickUp; the server does not attempt to simulate them.

### 2.3 Task search and discovery

There are two complementary styles of task lookup.

#### 2.3.1 Structured search

Uses filters like:

- list or space
- status
- assignee
- tag
- date ranges (created, updated, due)

Structured search should be predictable and stable. Results are typically paginated and are suitable for reporting or batch operations.

#### 2.3.2 Fuzzy search

Uses natural language queries over task titles and relevant fields. The server should:

- Use a simple fuzzy index (for example based on task titles, IDs and key metadata)
- Rank results by a combination of fuzzy score and recency
- Offer both single query and bulk query variants

Example usage:

- Disambiguate “the database migration ticket”
- Look up a task when the user only remembers fragments of its title
- Map a set of human labels to concrete task IDs before making changes

Fuzzy search is read only. It should never perform destructive actions directly.

### 2.4 Docs search and editing

Docs should be handled in a way that makes sense for agents:

- Search returns a ranked list of docs or pages with:
  - Title
  - Location (workspace, space, list if applicable)
  - Short snippet or preview
- Optional page expansion:
  - For the top N results, the server can fetch full page content
  - Expansion is subject to concurrency and token limits

Editing tools should allow:

- Creating a new doc in an appropriate container
- Listing pages within a doc
- Fetching a specific page
- Updating page content with clear awareness that updates are destructive

An agent should be encouraged to:

1. Search and inspect
2. Decide what to edit
3. Use dedicated update tools with explicit intent

### 2.5 Time tracking and reporting

The server should make it easy for an agent to:

- Start and stop timers for tasks
- Create, update and delete explicit time entries
- List time entries for a task, user or time period
- Aggregate time by:
  - Tag
  - Container (list, folder, space)
  - Workspace

Workspace-level tools (listing entries, pulling the current running timer, aggregated reports) rely on a team/workspace ID and
default to the configured `teamId` when one is not supplied. When the goal is to inspect a single task in detail, agents
should prefer the task-scoped time entry helper to avoid unnecessary aggregation and reduce the chance of truncation.

Reporting tools should:

- Accept filters such as date ranges, tags and user IDs
- Return structured totals and breakdowns for further processing or summarisation

Safety expectations:

- Starting and stopping timers and deleting time entries are treated as potentially sensitive and use the same confirmation pattern as other destructive actions.

## 3. Data and token handling expectations

- Large result sets should be paginated and truncated, not returned in full.
- Tools should provide clear flags when data is truncated so the agent can request more detail.
- Attachments are handled by data URI or metadata, subject to size limits.
- For docs and long descriptions, the server should respect global character limits and avoid flooding the agent with irrelevant content.

## 4. Error handling expectations

From the agent’s perspective:

- Errors should be structured and explain what went wrong in plain language.
- Rate limit or temporary errors should be distinguishable from permanent errors such as “resource not found” or “permission denied”.
- Destructive tools should clearly indicate when an operation was not performed because confirmation was missing or because a dry run was requested.

This domain understanding should underpin all tool design and help the LLM choose sensible behaviours when details are not explicitly specified elsewhere.
