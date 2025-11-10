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
  ListDocumentsInput,
  GetDocumentInput,
  GetDocumentPagesInput,
  CreateDocumentPageInput,
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
  GetTaskTimeEntriesInput,
  GetCurrentTimeEntryInput,
  ListWorkspacesInput,
  ListSpacesInput,
  ListFoldersInput,
  ListListsInput,
  ListTagsForSpaceInput,
  CreateSpaceTagInput,
  UpdateSpaceTagInput,
  DeleteSpaceTagInput,
  ListMembersInput,
  ResolveMembersInput,
  FindMemberByNameInput,
  ResolveAssigneesInput,
  ResolvePathToIdsInput,
  GetWorkspaceOverviewInput,
  GetWorkspaceHierarchyInput,
  ListReferenceLinksInput,
  FetchReferencePageInput,
  CreateFolderInput,
  UpdateFolderInput,
  DeleteFolderInput,
  CreateListInput,
  UpdateListInput,
  DeleteListInput,
  CreateListViewInput,
  CreateSpaceViewInput,
  UpdateViewInput,
  DeleteViewInput
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
import { listDocuments } from "../application/usecases/docs/ListDocuments.js"
import { getDocument } from "../application/usecases/docs/GetDocument.js"
import { getDocumentPages } from "../application/usecases/docs/GetDocumentPages.js"
import { listDocPages } from "../application/usecases/docs/ListDocPages.js"
import { getDocPage } from "../application/usecases/docs/GetDocPage.js"
import { updateDocPage } from "../application/usecases/docs/UpdateDocPage.js"
import { docSearch } from "../application/usecases/docs/DocSearch.js"
import { bulkDocSearch } from "../application/usecases/docs/BulkDocSearch.js"
import { createDocumentPage } from "../application/usecases/docs/CreateDocumentPage.js"
import { startTimer } from "../application/usecases/time/StartTimer.js"
import { stopTimer } from "../application/usecases/time/StopTimer.js"
import { createTimeEntry } from "../application/usecases/time/CreateTimeEntry.js"
import { updateTimeEntry } from "../application/usecases/time/UpdateTimeEntry.js"
import { deleteTimeEntry } from "../application/usecases/time/DeleteTimeEntry.js"
import { listTimeEntries } from "../application/usecases/time/ListTimeEntries.js"
import { reportTimeForTag } from "../application/usecases/time/ReportTimeForTag.js"
import { reportTimeForContainer } from "../application/usecases/time/ReportTimeForContainer.js"
import { reportTimeForSpaceTag } from "../application/usecases/time/ReportTimeForSpaceTag.js"
import { getTaskTimeEntries } from "../application/usecases/time/GetTaskTimeEntries.js"
import { getCurrentTimeEntry } from "../application/usecases/time/GetCurrentTimeEntry.js"
import { listReferenceLinks } from "../application/usecases/reference/ListReferenceLinks.js"
import { fetchReferencePage } from "../application/usecases/reference/FetchReferencePage.js"
import { listWorkspaces } from "../application/usecases/hierarchy/ListWorkspaces.js"
import { listSpaces } from "../application/usecases/hierarchy/ListSpaces.js"
import { listFolders } from "../application/usecases/hierarchy/ListFolders.js"
import { listLists } from "../application/usecases/hierarchy/ListLists.js"
import { listTagsForSpace } from "../application/usecases/hierarchy/ListTagsForSpace.js"
import { createSpaceTag } from "../application/usecases/hierarchy/CreateSpaceTag.js"
import { updateSpaceTag } from "../application/usecases/hierarchy/UpdateSpaceTag.js"
import { deleteSpaceTag } from "../application/usecases/hierarchy/DeleteSpaceTag.js"
import { listMembers } from "../application/usecases/hierarchy/ListMembers.js"
import { resolveMembers } from "../application/usecases/hierarchy/ResolveMembers.js"
import { resolvePathToIds } from "../application/usecases/hierarchy/ResolvePathToIds.js"
import { getWorkspaceOverview } from "../application/usecases/hierarchy/GetWorkspaceOverview.js"
import { getWorkspaceHierarchy } from "../application/usecases/hierarchy/GetWorkspaceHierarchy.js"
import { findMemberByName } from "../application/usecases/members/FindMemberByName.js"
import { resolveAssignees } from "../application/usecases/members/ResolveAssignees.js"
import { HierarchyDirectory } from "../application/services/HierarchyDirectory.js"
import { TaskCatalogue } from "../application/services/TaskCatalogue.js"
import { SpaceTagCache } from "../application/services/SpaceTagCache.js"
import { createFolder } from "../application/usecases/hierarchy/CreateFolder.js"
import { updateFolder } from "../application/usecases/hierarchy/UpdateFolder.js"
import { deleteFolder } from "../application/usecases/hierarchy/DeleteFolder.js"
import { createList } from "../application/usecases/hierarchy/CreateList.js"
import { updateList } from "../application/usecases/hierarchy/UpdateList.js"
import { deleteList } from "../application/usecases/hierarchy/DeleteList.js"
import { createListView } from "../application/usecases/hierarchy/CreateListView.js"
import { createSpaceView } from "../application/usecases/hierarchy/CreateSpaceView.js"
import { updateView } from "../application/usecases/hierarchy/UpdateView.js"
import { deleteView } from "../application/usecases/hierarchy/DeleteView.js"
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

  const createClient = () => new ClickUpClient(resolveToken())
  const sessionHierarchyDirectory = new HierarchyDirectory()
  const sessionTaskCatalogue = new TaskCatalogue()
  const sessionSpaceTagCache = new SpaceTagCache()

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
        const client = createClient()
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
        const client = createClient()
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
  registerReadOnly(
    "clickup_list_workspaces",
    "List workspaces accessible to the token.",
    ListWorkspacesInput.optional(),
    async (input = {}, client) =>
      listWorkspaces(client, sessionHierarchyDirectory, { forceRefresh: input?.forceRefresh })
  )
  registerReadOnly(
    "clickup_list_spaces",
    "List spaces within a workspace.",
    ListSpacesInput,
    (input, client) => listSpaces(input, client, sessionHierarchyDirectory)
  )
  registerReadOnly(
    "clickup_list_folders",
    "List folders within a space.",
    ListFoldersInput,
    (input, client) => listFolders(input, client, sessionHierarchyDirectory)
  )
  registerReadOnly("clickup_list_lists", "List lists for a space or folder.", ListListsInput, async (input, client) => {
    if (!input.spaceId && !input.folderId) {
      throw new Error("Provide spaceId or folderId")
    }
    return listLists(input, client, sessionHierarchyDirectory)
  })
  registerReadOnly(
    "clickup_get_workspace_overview",
    "Fetch workspace overview.",
    GetWorkspaceOverviewInput,
    (input, client) => getWorkspaceOverview(input, client, sessionHierarchyDirectory)
  )
  registerReadOnly(
    "clickup_get_workspace_hierarchy",
    "Fetch nested spaces, folders and lists with depth and limit controls.",
    GetWorkspaceHierarchyInput,
    (input, client, config) => getWorkspaceHierarchy(input, client, config, sessionHierarchyDirectory)
  )
  registerReadOnly(
    "clickup_resolve_path_to_ids",
    "Resolve workspace path elements to IDs.",
    ResolvePathToIdsInput,
    (input, client) => resolvePathToIds(input, client, sessionHierarchyDirectory)
  )
  registerReadOnly("clickup_list_members", "List members in a workspace.", ListMembersInput, listMembers)
  registerReadOnly(
    "clickup_resolve_members",
    "Resolve identifiers to ClickUp members with fuzzy matching and cache visibility.",
    ResolveMembersInput,
    resolveMembers
  )
  registerReadOnly(
    "clickup_find_member_by_name",
    "Search members with fuzzy matching; use refresh=true to bypass the cached directory when data changes.",
    FindMemberByNameInput,
    findMemberByName
  )
  registerReadOnly(
    "clickup_resolve_assignees",
    "Resolve potential task assignees from human-friendly identifiers. Results include scores and cache metadata.",
    ResolveAssigneesInput,
    resolveAssignees
  )
  registerReadOnly(
    "clickup_list_tags_for_space",
    "List tags configured for a space.",
    ListTagsForSpaceInput,
    (input, client) => listTagsForSpace(input, client, sessionSpaceTagCache)
  )

  registerDestructive(
    "clickup_create_space_tag",
    "Create a space-level tag with optional custom colours.",
    CreateSpaceTagInput,
    async (input, client) => createSpaceTag(input, client, sessionSpaceTagCache)
  )
  registerDestructive(
    "clickup_update_space_tag",
    "Update a space-level tag's name or colours.",
    UpdateSpaceTagInput,
    async (input, client) => updateSpaceTag(input, client, sessionSpaceTagCache)
  )
  registerDestructive(
    "clickup_delete_space_tag",
    "Delete a space-level tag.",
    DeleteSpaceTagInput,
    async (input, client) => deleteSpaceTag(input, client, sessionSpaceTagCache)
  )

  // Hierarchy management
  registerDestructive(
    "clickup_create_folder",
    "Create a folder within a space, supporting optional custom statuses and dry-run previews.",
    CreateFolderInput,
    async (input, client) => createFolder(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_update_folder",
    "Update a folder's name, description, or statuses.",
    UpdateFolderInput,
    async (input, client) => updateFolder(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_delete_folder",
    "Delete a folder.",
    DeleteFolderInput,
    async (input, client) => deleteFolder(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_create_list",
    "Create a list within a space or folder with optional status overrides.",
    CreateListInput,
    async (input, client) => createList(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_update_list",
    "Update a list's name, description, or statuses.",
    UpdateListInput,
    async (input, client) => updateList(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_delete_list",
    "Delete a list.",
    DeleteListInput,
    async (input, client) => deleteList(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_create_list_view",
    "Create a view scoped to a list with optional status filters.",
    CreateListViewInput,
    async (input, client) => createListView(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_create_space_view",
    "Create a view scoped to a space with optional status filters.",
    CreateSpaceViewInput,
    async (input, client) => createSpaceView(input, client, sessionHierarchyDirectory)
  )
  registerDestructive(
    "clickup_update_view",
    "Update a view's name, type, description, or filters.",
    UpdateViewInput,
    async (input, client) => updateView(input, client)
  )
  registerDestructive(
    "clickup_delete_view",
    "Delete a view.",
    DeleteViewInput,
    async (input, client) => deleteView(input, client)
  )

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
  registerDestructive(
    "clickup_create_task",
    "Create a task in ClickUp.",
    CreateTaskInput,
    async (input, client) => createTask(input, client, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_create_tasks_bulk",
    "Create multiple tasks with shared defaults and dry-run previews.",
    CreateTasksBulkInput,
    async (input, client, config) => createTasksBulk(input, client, config, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_update_task",
    "Update an existing task.",
    UpdateTaskInput,
    async (input, client) => updateTask(input, client, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_update_tasks_bulk",
    "Update multiple tasks in parallel with concurrency safeguards.",
    UpdateTasksBulkInput,
    async (input, client, config) => updateTasksBulk(input, client, config, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_delete_task",
    "Delete a task.",
    DeleteTaskInput,
    async (input, client) => deleteTask(input, client, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_delete_tasks_bulk",
    "Delete multiple tasks with confirmation and optional dry run.",
    DeleteTasksBulkInput,
    async (input, client, config) => deleteTasksBulk(input, client, config, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_move_task",
    "Move a task to a different list.",
    MoveTaskInput,
    async (input, client) => moveTask(input, client, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_move_tasks_bulk",
    "Move multiple tasks to new lists.",
    MoveTasksBulkInput,
    async (input, client, config) => moveTasksBulk(input, client, config, sessionTaskCatalogue)
  )
  registerDestructive("clickup_duplicate_task", "Duplicate a task.", DuplicateTaskInput, duplicateTask)
  registerDestructive("clickup_comment_task", "Add a comment to a task.", CommentTaskInput, commentTask)
  registerDestructive("clickup_attach_file_to_task", "Attach a file to a task.", AttachFileInput, attachFileToTask)
  registerDestructive(
    "clickup_add_tags_to_task",
    "Add tags to a task.",
    AddTagsInput,
    async (input, client) => addTagsToTask(input, client, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_add_tags_bulk",
    "Add tags across multiple tasks with shared defaults.",
    AddTagsBulkInput,
    async (input, client, config) => addTagsBulk(input, client, config, sessionTaskCatalogue)
  )
  registerDestructive(
    "clickup_remove_tags_from_task",
    "Remove tags from a task.",
    RemoveTagsInput,
    async (input, client) => removeTagsFromTask(input, client, sessionTaskCatalogue)
  )

  registerReadOnly("clickup_search_tasks", "Structured task search.", SearchTasksInput, async (input, client, config) => {
    const result = await searchTasks(input, client, config, sessionTaskCatalogue)
    return { tasks: result.results, truncated: result.truncated }
  })
  registerReadOnly("clickup_fuzzy_search", "Fuzzy search tasks.", FuzzySearchInput, async (input, client, config) => {
    const result = await fuzzySearch(input, client, config, sessionTaskCatalogue)
    return { tasks: result.results, guidance: result.guidance }
  })
  registerReadOnly(
    "clickup_bulk_fuzzy_search",
    "Bulk fuzzy search for tasks.",
    BulkFuzzySearchInput,
    async (input, client, config) => {
      const result = await bulkFuzzySearch(input, client, config, sessionTaskCatalogue)
      return { queries: result }
    }
  )

  registerReadOnly(
    "clickup_get_task",
    "Fetch task details with context-aware truncation.",
    GetTaskInput,
    (input, client, config) => getTask(input, client, config, sessionTaskCatalogue)
  )
  registerReadOnly(
    "clickup_list_tasks_in_list",
    "List tasks inside a ClickUp list with optional pagination and filters.",
    ListTasksInListInput,
    (input, client, config) => listTasksInList(input, client, config, sessionTaskCatalogue)
  )
  registerReadOnly(
    "clickup_get_task_comments",
    "Retrieve recent comments for a task, keeping responses token-friendly.",
    GetTaskCommentsInput,
    (input, client, config) => getTaskComments(input, client, config, sessionTaskCatalogue)
  )

  // Docs
  registerDestructive("clickup_create_doc", "Create a doc in ClickUp.", CreateDocInput, createDoc)
  registerReadOnly(
    "clickup_list_documents",
    "List docs with hierarchy summaries and preview snippets. Chain with clickup_get_document for deeper context.",
    ListDocumentsInput,
    (input, client, config) => listDocuments(input, client, config)
  )
  registerReadOnly(
    "clickup_get_document",
    "Fetch a doc with hierarchy summary and page previews ready for follow-up workflows.",
    GetDocumentInput,
    (input, client, config) => getDocument(input, client, config)
  )
  registerReadOnly(
    "clickup_get_document_pages",
    "Fetch specific doc pages with truncated bodies to review before updates.",
    GetDocumentPagesInput,
    (input, client, config) => getDocumentPages(input, client, config)
  )
  registerReadOnly("clickup_list_doc_pages", "List doc pages.", ListDocPagesInput, listDocPages)
  registerReadOnly("clickup_get_doc_page", "Get a doc page.", GetDocPageInput, getDocPage)
  registerDestructive(
    "clickup_create_document_page",
    "Create a doc page with dry-run previews. Chain with clickup_get_document_pages to verify content.",
    CreateDocumentPageInput,
    (input, client, config) => createDocumentPage(input, client, config)
  )
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

  registerReadOnly(
    "clickup_get_task_time_entries",
    "Fetch recent time entries for a task with token-aware truncation.",
    GetTaskTimeEntriesInput,
    async (input, client) => {
      const result = await getTaskTimeEntries(input, client)
      return {
        taskId: result.taskId,
        entryCount: result.entryCount,
        totalDurationMs: result.totalDurationMs,
        entries: result.entries,
        truncated: result.truncated,
        guidance: result.guidance
      }
    }
  )

  registerReadOnly(
    "clickup_get_current_time_entry",
    "Retrieve the currently running time entry for a workspace.",
    GetCurrentTimeEntryInput,
    async (input, client, config) => {
      const result = await getCurrentTimeEntry(input, client, config)
      return {
        teamId: result.teamId,
        active: result.active,
        entry: result.entry,
        guidance: result.guidance
      }
    }
  )

  registerReadOnly("clickup_list_time_entries", "List time entries.", ListTimeEntriesInput, async (input, client, config) => {
    const result = await listTimeEntries(input, client, config)
    return { entries: result.entries, truncated: result.truncated }
  })
  registerReadOnly("clickup_report_time_for_tag", "Report time by tag.", ReportTimeForTagInput, reportTimeForTag)
  registerReadOnly("clickup_report_time_for_container", "Report time by container.", ReportTimeForContainerInput, reportTimeForContainer)
  registerReadOnly("clickup_report_time_for_space_tag", "Report time for a tag within a space.", ReportTimeForSpaceTagInput, reportTimeForSpaceTag)
}
