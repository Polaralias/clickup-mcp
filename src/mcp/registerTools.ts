import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { ClickUpClient } from "../infrastructure/clickup/ClickUpClient.js"
import { readOnlyAnnotation, destructiveAnnotation } from "./annotations.js"
import { zodToJsonSchemaCompact } from "./zodToJsonSchema.js"
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

type ToolHandler = (input: any, client: ClickUpClient, config: ApplicationConfig) => Promise<unknown>

type RegistrationOptions = {
  schema: z.ZodTypeAny | null
  description: string
  annotations?: Record<string, unknown>
  handler: ToolHandler
}

function unwrapToObject(schema: z.ZodTypeAny | null): z.ZodObject<any> | null {
  if (!schema) return null

  let current: z.ZodTypeAny | null = schema

  while (current) {
    const typeName = current._def.typeName
    if (typeName === z.ZodFirstPartyTypeKind.ZodObject) {
      return current as z.ZodObject<any>
    }
    if (typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
      current = (current as z.ZodEffects<any>)._def.schema
      continue
    }
    if (typeName === z.ZodFirstPartyTypeKind.ZodDefault || typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
      current = (current as z.ZodDefault<any> | z.ZodOptional<any>)._def.innerType
      continue
    }
    if (typeName === z.ZodFirstPartyTypeKind.ZodBranded) {
      current = (current as z.ZodBranded<any, any>)._def.type
      continue
    }
    if (typeName === z.ZodFirstPartyTypeKind.ZodPipeline) {
      current = (current as z.ZodPipeline<any, any>)._def.out
      continue
    }
    return null
  }

  return null
}

function getInputShape(schema: z.ZodTypeAny | null) {
  const object = unwrapToObject(schema)
  return object ? object.shape : undefined
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

export function registerTools(server: McpServer, config: ApplicationConfig) {
  const entries: ToolCatalogueEntry[] = []

  const createClient = () => new ClickUpClient(config.apiKey)
  const sessionHierarchyDirectory = new HierarchyDirectory()
  const sessionTaskCatalogue = new TaskCatalogue()
  const sessionSpaceTagCache = new SpaceTagCache()

  function registerClientTool(name: string, options: RegistrationOptions) {
    const rawShape = getInputShape(options.schema)
    const inputSchema = zodToJsonSchemaCompact(options.schema)
    entries.push({
      name,
      description: options.description,
      annotations: options.annotations,
      inputSchema: inputSchema
    })
    server.registerTool(
      name,
      {
        description: options.description,
        inputSchema: rawShape,
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
  const pingSchema = z.object({ message: z.string().optional() })
  const pingAnnotation = readOnlyAnnotation("system", "echo", { scope: "connectivity", idempotent: true })
  entries.push({
    name: "ping",
    description: "Echo request for connectivity checks; include message to confirm round-trip.",
    annotations: pingAnnotation.annotations
  })
  server.registerTool(
    "ping",
    {
      description: "Echo request for connectivity checks; include message to confirm round-trip.",
      inputSchema: pingSchema.shape,
      ...pingAnnotation
    },
    async (rawInput: unknown) => {
      const parsed = pingSchema.parse(rawInput ?? {})
      return formatContent(await ping(parsed.message))
    }
  )

  const healthAnnotation = readOnlyAnnotation("system", "status", { scope: "server" })
  entries.push({
    name: "health",
    description: "Report server readiness, auth validity, and enforced safety limits to plan follow-up calls.",
    annotations: healthAnnotation.annotations
  })
  server.registerTool(
    "health",
    {
      description: "Report server readiness, auth validity, and enforced safety limits to plan follow-up calls.",
      ...healthAnnotation
    },
    async () => formatContent(await health(config))
  )

  const catalogueAnnotation = readOnlyAnnotation("system", "tool manifest", { scope: "server" })
  entries.push({
    name: "tool_catalogue",
    description: "Enumerate every tool with its annotations for dynamic planning; call before chaining unfamiliar tools.",
    annotations: catalogueAnnotation.annotations
  })
  server.registerTool(
    "tool_catalogue",
    {
      description: "Enumerate every tool with its annotations for dynamic planning; call before chaining unfamiliar tools.",
      ...catalogueAnnotation
    },
    async () => formatContent(await toolCatalogue(entries))
  )

  const registerDestructive = (
    name: string,
    description: string,
    schema: z.ZodTypeAny,
    handler: ToolHandler,
    annotation: ReturnType<typeof destructiveAnnotation>
  ) => {
    entries.push({ name, description, annotations: annotation.annotations })
    server.registerTool(
      name,
      {
        description,
        inputSchema: getInputShape(schema),
        ...annotation
      },
      withSafetyConfirmation(async (rawInput: unknown) => {
        const client = createClient()
        const parsed = schema.parse(rawInput ?? {})
        const result = await handler(parsed, client, config)
        return formatContent(result)
      })
    )
  }

  const registerReadOnly = (
    name: string,
    description: string,
    schema: z.ZodTypeAny | null,
    handler: ToolHandler,
    annotation: ReturnType<typeof readOnlyAnnotation>
  ) => {
    registerClientTool(name, {
      description,
      schema,
      annotations: annotation.annotations,
      handler
    })
  }

  // Hierarchy tools
  registerReadOnly(
    "clickup_list_workspaces",
    "List workspaces accessible with the API key; set forceRefresh=true when hierarchy updates are needed immediately.",
    ListWorkspacesInput,
    async (input = {}, client) =>
      listWorkspaces(client, sessionHierarchyDirectory, { forceRefresh: input?.forceRefresh }),
    readOnlyAnnotation("hierarchy", "workspace list", { scope: "workspace", cache: "session|forceRefresh" })
  )
  registerReadOnly(
    "clickup_list_spaces",
    "List spaces for workspaceId; call after clickup_list_workspaces and use forceRefresh to bypass cached results.",
    ListSpacesInput,
    (input, client) => listSpaces(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "space list", { scope: "workspace", input: "workspaceId", cache: "session" })
  )
  registerReadOnly(
    "clickup_list_folders",
    "List folders in spaceId; chain after clickup_list_spaces and apply forceRefresh when structure has changed.",
    ListFoldersInput,
    (input, client) => listFolders(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "folder list", { scope: "space", input: "spaceId", cache: "session" })
  )
  registerReadOnly("clickup_list_lists", "List lists under spaceId or folderId (provide exactly one); supports forceRefresh when layout changed.", ListListsInput, async (input, client) => {
    if (!input.spaceId && !input.folderId) {
      throw new Error("Provide spaceId or folderId")
    }
    return listLists(input, client, sessionHierarchyDirectory)
  }, readOnlyAnnotation("hierarchy", "list list", { scope: "space|folder", input: "spaceId|folderId", cache: "session" }))
  registerReadOnly(
    "clickup_get_workspace_overview",
    "Return workspace-level metrics plus recent structures for workspaceId; use before deeper hierarchy traversal.",
    GetWorkspaceOverviewInput,
    (input, client) => getWorkspaceOverview(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "workspace overview", { scope: "workspace", input: "workspaceId" })
  )
  registerReadOnly(
    "clickup_get_workspace_hierarchy",
    "Fetch nested spaces/folders/lists for selected workspaces using maxDepth and max* controls; accepts IDs or names.",
    GetWorkspaceHierarchyInput,
    (input, client, config) => getWorkspaceHierarchy(input, client, config, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "workspace tree", { scope: "workspace", input: "workspaceIds|names" })
  )
  registerReadOnly(
    "clickup_resolve_path_to_ids",
    "Resolve ordered workspace/space/folder/list names into IDs; pass forceRefresh when cache might be stale.",
    ResolvePathToIdsInput,
    (input, client) => resolvePathToIds(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "path resolve", { scope: "workspace", input: "names", cache: "session|forceRefresh" })
  )
  registerReadOnly("clickup_list_members", "List members for the current workspace; provide teamId when token spans multiples.", ListMembersInput, listMembers, readOnlyAnnotation("member", "member list", { scope: "workspace", input: "teamId?" }))
  registerReadOnly(
    "clickup_resolve_members",
    "Resolve identifiers to member records with similarity scores; identifiers array required, optional teamId/limit/refresh.",
    ResolveMembersInput,
    resolveMembers,
    readOnlyAnnotation("member", "member resolve", { scope: "workspace", input: "identifiers", cache: "session|forceRefresh" })
  )
  registerReadOnly(
    "clickup_find_member_by_name",
    "Fuzzy search member names; include teamId when scoped and refresh=true right after roster updates.",
    FindMemberByNameInput,
    findMemberByName,
    readOnlyAnnotation("member", "member search", { scope: "workspace", input: "query", cache: "session|refresh" })
  )
  registerReadOnly(
    "clickup_resolve_assignees",
    "Translate human-friendly assignee references into member suggestions with confidence scores and cache hints.",
    ResolveAssigneesInput,
    resolveAssignees,
    readOnlyAnnotation("member", "assignee resolve", { scope: "workspace", input: "references" })
  )
  registerReadOnly(
    "clickup_list_tags_for_space",
    "List tags configured on spaceId; set forceRefresh=true after creating or deleting tags.",
    ListTagsForSpaceInput,
    (input, client) => listTagsForSpace(input, client, sessionSpaceTagCache),
    readOnlyAnnotation("tag", "space tags", { scope: "space", input: "spaceId", cache: "session|forceRefresh" })
  )

  registerDestructive(
    "clickup_create_space_tag",
    "Create a space-level tag on spaceId with optional colour fields; dryRun to inspect payload, confirm=\"yes\" to commit.",
    CreateSpaceTagInput,
    async (input, client) => createSpaceTag(input, client, sessionSpaceTagCache),
    destructiveAnnotation("tag", "create space tag", { scope: "space", input: "spaceId", dry: true })
  )
  registerDestructive(
    "clickup_update_space_tag",
    "Update a space-level tag via spaceId and currentName; supply new name/colours, dryRun for preview, confirm=\"yes\" to apply.",
    UpdateSpaceTagInput,
    async (input, client) => updateSpaceTag(input, client, sessionSpaceTagCache),
    destructiveAnnotation("tag", "update space tag", { scope: "space", input: "spaceId+currentName", dry: true })
  )
  registerDestructive(
    "clickup_delete_space_tag",
    "Delete a space-level tag from spaceId by name; prefer dryRun to review and send confirm=\"yes\" when certain.",
    DeleteSpaceTagInput,
    async (input, client) => deleteSpaceTag(input, client, sessionSpaceTagCache),
    destructiveAnnotation("tag", "delete space tag", { scope: "space", input: "spaceId+tagName", dry: true })
  )

  // Hierarchy management
  registerDestructive(
    "clickup_create_folder",
    "Create a folder under spaceId or path with optional description/statuses; use dryRun before sending confirm=\"yes\".",
    CreateFolderInput,
    async (input, client) => createFolder(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "create folder", { scope: "space", input: "spaceId|path", dry: true })
  )
  registerDestructive(
    "clickup_update_folder",
    "Update a folder identified by folderId or path; include fields to change, dryRun for validation, confirm=\"yes\" to save.",
    UpdateFolderInput,
    async (input, client) => updateFolder(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "update folder", { scope: "space", input: "folderId|path", dry: true })
  )
  registerDestructive(
    "clickup_delete_folder",
    "Delete a folder resolved by folderId or path; dryRun to confirm target then send confirm=\"yes\".",
    DeleteFolderInput,
    async (input, client) => deleteFolder(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "delete folder", { scope: "space", input: "folderId|path", dry: true })
  )
  registerDestructive(
    "clickup_create_list",
    "Create a list within spaceId/folderId or path with optional status overrides; dryRun first, confirm=\"yes\" to persist.",
    CreateListInput,
    async (input, client) => createList(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "create list", { scope: "space|folder", input: "spaceId|folderId|path", dry: true })
  )
  registerDestructive(
    "clickup_update_list",
    "Update a list via listId or path; include at least one field to change. Use dryRun prior to confirm=\"yes\".",
    UpdateListInput,
    async (input, client) => updateList(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "update list", { scope: "space|folder", input: "listId|path", dry: true })
  )
  registerDestructive(
    "clickup_delete_list",
    "Delete a list resolved by listId or path; dryRun helps verify scope before confirm=\"yes\".",
    DeleteListInput,
    async (input, client) => deleteList(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "delete list", { scope: "space|folder", input: "listId|path", dry: true })
  )
  registerDestructive(
    "clickup_create_list_view",
    "Create a view scoped to listId/path with optional viewType and status filters; dryRun supports preview, confirm=\"yes\" to create.",
    CreateListViewInput,
    async (input, client) => createListView(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("view", "create list view", { scope: "list", input: "listId|path", dry: true })
  )
  registerDestructive(
    "clickup_create_space_view",
    "Create a space-level view for spaceId/path with optional filters; dryRun first, confirm=\"yes\" when final.",
    CreateSpaceViewInput,
    async (input, client) => createSpaceView(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("view", "create space view", { scope: "space", input: "spaceId|path", dry: true })
  )
  registerDestructive(
    "clickup_update_view",
    "Update a view by viewId; provide fields such as name/viewType/statuses. dryRun before confirm=\"yes\".",
    UpdateViewInput,
    async (input, client) => updateView(input, client),
    destructiveAnnotation("view", "update view", { scope: "view", input: "viewId", dry: true })
  )
  registerDestructive(
    "clickup_delete_view",
    "Delete a view by viewId; consider dryRun metadata then send confirm=\"yes\" to remove.",
    DeleteViewInput,
    async (input, client) => deleteView(input, client),
    destructiveAnnotation("view", "delete view", { scope: "view", input: "viewId", dry: true })
  )

  // Reference
  registerReadOnly(
    "clickup_list_reference_links",
    "List public ClickUp API reference sidebar links; adjust limit to control token use. No workspace data involved.",
    ListReferenceLinksInput,
    async (input) => listReferenceLinks(input),
    readOnlyAnnotation("reference", "doc link list", { scope: "public", input: "limit" })
  )
  registerReadOnly(
    "clickup_fetch_reference_page",
    "Fetch a public ClickUp API reference page by URL with optional maxCharacters trimming; safe for workspace-agnostic guidance.",
    FetchReferencePageInput,
    async (input, _client, config) => fetchReferencePage(input, config),
    readOnlyAnnotation("reference", "doc fetch", { scope: "public", input: "url", limit: "maxCharacters" })
  )

  // Task tools
  registerDestructive(
    "clickup_create_task",
    "Create a task in listId with optional description/assignees/priority/dueDate/tags; dryRun first, confirm=\"yes\" to submit.",
    CreateTaskInput,
    async (input, client) => createTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "create task", { scope: "list", input: "listId", dry: true })
  )
  registerDestructive(
    "clickup_create_tasks_bulk",
    "Bulk create tasks with shared defaults and optional teamId; inspect dryRun output before sending confirm=\"yes\".",
    CreateTasksBulkInput,
    async (input, client, config) => createTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk create", { scope: "list", input: "tasks[]", dry: true })
  )
  registerDestructive(
    "clickup_update_task",
    "Update taskId fields (name/description/status/priority/dueDate/assigneeIds/tags); use dryRun before confirm=\"yes\".",
    UpdateTaskInput,
    async (input, client) => updateTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "update task", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_update_tasks_bulk",
    "Bulk update tasks with defaults or per-task fields; ensure each task changes something. dryRun then confirm=\"yes\".",
    UpdateTasksBulkInput,
    async (input, client, config) => updateTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk update", { scope: "task", input: "tasks[]", dry: true })
  )
  registerDestructive(
    "clickup_delete_task",
    "Delete a task by taskId; review dryRun confirmation before sending confirm=\"yes\".",
    DeleteTaskInput,
    async (input, client) => deleteTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "delete task", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_delete_tasks_bulk",
    "Bulk delete tasks via IDs (optional teamId); call with dryRun to audit, then confirm=\"yes\" to execute.",
    DeleteTasksBulkInput,
    async (input, client, config) => deleteTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk delete", { scope: "task", input: "taskIds", dry: true })
  )
  registerDestructive(
    "clickup_move_task",
    "Move a taskId to target listId; dryRun validates mapping before confirm=\"yes\".",
    MoveTaskInput,
    async (input, client) => moveTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "move task", { scope: "task", input: "taskId+listId", dry: true })
  )
  registerDestructive(
    "clickup_move_tasks_bulk",
    "Bulk move tasks supplying listId per task or via defaults; run dryRun before confirm=\"yes\".",
    MoveTasksBulkInput,
    async (input, client, config) => moveTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk move", { scope: "task", input: "tasks[]", dry: true })
  )
  registerDestructive(
    "clickup_duplicate_task",
    "Duplicate a taskId, optionally targeting listId and including checklists/assignees; dryRun then confirm=\"yes\".",
    DuplicateTaskInput,
    duplicateTask,
    destructiveAnnotation("task", "duplicate task", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_comment_task",
    "Post a comment on taskId; supply comment text, optionally dryRun for preview, confirm=\"yes\" to send.",
    CommentTaskInput,
    commentTask,
    destructiveAnnotation("task", "comment", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_attach_file_to_task",
    "Attach base64 dataUri as filename to taskId; respect size caps, dryRun if you only need metadata, confirm=\"yes\" to upload.",
    AttachFileInput,
    attachFileToTask,
    destructiveAnnotation("task", "attach file", { scope: "task", input: "taskId+file", dry: true })
  )
  registerDestructive(
    "clickup_add_tags_to_task",
    "Add tags array to taskId; run dryRun to inspect before confirm=\"yes\".",
    AddTagsInput,
    async (input, client) => addTagsToTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "add tags", { scope: "task", input: "taskId+tags", dry: true })
  )
  registerDestructive(
    "clickup_add_tags_bulk",
    "Bulk add tags with defaults or per-task overrides; ensure tags present. dryRun then confirm=\"yes\".",
    AddTagsBulkInput,
    async (input, client, config) => addTagsBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk add tags", { scope: "task", input: "tasks[]", dry: true })
  )
  registerDestructive(
    "clickup_remove_tags_from_task",
    "Remove tags array from taskId; dryRun highlights changes before confirm=\"yes\".",
    RemoveTagsInput,
    async (input, client) => removeTagsFromTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "remove tags", { scope: "task", input: "taskId+tags", dry: true })
  )

  registerReadOnly(
    "clickup_search_tasks",
    "Structured task search with query/listIds/tagIds/status filters plus pagination; watch truncated flag for large result sets.",
    SearchTasksInput,
    async (input, client, config) => {
      const result = await searchTasks(input, client, config, sessionTaskCatalogue)
      return { tasks: result.results, truncated: result.truncated }
    },
    readOnlyAnnotation("task", "search structured", { scope: "workspace", input: "query+filters" })
  )
  registerReadOnly(
    "clickup_fuzzy_search",
    "Fuzzy task search from natural-language query; limit controls matches and response includes guidance for follow-up calls.",
    FuzzySearchInput,
    async (input, client, config) => {
      const result = await fuzzySearch(input, client, config, sessionTaskCatalogue)
      return { tasks: result.results, guidance: result.guidance }
    },
    readOnlyAnnotation("task", "search fuzzy", { scope: "workspace", input: "query" })
  )
  registerReadOnly(
    "clickup_bulk_fuzzy_search",
    "Run multiple fuzzy task queries in one call; provide queries[] and optional limit to balance recall vs tokens.",
    BulkFuzzySearchInput,
    async (input, client, config) => {
      const result = await bulkFuzzySearch(input, client, config, sessionTaskCatalogue)
      return { queries: result }
    },
    readOnlyAnnotation("task", "search fuzzy bulk", { scope: "workspace", input: "queries[]" })
  )

  registerReadOnly(
    "clickup_get_task",
    "Fetch task by id/name/context with detailLimit controlling expanded sections; grounding step before mutations.",
    GetTaskInput,
    (input, client, config) => getTask(input, client, config, sessionTaskCatalogue),
    readOnlyAnnotation("task", "task fetch", { scope: "task", input: "taskId|lookup" })
  )
  registerReadOnly(
    "clickup_list_tasks_in_list",
    "List tasks via listId or contextual lookup with pagination plus includeClosed/includeSubtasks toggles.",
    ListTasksInListInput,
    (input, client, config) => listTasksInList(input, client, config, sessionTaskCatalogue),
    readOnlyAnnotation("task", "list tasks", { scope: "list", input: "listId|path" })
  )
  registerReadOnly(
    "clickup_get_task_comments",
    "Retrieve recent comments for a task; limit parameter constrains comment count for token safety.",
    GetTaskCommentsInput,
    (input, client, config) => getTaskComments(input, client, config, sessionTaskCatalogue),
    readOnlyAnnotation("task", "task comments", { scope: "task", input: "taskId", limit: "limit" })
  )

  // Docs
  registerDestructive(
    "clickup_create_doc",
    "Create a doc inside folderId with optional initial content; dryRun for preview, confirm=\"yes\" to persist.",
    CreateDocInput,
    createDoc,
    destructiveAnnotation("doc", "create doc", { scope: "folder", input: "folderId", dry: true })
  )
  registerReadOnly(
    "clickup_list_documents",
    "List docs filtered by workspace/space/folder/search; tweak preview limits to control tokens before fetching full docs.",
    ListDocumentsInput,
    (input, client, config) => listDocuments(input, client, config),
    readOnlyAnnotation("doc", "doc list", { scope: "workspace", input: "filters" })
  )
  registerReadOnly(
    "clickup_get_document",
    "Fetch doc metadata plus optional pages via pageIds/pageLimit; previewCharLimit gates body length for planning edits.",
    GetDocumentInput,
    (input, client, config) => getDocument(input, client, config),
    readOnlyAnnotation("doc", "doc fetch", { scope: "doc", input: "docId", limit: "previewCharLimit" })
  )
  registerReadOnly(
    "clickup_get_document_pages",
    "Fetch selected doc pages with optional previewCharLimit trimming before editing or summarising.",
    GetDocumentPagesInput,
    (input, client, config) => getDocumentPages(input, client, config),
    readOnlyAnnotation("doc", "doc pages fetch", { scope: "doc", input: "docId+pageIds", limit: "previewCharLimit" })
  )
  registerReadOnly(
    "clickup_list_doc_pages",
    "List page hierarchy for a docId to plan targeted retrievals.",
    ListDocPagesInput,
    listDocPages,
    readOnlyAnnotation("doc", "doc page list", { scope: "doc", input: "docId" })
  )
  registerReadOnly(
    "clickup_get_doc_page",
    "Fetch a single doc page by docId/pageId for precise reading or updates.",
    GetDocPageInput,
    getDocPage,
    readOnlyAnnotation("doc", "doc page fetch", { scope: "doc", input: "docId+pageId" })
  )
  registerDestructive(
    "clickup_create_document_page",
    "Create a doc page under docId with optional parent/position/content; dryRun first, confirm=\"yes\" when satisfied.",
    CreateDocumentPageInput,
    (input, client, config) => createDocumentPage(input, client, config),
    destructiveAnnotation("doc", "create page", { scope: "doc", input: "docId", dry: true })
  )
  registerDestructive(
    "clickup_update_doc_page",
    "Update doc page title/content; dryRun to review diff then confirm=\"yes\" to apply.",
    UpdateDocPageInput,
    updateDocPage,
    destructiveAnnotation("doc", "update page", { scope: "doc", input: "docId+pageId", dry: true })
  )
  registerReadOnly(
    "clickup_doc_search",
    "Search doc content by query with optional expandPages flag to include snippets; adjust limit for token control.",
    DocSearchInput,
    async (input, client, config) => {
      const result = await docSearch(input, client, config)
      return { docs: result.docs, expandedPages: result.expandedPages, guidance: result.guidance }
    },
    readOnlyAnnotation("doc", "doc search", { scope: "workspace", input: "query", option: "expandPages" })
  )
  registerReadOnly(
    "clickup_bulk_doc_search",
    "Batch doc keyword searches; provide queries[] and limit/expandPages to balance recall with response size.",
    BulkDocSearchInput,
    async (input, client, config) => {
      const result = await bulkDocSearch(input, client, config)
      return { queries: result }
    },
    readOnlyAnnotation("doc", "doc search bulk", { scope: "workspace", input: "queries[]" })
  )

  // Time tracking
  registerDestructive(
    "clickup_start_timer",
    "Start a timer on taskId; use dryRun to inspect the would-be entry, confirm=\"yes\" to activate.",
    StartTimerInput,
    startTimer,
    destructiveAnnotation("time", "start timer", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_stop_timer",
    "Stop the running timer for taskId; dryRun confirms context before confirm=\"yes\" halts it.",
    StopTimerInput,
    stopTimer,
    destructiveAnnotation("time", "stop timer", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_create_time_entry",
    "Create manual time entry for taskId with start/end/duration/description; dryRun preview then confirm=\"yes\".",
    CreateTimeEntryInput,
    createTimeEntry,
    destructiveAnnotation("time", "create entry", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_update_time_entry",
    "Update time entry fields by entryId (start/end/duration/description); dryRun first, confirm=\"yes\" to apply.",
    UpdateTimeEntryInput,
    updateTimeEntry,
    destructiveAnnotation("time", "update entry", { scope: "time", input: "entryId", dry: true })
  )
  registerDestructive(
    "clickup_delete_time_entry",
    "Delete a time entry by entryId; review dryRun confirmation then send confirm=\"yes\".",
    DeleteTimeEntryInput,
    deleteTimeEntry,
    destructiveAnnotation("time", "delete entry", { scope: "time", input: "entryId", dry: true })
  )

  registerReadOnly(
    "clickup_get_task_time_entries",
    "Fetch recent time entries for taskId; response includes totals, truncated flag, and guidance for next steps.",
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
    },
    readOnlyAnnotation("time", "task entries", { scope: "task", input: "taskId", limit: "pageSize" })
  )

  registerReadOnly(
    "clickup_get_current_time_entry",
    "Retrieve currently running timer for optional teamId; includes guidance when nothing active.",
    GetCurrentTimeEntryInput,
    async (input, client, config) => {
      const result = await getCurrentTimeEntry(input, client, config)
      return {
        teamId: result.teamId,
        active: result.active,
        entry: result.entry,
        guidance: result.guidance
      }
    },
    readOnlyAnnotation("time", "current timer", { scope: "workspace", input: "teamId?" })
  )

  registerReadOnly(
    "clickup_list_time_entries",
    "List time entries filtered by taskId/date range with pagination; truncated flag signals when to narrow the window.",
    ListTimeEntriesInput,
    async (input, client, config) => {
      const result = await listTimeEntries(input, client, config)
      return { entries: result.entries, truncated: result.truncated }
    },
    readOnlyAnnotation("time", "entry list", { scope: "workspace", input: "filters" })
  )
  registerReadOnly(
    "clickup_report_time_for_tag",
    "Aggregate logged time for a tag across optional from/to window.",
    ReportTimeForTagInput,
    reportTimeForTag,
    readOnlyAnnotation("time", "tag report", { scope: "workspace", input: "tag", window: "from|to" })
  )
  registerReadOnly(
    "clickup_report_time_for_container",
    "Aggregate time for containerId (list/folder/space) within optional date bounds.",
    ReportTimeForContainerInput,
    reportTimeForContainer,
    readOnlyAnnotation("time", "container report", { scope: "space|folder|list", input: "containerId", window: "from|to" })
  )
  registerReadOnly(
    "clickup_report_time_for_space_tag",
    "Aggregate time for a tag scoped to spaceId, honouring optional from/to filters.",
    ReportTimeForSpaceTagInput,
    reportTimeForSpaceTag,
    readOnlyAnnotation("time", "space tag report", { scope: "space", input: "spaceId+tag", window: "from|to" })
  )
}
