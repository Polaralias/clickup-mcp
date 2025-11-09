import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { ClickUpClient } from "../infrastructure/clickup/ClickUpClient.js"
import { readOnlyAnnotation, destructiveAnnotation } from "./annotations.js"
import {
  CreateTaskInput,
  UpdateTaskInput,
  DeleteTaskInput,
  MoveTaskInput,
  DuplicateTaskInput,
  CommentTaskInput,
  AttachFileInput,
  AddTagsInput,
  RemoveTagsInput,
  CreateTasksBulkInput,
  UpdateTasksBulkInput,
  MoveTasksBulkInput,
  DeleteTasksBulkInput,
  AddTagsBulkInput,
  GetTaskInput,
  ListTasksInListInput,
  GetTaskCommentsInput,
  SearchTasksInput,
  FuzzySearchInput,
  BulkFuzzySearchInput,
  CreateDocInput,
  ListDocPagesInput,
  GetDocPageInput,
  UpdateDocPageInput,
  DocSearchInput,
  BulkDocSearchInput,
  StartTimerInput,
  StopTimerInput,
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  DeleteTimeEntryInput,
  ListTimeEntriesInput,
  ReportTimeForTagInput,
  ReportTimeForContainerInput,
  ReportTimeForSpaceTagInput,
  ListSpacesInput,
  ListFoldersInput,
  ListListsInput,
  ListTagsForSpaceInput,
  ListMembersInput,
  ResolveMembersInput,
  ResolvePathToIdsInput,
  GetWorkspaceOverviewInput,
  GetWorkspaceHierarchyInput,
  ListReferenceLinksInput,
  FetchReferencePageInput
} from "./schemas/index.js"
import { withSafetyConfirmation } from "../application/safety/withSafetyConfirmation.js"
import { createTask } from "../application/usecases/tasks/CreateTask.js"
import { updateTask } from "../application/usecases/tasks/UpdateTask.js"
import { deleteTask } from "../application/usecases/tasks/DeleteTask.js"
import { moveTask } from "../application/usecases/tasks/MoveTask.js"
import { duplicateTask } from "../application/usecases/tasks/DuplicateTask.js"
import { commentTask } from "../application/usecases/tasks/CommentTask.js"
import { attachFileToTask } from "../application/usecases/tasks/AttachFileToTask.js"
import { addTagsToTask } from "../application/usecases/tasks/AddTagsToTask.js"
import { removeTagsFromTask } from "../application/usecases/tasks/RemoveTagsFromTask.js"
import { createTasksBulk } from "../application/usecases/tasks/CreateTasksBulk.js"
import { updateTasksBulk } from "../application/usecases/tasks/UpdateTasksBulk.js"
import { moveTasksBulk } from "../application/usecases/tasks/MoveTasksBulk.js"
import { deleteTasksBulk } from "../application/usecases/tasks/DeleteTasksBulk.js"
import { addTagsBulk } from "../application/usecases/tasks/AddTagsBulk.js"
import { getTask } from "../application/usecases/tasks/GetTask.js"
import { listTasksInList } from "../application/usecases/tasks/ListTasksInList.js"
import { getTaskComments } from "../application/usecases/tasks/GetTaskComments.js"
import { searchTasks } from "../application/usecases/tasks/SearchTasks.js"
import { fuzzySearch } from "../application/usecases/tasks/FuzzySearch.js"
import { bulkFuzzySearch } from "../application/usecases/tasks/BulkFuzzySearch.js"
import { createDoc } from "../application/usecases/docs/CreateDoc.js"
import { listDocPages } from "../application/usecases/docs/ListDocPages.js"
import { getDocPage } from "../application/usecases/docs/GetDocPage.js"
import { updateDocPage } from "../application/usecases/docs/UpdateDocPage.js"
import { docSearch } from "../application/usecases/docs/DocSearch.js"
import { bulkDocSearch } from "../application/usecases/docs/BulkDocSearch.js"
import { startTimer } from "../application/usecases/time/StartTimer.js"
import { stopTimer } from "../application/usecases/time/StopTimer.js"
import { createTimeEntry } from "../application/usecases/time/CreateTimeEntry.js"
import { updateTimeEntry } from "../application/usecases/time/UpdateTimeEntry.js"
import { deleteTimeEntry } from "../application/usecases/time/DeleteTimeEntry.js"
import { listTimeEntries } from "../application/usecases/time/ListTimeEntries.js"
import { reportTimeForTag } from "../application/usecases/time/ReportTimeForTag.js"
import { reportTimeForContainer } from "../application/usecases/time/ReportTimeForContainer.js"
import { reportTimeForSpaceTag } from "../application/usecases/time/ReportTimeForSpaceTag.js"
import { listReferenceLinks } from "../application/usecases/reference/ListReferenceLinks.js"
import { fetchReferencePage } from "../application/usecases/reference/FetchReferencePage.js"
import { listWorkspaces } from "../application/usecases/hierarchy/ListWorkspaces.js"
import { listSpaces } from "../application/usecases/hierarchy/ListSpaces.js"
import { listFolders } from "../application/usecases/hierarchy/ListFolders.js"
import { listLists } from "../application/usecases/hierarchy/ListLists.js"
import { listTagsForSpace } from "../application/usecases/hierarchy/ListTagsForSpace.js"
import { listMembers } from "../application/usecases/hierarchy/ListMembers.js"
import { resolveMembers } from "../application/usecases/hierarchy/ResolveMembers.js"
import { resolvePathToIds } from "../application/usecases/hierarchy/ResolvePathToIds.js"
import { getWorkspaceOverview } from "../application/usecases/hierarchy/GetWorkspaceOverview.js"
import { getWorkspaceHierarchy } from "../application/usecases/hierarchy/GetWorkspaceHierarchy.js"
import { ping } from "../application/usecases/system/Ping.js"
import { health } from "../application/usecases/system/Health.js"
import { toolCatalogue, type ToolCatalogueEntry } from "../application/usecases/system/ToolCatalogue.js"

const { ZodFirstPartyTypeKind } = z

type ToolHandler = (input: any, client: ClickUpClient, config: ApplicationConfig) => Promise<unknown>

type RegistrationOptions = {
  schema: z.ZodTypeAny | null
  description: string
  annotations?: Record<string, unknown>
  handler: ToolHandler
}

function getInputShape(schema: z.ZodTypeAny | null) {
  if (!schema) return undefined
  if (schema._def.typeName === ZodFirstPartyTypeKind.ZodObject) {
    return (schema as z.ZodObject<any>).shape
  }
  return undefined
}

function formatContent(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  }
}

function resolveToken() {
  const token = process.env.CLICKUP_API_TOKEN ?? process.env.clickupApiToken ?? ""
  if (!token) {
    throw new Error("CLICKUP_API_TOKEN is required")
  }
  return token
}

export function registerTools(server: McpServer, config: ApplicationConfig) {
  const entries: ToolCatalogueEntry[] = []

  function registerClientTool(name: string, options: RegistrationOptions) {
    const shape = getInputShape(options.schema)
    entries.push({ name, description: options.description, annotations: options.annotations })
    server.registerTool(
      name,
      {
        description: options.description,
        inputSchema: shape,
        annotations: options.annotations
      },
      async (rawInput: unknown) => {
        const client = new ClickUpClient(resolveToken())
        const parsed = options.schema ? options.schema.parse(rawInput ?? {}) : {}
        const result = await options.handler(parsed, client, config)
        return formatContent(result)
      }
    )
  }

  // System tools (no client)
  entries.push({ name: "ping", description: "Responds with the provided message." })
  server.registerTool(
    "ping",
    {
      description: "Responds with the provided message.",
      inputSchema: z.object({ message: z.string().optional() }).shape
    },
    async (rawInput: unknown) => {
      const parsed = z.object({ message: z.string().optional() }).parse(rawInput ?? {})
      return formatContent(await ping(parsed.message))
    }
  )

  entries.push({ name: "health", description: "Returns server status and limits.", annotations: readOnlyAnnotation.annotations })
  server.registerTool(
    "health",
    {
      description: "Returns server status and limits.",
      ...readOnlyAnnotation
    },
    async () => formatContent(await health(config))
  )

  entries.push({ name: "tool_catalogue", description: "Lists available tools.", annotations: readOnlyAnnotation.annotations })
  server.registerTool(
    "tool_catalogue",
    {
      description: "Lists available tools.",
      ...readOnlyAnnotation
    },
    async () => formatContent(await toolCatalogue(entries))
  )

  const registerDestructive = (name: string, description: string, schema: z.ZodTypeAny, handler: ToolHandler) => {
    entries.push({ name, description, annotations: destructiveAnnotation.annotations })
    server.registerTool(
      name,
      {
        description,
        inputSchema: getInputShape(schema),
        ...destructiveAnnotation
      },
      withSafetyConfirmation(async (rawInput: unknown) => {
        const client = new ClickUpClient(resolveToken())
        const parsed = schema.parse(rawInput ?? {})
        const result = await handler(parsed, client, config)
        return formatContent(result)
      })
    )
  }

  const registerReadOnly = (name: string, description: string, schema: z.ZodTypeAny | null, handler: ToolHandler) => {
    registerClientTool(name, {
      description,
      schema,
      annotations: readOnlyAnnotation.annotations,
      handler
    })
  }

  // Hierarchy tools
  registerReadOnly("clickup_list_workspaces", "List workspaces accessible to the token.", null, async (_input, client) => listWorkspaces(client))
  registerReadOnly("clickup_list_spaces", "List spaces within a workspace.", ListSpacesInput, listSpaces)
  registerReadOnly("clickup_list_folders", "List folders within a space.", ListFoldersInput, listFolders)
  registerReadOnly("clickup_list_lists", "List lists for a space or folder.", ListListsInput, async (input, client) => {
    if (!input.spaceId && !input.folderId) {
      throw new Error("Provide spaceId or folderId")
    }
    return listLists(input, client)
  })
  registerReadOnly("clickup_get_workspace_overview", "Fetch workspace overview.", GetWorkspaceOverviewInput, getWorkspaceOverview)
  registerReadOnly(
    "clickup_get_workspace_hierarchy",
    "Fetch nested spaces, folders and lists with depth and limit controls.",
    GetWorkspaceHierarchyInput,
    (input, client, config) => getWorkspaceHierarchy(input, client, config)
  )
  registerReadOnly("clickup_resolve_path_to_ids", "Resolve workspace path elements to IDs.", ResolvePathToIdsInput, resolvePathToIds)
  registerReadOnly("clickup_list_members", "List members in a workspace.", ListMembersInput, listMembers)
  registerReadOnly("clickup_resolve_members", "Resolve identifiers to ClickUp members.", ResolveMembersInput, resolveMembers)
  registerReadOnly("clickup_list_tags_for_space", "List tags configured for a space.", ListTagsForSpaceInput, listTagsForSpace)

  // Reference
  registerReadOnly(
    "clickup_list_reference_links",
    "List ClickUp API reference sidebar links (public reference material, no workspace data).",
    ListReferenceLinksInput,
    async (input) => listReferenceLinks(input)
  )
  registerReadOnly(
    "clickup_fetch_reference_page",
    "Fetch a ClickUp API reference page for summarisation (public reference material, no workspace data).",
    FetchReferencePageInput,
    async (input, _client, config) => fetchReferencePage(input, config)
  )

  // Task tools
  registerDestructive("clickup_create_task", "Create a task in ClickUp.", CreateTaskInput, createTask)
  registerDestructive(
    "clickup_create_tasks_bulk",
    "Create multiple tasks with shared defaults and dry-run previews.",
    CreateTasksBulkInput,
    createTasksBulk
  )
  registerDestructive("clickup_update_task", "Update an existing task.", UpdateTaskInput, updateTask)
  registerDestructive(
    "clickup_update_tasks_bulk",
    "Update multiple tasks in parallel with concurrency safeguards.",
    UpdateTasksBulkInput,
    updateTasksBulk
  )
  registerDestructive("clickup_delete_task", "Delete a task.", DeleteTaskInput, deleteTask)
  registerDestructive(
    "clickup_delete_tasks_bulk",
    "Delete multiple tasks with confirmation and optional dry run.",
    DeleteTasksBulkInput,
    deleteTasksBulk
  )
  registerDestructive("clickup_move_task", "Move a task to a different list.", MoveTaskInput, moveTask)
  registerDestructive(
    "clickup_move_tasks_bulk",
    "Move multiple tasks to new lists.",
    MoveTasksBulkInput,
    moveTasksBulk
  )
  registerDestructive("clickup_duplicate_task", "Duplicate a task.", DuplicateTaskInput, duplicateTask)
  registerDestructive("clickup_comment_task", "Add a comment to a task.", CommentTaskInput, commentTask)
  registerDestructive("clickup_attach_file_to_task", "Attach a file to a task.", AttachFileInput, attachFileToTask)
  registerDestructive("clickup_add_tags_to_task", "Add tags to a task.", AddTagsInput, addTagsToTask)
  registerDestructive(
    "clickup_add_tags_bulk",
    "Add tags across multiple tasks with shared defaults.",
    AddTagsBulkInput,
    addTagsBulk
  )
  registerDestructive("clickup_remove_tags_from_task", "Remove tags from a task.", RemoveTagsInput, removeTagsFromTask)

  registerReadOnly("clickup_search_tasks", "Structured task search.", SearchTasksInput, async (input, client, config) => {
    const result = await searchTasks(input, client, config)
    return { tasks: result.results, truncated: result.truncated }
  })
  registerReadOnly("clickup_fuzzy_search", "Fuzzy search tasks.", FuzzySearchInput, async (input, client, config) => {
    const result = await fuzzySearch(input, client, config)
    return { tasks: result.results, guidance: result.guidance }
  })
  registerReadOnly("clickup_bulk_fuzzy_search", "Bulk fuzzy search for tasks.", BulkFuzzySearchInput, async (input, client, config) => {
    const result = await bulkFuzzySearch(input, client, config)
    return { queries: result }
  })

  registerReadOnly("clickup_get_task", "Fetch task details with context-aware truncation.", GetTaskInput, getTask)
  registerReadOnly(
    "clickup_list_tasks_in_list",
    "List tasks inside a ClickUp list with optional pagination and filters.",
    ListTasksInListInput,
    listTasksInList
  )
  registerReadOnly(
    "clickup_get_task_comments",
    "Retrieve recent comments for a task, keeping responses token-friendly.",
    GetTaskCommentsInput,
    getTaskComments
  )

  // Docs
  registerDestructive("clickup_create_doc", "Create a doc in ClickUp.", CreateDocInput, createDoc)
  registerReadOnly("clickup_list_doc_pages", "List doc pages.", ListDocPagesInput, listDocPages)
  registerReadOnly("clickup_get_doc_page", "Get a doc page.", GetDocPageInput, getDocPage)
  registerDestructive("clickup_update_doc_page", "Update a doc page.", UpdateDocPageInput, updateDocPage)
  registerReadOnly("clickup_doc_search", "Search docs by keyword.", DocSearchInput, async (input, client, config) => {
    const result = await docSearch(input, client, config)
    return { docs: result.docs, expandedPages: result.expandedPages, guidance: result.guidance }
  })
  registerReadOnly("clickup_bulk_doc_search", "Bulk doc search.", BulkDocSearchInput, async (input, client, config) => {
    const result = await bulkDocSearch(input, client, config)
    return { queries: result }
  })

  // Time tracking
  registerDestructive("clickup_start_timer", "Start a task timer.", StartTimerInput, startTimer)
  registerDestructive("clickup_stop_timer", "Stop a task timer.", StopTimerInput, stopTimer)
  registerDestructive("clickup_create_time_entry", "Create a manual time entry.", CreateTimeEntryInput, createTimeEntry)
  registerDestructive("clickup_update_time_entry", "Update a time entry.", UpdateTimeEntryInput, updateTimeEntry)
  registerDestructive("clickup_delete_time_entry", "Delete a time entry.", DeleteTimeEntryInput, deleteTimeEntry)

  registerReadOnly("clickup_list_time_entries", "List time entries.", ListTimeEntriesInput, async (input, client, config) => {
    const result = await listTimeEntries(input, client, config)
    return { entries: result.entries, truncated: result.truncated }
  })
  registerReadOnly("clickup_report_time_for_tag", "Report time by tag.", ReportTimeForTagInput, reportTimeForTag)
  registerReadOnly("clickup_report_time_for_container", "Report time by container.", ReportTimeForContainerInput, reportTimeForContainer)
  registerReadOnly("clickup_report_time_for_space_tag", "Report time for a tag within a space.", ReportTimeForSpaceTagInput, reportTimeForSpaceTag)
}
