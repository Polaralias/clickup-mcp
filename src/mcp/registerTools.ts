import { z } from "zod"
import type { ZodRawShape, ZodTypeAny } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { ClickUpClient } from "../infrastructure/clickup/ClickUpClient.js"
import { readOnlyAnnotation, destructiveAnnotation } from "./annotations.js"
import { zodToJsonSchemaCompact } from "./zodToJsonSchema.js"
import {
  CreateTaskInput,
  CreateSubtaskInput,
  CreateSubtasksBulkInput,
  UpdateTaskInput,
  DeleteTaskInput,
  DuplicateTaskInput,
  CommentTaskInput,
  AttachFileInput,
  AddTagsInput,
  RemoveTagsInput,
  CreateTasksBulkInput,
  UpdateTasksBulkInput,
  DeleteTasksBulkInput,
  AddTagsBulkInput,
  GetTaskInput,
  ListTasksInListInput,
  GetTaskCommentsInput,
  SearchTasksInput,
  FuzzySearchInput,
  BulkFuzzySearchInput,
  TaskStatusReportInput,
  TaskRiskReportInput,
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
  DeleteViewInput,
  ListCustomFieldsInput,
  SetTaskCustomFieldValueInput,
  ClearTaskCustomFieldValueInput
} from "./schemas/index.js"
import { withSafetyConfirmation } from "../application/safety/withSafetyConfirmation.js"
import { createTask } from "../application/usecases/tasks/CreateTask.js"
import { updateTask } from "../application/usecases/tasks/UpdateTask.js"
import { deleteTask } from "../application/usecases/tasks/DeleteTask.js"
import { duplicateTask } from "../application/usecases/tasks/DuplicateTask.js"
import { commentTask } from "../application/usecases/tasks/CommentTask.js"
import { attachFileToTask } from "../application/usecases/tasks/AttachFileToTask.js"
import { addTagsToTask } from "../application/usecases/tasks/AddTagsToTask.js"
import { removeTagsFromTask } from "../application/usecases/tasks/RemoveTagsFromTask.js"
import { createTasksBulk } from "../application/usecases/tasks/CreateTasksBulk.js"
import { createSubtasksBulk } from "../application/usecases/tasks/CreateSubtasksBulk.js"
import { updateTasksBulk } from "../application/usecases/tasks/UpdateTasksBulk.js"
import { deleteTasksBulk } from "../application/usecases/tasks/DeleteTasksBulk.js"
import { addTagsBulk } from "../application/usecases/tasks/AddTagsBulk.js"
import { getTask } from "../application/usecases/tasks/GetTask.js"
import { listTasksInList } from "../application/usecases/tasks/ListTasksInList.js"
import { getTaskComments } from "../application/usecases/tasks/GetTaskComments.js"
import { searchTasks } from "../application/usecases/tasks/SearchTasks.js"
import { fuzzySearch } from "../application/usecases/tasks/FuzzySearch.js"
import { bulkFuzzySearch } from "../application/usecases/tasks/BulkFuzzySearch.js"
import { taskStatusReport } from "../application/usecases/tasks/TaskStatusReport.js"
import { taskRiskReport } from "../application/usecases/tasks/TaskRiskReport.js"
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
import { listCustomFields } from "../application/usecases/customFields/ListCustomFields.js"
import { setTaskCustomFieldValue } from "../application/usecases/customFields/SetTaskCustomFieldValue.js"
import { clearTaskCustomFieldValue } from "../application/usecases/customFields/ClearTaskCustomFieldValue.js"
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
import { MemberDirectory } from "../application/services/MemberDirectory.js"
import { TaskCatalogue } from "../application/services/TaskCatalogue.js"
import { SpaceTagCache } from "../application/services/SpaceTagCache.js"
import { CapabilityTracker } from "../application/services/CapabilityTracker.js"
import { SessionCache } from "../application/services/SessionCache.js"
import {
  ensureDocsCapability,
  isDocCapabilityError,
  isDocsCapabilityUnavailableError
} from "../application/services/DocCapability.js"
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

type CatalogueEntryConfig = {
  entry: ToolCatalogueEntry
  requiresDocs?: boolean
}

type RegistrationOptions = {
  schema: z.ZodTypeAny | null
  description: string
  annotations?: Record<string, unknown>
  meta?: Record<string, unknown>
  handler: ToolHandler
  requiresDocs?: boolean
}

function unwrapToZodObject(schema: ZodTypeAny | null) {
  let current: ZodTypeAny | null = schema
  while (current instanceof z.ZodEffects) {
    current = current._def.schema
  }
  return current instanceof z.ZodObject ? current : null
}

function toRawShape(schema: ZodTypeAny | null): ZodRawShape | undefined {
  const obj = unwrapToZodObject(schema)
  return obj ? obj.shape : undefined
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

export function registerTools(server: McpServer, config: ApplicationConfig, sessionCache: SessionCache) {
  const entries: CatalogueEntryConfig[] = []

  const createClient = () => new ClickUpClient(config.apiKey)
  const sessionHierarchyDirectory = new HierarchyDirectory(
    config.hierarchyCacheTtlMs,
    sessionCache,
    config.teamId
  )
  const sessionTaskCatalogue = new TaskCatalogue()
  const sessionSpaceTagCache = new SpaceTagCache(
    config.spaceConfigCacheTtlMs,
    sessionCache,
    config.teamId
  )
  const sessionCapabilityTracker = new CapabilityTracker()
  const sessionMemberDirectory = new MemberDirectory({ credentialId: config.apiKey })

  const previousOnClose = server.server.onclose
  server.server.onclose = () => {
    sessionMemberDirectory.clear()
    previousOnClose?.()
  }

  function registerClientTool(name: string, options: RegistrationOptions) {
    const jsonSchema = zodToJsonSchemaCompact(options.schema)
    const rawShape = toRawShape(options.schema)
    const entry: ToolCatalogueEntry = {
      name,
      description: options.description,
      annotations: options.annotations,
      inputSchema: jsonSchema
    }
    entries.push({ entry, requiresDocs: options.requiresDocs })
    server.registerTool(
      name,
      {
        description: options.description,
        ...(rawShape ? { inputSchema: rawShape } : {}),
        annotations: options.annotations,
        _meta: options.meta
      },
      async (rawInput: unknown) => {
        const client = createClient()
        const parsed = options.schema ? options.schema.parse(rawInput ?? {}) : {}
        const result = await options.handler(parsed, client, config)
        return formatContent(result)
      }
    )
  }

  async function resolveCatalogue(client: ClickUpClient) {
    let docsAvailable = sessionCapabilityTracker.getDocsEndpoint(config.teamId)?.docsAvailable
    if (docsAvailable === undefined) {
      try {
        await ensureDocsCapability(config.teamId, client, sessionCapabilityTracker)
        docsAvailable = true
      } catch (error) {
        if (isDocsCapabilityUnavailableError(error)) {
          docsAvailable = false
        } else {
          docsAvailable = undefined
        }
      }
    }
    return entries
      .filter((entry) => !entry.requiresDocs || docsAvailable !== false)
      .map((entry) => entry.entry)
  }

  // System tools (no client)
  const pingSchema = z.object({ message: z.string().optional() })
  const pingAnnotation = readOnlyAnnotation("system", "echo", { scope: "connectivity", idempotent: true })
  const pingJsonSchema = zodToJsonSchemaCompact(pingSchema)
  const pingShape = toRawShape(pingSchema)
  entries.push({
    entry: {
      name: "ping",
      description: "Echo request for connectivity checks.",
      annotations: pingAnnotation.annotations,
      inputSchema: pingJsonSchema
    }
  })
  server.registerTool(
    "ping",
    {
      description: "Echo request for connectivity checks.",
      ...(pingShape ? { inputSchema: pingShape } : {}),
      ...pingAnnotation
    },
    async (rawInput: unknown) => {
      const parsed = pingSchema.parse(rawInput ?? {})
      return formatContent(await ping(parsed.message))
    }
  )

  const healthAnnotation = readOnlyAnnotation("system", "status", { scope: "server" })
  entries.push({
    entry: {
      name: "health",
      description: "Report server readiness and enforced safety limits.",
      annotations: healthAnnotation.annotations
    }
  })
  server.registerTool(
    "health",
    {
      description: "Report server readiness and enforced safety limits.",
      ...healthAnnotation
    },
    async () => formatContent(await health(config))
  )

  const catalogueAnnotation = readOnlyAnnotation("system", "tool manifest", { scope: "server" })
  entries.push({
    entry: {
      name: "tool_catalogue",
      description: "Enumerate all available tools with their annotations.",
      annotations: catalogueAnnotation.annotations
    }
  })
  server.registerTool(
    "tool_catalogue",
    {
      description: "Enumerate all available tools with their annotations.",
      ...catalogueAnnotation
    },
    async () => {
      const client = createClient()
      const availableEntries = await resolveCatalogue(client)
      return formatContent(await toolCatalogue(availableEntries))
    }
  )

  const capabilityAnnotation = readOnlyAnnotation("system", "capability cache", { scope: "session" })
  entries.push({
    entry: {
      name: "clickup_capabilities",
      description: "Expose cached ClickUp capability probes for this session.",
      annotations: capabilityAnnotation.annotations
    }
  })
  server.registerTool(
    "clickup_capabilities",
    {
      description: "Expose cached ClickUp capability probes for this session.",
      ...capabilityAnnotation
    },
    async () => formatContent(sessionCapabilityTracker.snapshot())
  )

  const registerDestructive = (
    name: string,
    description: string,
    schema: z.ZodTypeAny,
    handler: ToolHandler,
    annotation: ReturnType<typeof destructiveAnnotation>,
    availability?: { requiresDocs?: boolean },
    meta?: Record<string, unknown>
  ) => {
    if (config.readOnly) {
      return
    }
    const jsonSchema = zodToJsonSchemaCompact(schema)
    const rawShape = toRawShape(schema)
    entries.push({
      entry: {
        name,
        description,
        annotations: annotation.annotations,
        inputSchema: jsonSchema
      },
      requiresDocs: availability?.requiresDocs
    })
    server.registerTool(
      name,
      {
        description,
        ...(rawShape ? { inputSchema: rawShape } : {}),
        ...annotation,
        _meta: meta
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
    annotation: ReturnType<typeof readOnlyAnnotation>,
    availability?: { requiresDocs?: boolean },
    meta?: Record<string, unknown>
  ) => {
    registerClientTool(name, {
      description,
      schema,
      annotations: annotation.annotations,
      handler,
      requiresDocs: availability?.requiresDocs,
      meta
    })
  }

  // Hierarchy tools
  registerReadOnly(
    "clickup_list_workspaces",
    "List accessible workspaces. GET /team",
    ListWorkspacesInput,
    async (input = {}, client) =>
      listWorkspaces(client, sessionHierarchyDirectory, { forceRefresh: input?.forceRefresh }),
    readOnlyAnnotation("hierarchy", "workspace list", { scope: "workspace", cache: "session|forceRefresh" })
  )
  registerReadOnly(
    "clickup_list_spaces",
    "List spaces in a workspace. GET /team/{team_id}/space",
    ListSpacesInput,
    (input, client) => listSpaces(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "space list", { scope: "workspace", input: "workspaceId", cache: "session" }),
    undefined,
    {
      input_examples: [{ workspaceId: "12345" }]
    }
  )
  registerReadOnly(
    "clickup_list_folders",
    "List folders in a space. GET /space/{space_id}/folder",
    ListFoldersInput,
    (input, client) => listFolders(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "folder list", { scope: "space", input: "spaceId", cache: "session" })
  )
  registerReadOnly("clickup_list_lists", "List lists in a space or folder. GET /space/{space_id}/list or GET /folder/{folder_id}/list", ListListsInput, async (input, client) => {
    if (!input.spaceId && !input.folderId) {
      throw new Error("Provide spaceId or folderId")
    }
    return listLists(input, client, sessionHierarchyDirectory)
  }, readOnlyAnnotation("hierarchy", "list list", { scope: "space|folder", input: "spaceId|folderId", cache: "session" }), undefined, {
    input_examples: [{ spaceId: "23456" }]
  })
  registerReadOnly(
    "clickup_get_workspace_overview",
    "Return workspace metrics and recent structures. GET /team/{team_id}",
    GetWorkspaceOverviewInput,
    (input, client) => getWorkspaceOverview(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "workspace overview", { scope: "workspace", input: "workspaceId" })
  )
  registerReadOnly(
    "clickup_get_workspace_hierarchy",
    "Fetch nested workspace hierarchy with depth control. GET /team",
    GetWorkspaceHierarchyInput,
    (input, client, config) => getWorkspaceHierarchy(input, client, config, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "workspace tree", { scope: "workspace", input: "workspaceIds|names" }),
    undefined,
    {
      input_examples: [
        {
          workspaceIds: ["12345"],
          maxDepth: 2,
          maxSpacesPerWorkspace: 3
        }
      ]
    }
  )
  registerReadOnly(
    "clickup_resolve_path_to_ids",
    "Resolve hierarchical path names to IDs.",
    ResolvePathToIdsInput,
    (input, client) => resolvePathToIds(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("hierarchy", "path resolve", { scope: "workspace", input: "names", cache: "session|forceRefresh" }),
    undefined,
    {
      input_examples: [
        {
          path: ["Acme Workspace", "Engineering", "Backlog"]
        }
      ]
    }
  )
  registerReadOnly(
    "clickup_list_members",
    "List workspace members. GET /team/{team_id}/member",
    ListMembersInput,
    (input, client, config) => listMembers(input, client, config, sessionCapabilityTracker),
    readOnlyAnnotation("member", "member list", { scope: "workspace", input: "teamId?" })
  )
  registerReadOnly(
    "clickup_resolve_members",
    "Resolve member identifiers to records. GET /team/{team_id}/member",
    ResolveMembersInput,
    (input, client, config) => resolveMembers(input, client, config, sessionMemberDirectory),
    readOnlyAnnotation("member", "member resolve", { scope: "workspace", input: "identifiers", cache: "session|forceRefresh" })
  )
  registerReadOnly(
    "clickup_find_member_by_name",
    "Fuzzy search member names.",
    FindMemberByNameInput,
    (input, client, config) => findMemberByName(input, client, config, sessionMemberDirectory),
    readOnlyAnnotation("member", "member search", { scope: "workspace", input: "query", cache: "session|refresh" })
  )
  registerReadOnly(
    "clickup_resolve_assignees",
    "Translate assignee references into member suggestions.",
    ResolveAssigneesInput,
    (input, client, config) => resolveAssignees(input, client, config, sessionMemberDirectory),
    readOnlyAnnotation("member", "assignee resolve", { scope: "workspace", input: "references" })
  )
  registerReadOnly(
    "clickup_list_tags_for_space",
    "List tags in a space. GET /space/{space_id}/tag",
    ListTagsForSpaceInput,
    (input, client) => listTagsForSpace(input, client, sessionSpaceTagCache),
    readOnlyAnnotation("tag", "space tags", { scope: "space", input: "spaceId", cache: "session|forceRefresh" })
  )

  registerDestructive(
    "clickup_create_space_tag",
    "Create a space tag. POST /space/{space_id}/tag",
    CreateSpaceTagInput,
    async (input, client) => createSpaceTag(input, client, sessionSpaceTagCache),
    destructiveAnnotation("tag", "create space tag", { scope: "space", input: "spaceId", dry: true })
  )
  registerDestructive(
    "clickup_update_space_tag",
    "Update a space tag. PUT /space/{space_id}/tag/{tag_name}",
    UpdateSpaceTagInput,
    async (input, client) => updateSpaceTag(input, client, sessionSpaceTagCache),
    destructiveAnnotation("tag", "update space tag", { scope: "space", input: "spaceId+currentName", dry: true, idempotent: true })
  )
  registerDestructive(
    "clickup_delete_space_tag",
    "Delete a space tag. DELETE /space/{space_id}/tag/{tag_name}",
    DeleteSpaceTagInput,
    async (input, client) => deleteSpaceTag(input, client, sessionSpaceTagCache),
    destructiveAnnotation("tag", "delete space tag", { scope: "space", input: "spaceId+tagName", dry: true })
  )

  // Hierarchy management
  registerDestructive(
    "clickup_create_folder",
    "Create a folder in a space. POST /space/{space_id}/folder",
    CreateFolderInput,
    async (input, client) => createFolder(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "create folder", { scope: "space", input: "spaceId|path", dry: true })
  )
  registerDestructive(
    "clickup_update_folder",
    "Update a folder. PUT /folder/{folder_id}",
    UpdateFolderInput,
    async (input, client) => updateFolder(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "update folder", { scope: "space", input: "folderId|path", dry: true, idempotent: true })
  )
  registerDestructive(
    "clickup_delete_folder",
    "Delete a folder. DELETE /folder/{folder_id}",
    DeleteFolderInput,
    async (input, client) => deleteFolder(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "delete folder", { scope: "space", input: "folderId|path", dry: true })
  )
  registerDestructive(
    "clickup_create_list",
    "Create a list in a space or folder. POST /space/{space_id}/list or POST /folder/{folder_id}/list",
    CreateListInput,
    async (input, client) => createList(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "create list", { scope: "space|folder", input: "spaceId|folderId|path", dry: true })
  )
  registerDestructive(
    "clickup_update_list",
    "Update a list. PUT /list/{list_id}",
    UpdateListInput,
    async (input, client) => updateList(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "update list", { scope: "space|folder", input: "listId|path", dry: true, idempotent: true })
  )
  registerDestructive(
    "clickup_delete_list",
    "Delete a list. DELETE /list/{list_id}",
    DeleteListInput,
    async (input, client) => deleteList(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("hierarchy", "delete list", { scope: "space|folder", input: "listId|path", dry: true })
  )
  registerDestructive(
    "clickup_create_list_view",
    "Create a list view. POST /list/{list_id}/view",
    CreateListViewInput,
    async (input, client) => createListView(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("view", "create list view", { scope: "list", input: "listId|path", dry: true })
  )
  registerDestructive(
    "clickup_create_space_view",
    "Create a space view. POST /space/{space_id}/view",
    CreateSpaceViewInput,
    async (input, client) => createSpaceView(input, client, sessionHierarchyDirectory),
    destructiveAnnotation("view", "create space view", { scope: "space", input: "spaceId|path", dry: true })
  )
  registerDestructive(
    "clickup_update_view",
    "Update a view. PUT /view/{view_id}",
    UpdateViewInput,
    async (input, client) => updateView(input, client),
    destructiveAnnotation("view", "update view", { scope: "view", input: "viewId", dry: true, idempotent: true })
  )
  registerDestructive(
    "clickup_delete_view",
    "Delete a view. DELETE /view/{view_id}",
    DeleteViewInput,
    async (input, client) => deleteView(input, client),
    destructiveAnnotation("view", "delete view", { scope: "view", input: "viewId", dry: true })
  )

  // Reference
  registerReadOnly(
    "clickup_list_reference_links",
    "List public ClickUp API reference links.",
    ListReferenceLinksInput,
    async (input) => listReferenceLinks(input),
    readOnlyAnnotation("reference", "doc link list", { scope: "public", input: "limit" })
  )
  registerReadOnly(
    "clickup_fetch_reference_page",
    "Fetch a public ClickUp API reference page.",
    FetchReferencePageInput,
    async (input, _client, config) => fetchReferencePage(input, config),
    readOnlyAnnotation("reference", "doc fetch", { scope: "public", input: "url", limit: "maxCharacters" })
  )

  // Task tools
  registerDestructive(
    "clickup_create_task",
    "Create a task in a list. POST /list/{list_id}/task",
    CreateTaskInput,
    async (input, client) => createTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "create task", { scope: "list", input: "listId", dry: true }),
    undefined,
    {
      input_examples: [
        {
          listId: "654321",
          name: "Draft onboarding plan",
          description: "Outline steps for new hires",
          tags: ["people"],
          dryRun: true
        }
      ]
    }
  )
  registerDestructive(
    "clickup_create_subtask",
    "Create a subtask in a list. Requires parentTaskId to place the new task under its parent. POST /list/{list_id}/task with parent parameter.",
    CreateSubtaskInput,
    async (input, client) => createTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "create subtask", { scope: "list", input: "listId+parentTaskId", dry: true }),
    undefined,
    {
      input_examples: [
        { listId: "654321", parentTaskId: "parent-1", name: "Write API docs" },
        { listId: "654321", parentTaskId: "parent-1", name: "Draft schema", dryRun: true }
      ]
    }
  )
  registerDestructive(
    "clickup_create_subtasks_bulk",
    "Bulk create subtasks across one or many parents. Provide parentTaskId per entry or via defaults; each subtask is created with the parent field. POST /task/bulk via sequential calls.",
    CreateSubtasksBulkInput,
    async (input, client, config) => createSubtasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk create subtasks", { scope: "task", input: "subtasks[]", dry: true }),
    undefined,
    {
      input_examples: [
        {
          defaults: { listId: "123", parentTaskId: "parent-123" },
          subtasks: [
            { name: "Design" },
            { name: "Build", parentTaskId: "parent-override", listId: "456" }
          ]
        }
      ]
    }
  )
  registerDestructive(
    "clickup_create_tasks_bulk",
    "Bulk create tasks. POST /task/bulk",
    CreateTasksBulkInput,
    async (input, client, config) => createTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk create", { scope: "list", input: "tasks[]", dry: true })
  )
  registerDestructive(
    "clickup_update_task",
    "Update a task. PUT /task/{task_id}",
    UpdateTaskInput,
    async (input, client) => updateTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "update task", { scope: "task", input: "taskId", dry: true, idempotent: true }),
    undefined,
    {
      input_examples: [
        { taskId: "123456", status: "In Progress", priority: 3, confirm: "yes" }
      ]
    }
  )
  registerDestructive(
    "clickup_update_tasks_bulk",
    "Bulk update tasks. PUT /task/bulk",
    UpdateTasksBulkInput,
    async (input, client, config) => updateTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk update", { scope: "task", input: "tasks[]", dry: true, idempotent: true })
  )
  registerDestructive(
    "clickup_delete_task",
    "Delete a task. DELETE /task/{task_id}",
    DeleteTaskInput,
    async (input, client) => deleteTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "delete task", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_delete_tasks_bulk",
    "Bulk delete tasks. DELETE /task/bulk",
    DeleteTasksBulkInput,
    async (input, client, config) => deleteTasksBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk delete", { scope: "task", input: "taskIds", dry: true })
  )
  registerDestructive(
    "clickup_duplicate_task",
    "Duplicate a task. POST /task/{task_id}/duplicate",
    DuplicateTaskInput,
    duplicateTask,
    destructiveAnnotation("task", "duplicate task", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_comment_task",
    "Post a comment on a task. POST /task/{task_id}/comment",
    CommentTaskInput,
    commentTask,
    destructiveAnnotation("task", "comment", { scope: "task", input: "taskId", dry: true }),
    undefined,
    {
      input_examples: [
        { taskId: "123456", comment: "Please review the latest spec", dryRun: true }
      ]
    }
  )
  registerDestructive(
    "clickup_attach_file_to_task",
    "Attach a file to a task. POST /task/{task_id}/attachment",
    AttachFileInput,
    attachFileToTask,
    destructiveAnnotation("task", "attach file", { scope: "task", input: "taskId+file", dry: true })
  )
  registerDestructive(
    "clickup_add_tags_to_task",
    "Add tags to a task. POST /task/{task_id}/tag/{tag_name}",
    AddTagsInput,
    async (input, client) => addTagsToTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "add tags", { scope: "task", input: "taskId+tags", dry: true })
  )
  registerDestructive(
    "clickup_add_tags_bulk",
    "Bulk add tags to tasks. POST /task/tag/bulk",
    AddTagsBulkInput,
    async (input, client, config) => addTagsBulk(input, client, config, sessionTaskCatalogue),
    destructiveAnnotation("task", "bulk add tags", { scope: "task", input: "tasks[]", dry: true })
  )
  registerDestructive(
    "clickup_remove_tags_from_task",
    "Remove tags from a task. DELETE /task/{task_id}/tag/{tag_name}",
    RemoveTagsInput,
    async (input, client) => removeTagsFromTask(input, client, sessionTaskCatalogue),
    destructiveAnnotation("task", "remove tags", { scope: "task", input: "taskId+tags", dry: true })
  )

  registerReadOnly(
    "clickup_search_tasks",
    "Structured task search with filters. Includes tasks in multiple lists by default (include_timl) and supports tag name filters via tags[]. GET /team/{team_id}/task",
    SearchTasksInput,
    async (input, client, config) => {
      const result = await searchTasks(input, client, config, sessionTaskCatalogue)
      return { tasks: result.results, truncated: result.truncated }
    },
    readOnlyAnnotation("task", "search structured", { scope: "workspace", input: "query+filters" }),
    undefined,
    {
      input_examples: [
        { query: "onboarding checklist", listIds: ["321"], tagIds: ["backend"], pageSize: 10 },
        { statuses: ["In Progress"], tagIds: ["priority", "blocked"], includeTasksInMultipleLists: false }
      ]
    }
  )
  registerReadOnly(
    "clickup_fuzzy_search",
    "Fuzzy task search from natural language. GET /team/{team_id}/task",
    FuzzySearchInput,
    async (input, client, config) => {
      const result = await fuzzySearch(input, client, config, sessionTaskCatalogue)
      return { tasks: result.results, guidance: result.guidance }
    },
    readOnlyAnnotation("task", "search fuzzy", { scope: "workspace", input: "query" }),
    undefined,
    {
      input_examples: [{ query: "recent hiring tasks", limit: 5 }]
    }
  )
  registerReadOnly(
    "clickup_bulk_fuzzy_search",
    "Batch fuzzy task searches. GET /team/{team_id}/task",
    BulkFuzzySearchInput,
    async (input, client, config) => {
      const result = await bulkFuzzySearch(input, client, config, sessionTaskCatalogue)
      return { queries: result }
    },
    readOnlyAnnotation("task", "search fuzzy bulk", { scope: "workspace", input: "queries[]" })
  )

  registerReadOnly(
    "clickup_report_tasks_for_container",
    "Summarise task status and priority for a workspace, space, folder or list without returning full task lists.",
    TaskStatusReportInput,
    async (input, client, config) =>
      taskStatusReport(input, client, config, sessionHierarchyDirectory, sessionTaskCatalogue),
    readOnlyAnnotation("reporting", "task status report", { scope: "container", weight: "medium" }),
    undefined,
    {
      input_examples: [
        { listId: "12345" },
        { path: ["Workspace A", "Space B", "Folder C"] },
        { path: ["Workspace A", "Space B", "List D"], tags: ["priority"], assignees: ["alex"] }
      ]
    }
  )

  registerReadOnly(
    "clickup_risk_summary_for_container",
    "Summarise overdue and at-risk tasks within a workspace, space, folder or list. Subtasks are included by default; use includeSubtasks to focus on parent tasks and inspect isSubtask/parentId in results to understand hierarchy.",
    TaskRiskReportInput,
    async (input, client, config) =>
      taskRiskReport(input, client, config, sessionHierarchyDirectory, sessionTaskCatalogue),
    readOnlyAnnotation("reporting", "task risk report", {
      scope: "container",
      weight: "medium",
      window: `${config.defaultRiskWindowDays}d`
    }),
    undefined,
    {
      input_examples: [
        { listId: "12345" },
        { path: ["Workspace A", "Space B"], includeSubtasks: false },
        { path: ["Workspace A", "Space B", "List D"], dueWithinDays: 7 }
      ]
    }
  )

  registerReadOnly(
    "clickup_get_task",
    "Fetch task details including createdDate/updatedDate fields derived from ClickUp timestamps. Subtask cues (isSubtask, parentId, hasSubtasks, subtaskCount) are included; check them before claiming there are no subtasks. GET /task/{task_id}",
    GetTaskInput,
    (input, client, config) => getTask(input, client, config, sessionTaskCatalogue),
    readOnlyAnnotation("task", "task fetch", { scope: "task", input: "taskId|lookup" }),
    undefined,
    {
      input_examples: [
        { taskId: "abc123", detailLimit: 10 },
        {
          taskName: "Prepare release notes",
          context: { tasks: [{ id: "456", name: "Prepare release notes" }] }
        }
      ]
    }
  )
  registerReadOnly(
    "clickup_list_tasks_in_list",
    "List tasks in a list. Tasks linked from other lists are included by default (include_timl=true). Outputs include createdDate derived from ClickUp date_created and hierarchy cues (isSubtask, parentId, hasSubtasks, subtaskCount). Always review hasSubtasks/subtaskCount before asserting there are no subtasks. Results are paginated and may span multiple pages; iterate via the page input to retrieve additional pages. GET /list/{list_id}/task",
    ListTasksInListInput,
    async (input, client, config) => {
      const result = await listTasksInList(input, client, config, sessionTaskCatalogue)
      const rawTasks = (result as any)?.tasks ?? result

      const tasksArray = Array.isArray(rawTasks)
        ? rawTasks
        : rawTasks
          ? [rawTasks]
          : []

      const total = (result as any)?.total ?? tasksArray.length
      const truncated = !!(result as any)?.truncated
      const guidance = (result as any)?.guidance

      return { tasks: tasksArray, total, truncated, guidance }
    },
    readOnlyAnnotation("task", "list tasks", { scope: "list", input: "listId|path" }),
    undefined,
    {
      input_examples: [
        { listId: "12345" },
        { path: ["Workspace", "Space", "List"], includeTasksInMultipleLists: false }
      ]
    }
  )
  registerReadOnly(
    "clickup_get_task_comments",
    "Retrieve task comments. GET /task/{task_id}/comment",
    GetTaskCommentsInput,
    (input, client, config) => getTaskComments(input, client, config, sessionTaskCatalogue),
    readOnlyAnnotation("task", "task comments", { scope: "task", input: "taskId", limit: "limit" })
  )

  registerReadOnly(
    "clickup_list_custom_fields",
    "List custom fields configured for a list. GET /list/{list_id}/field",
    ListCustomFieldsInput,
    (input, client) => listCustomFields(input, client, sessionHierarchyDirectory),
    readOnlyAnnotation("custom-field", "list fields", { scope: "list", input: "listId|path" })
  )

  registerDestructive(
    "clickup_set_task_custom_field_value",
    "Set a custom field value on a task. POST /task/{task_id}/field/{field_id}",
    SetTaskCustomFieldValueInput,
    (input, client) => setTaskCustomFieldValue(input, client, sessionTaskCatalogue),
    destructiveAnnotation("custom-field", "set value", { scope: "task", input: "taskId+fieldId", dry: true })
  )

  registerDestructive(
    "clickup_clear_task_custom_field_value",
    "Clear a custom field value on a task. DELETE /task/{task_id}/field/{field_id}",
    ClearTaskCustomFieldValueInput,
    (input, client) => clearTaskCustomFieldValue(input, client, sessionTaskCatalogue),
    destructiveAnnotation("custom-field", "clear value", {
      scope: "task",
      input: "taskId+fieldId",
      dry: true,
      idempotent: true
    })
  )

  // Docs
  registerDestructive(
    "clickup_create_doc",
    "Create a document in a folder. POST /folder/{folder_id}/doc",
    CreateDocInput,
    async (input, client, config) => createDoc(input, client, config, sessionCapabilityTracker),
    destructiveAnnotation("doc", "create doc", { scope: "folder", input: "folderId", dry: true }),
    { requiresDocs: true }
  )
  registerReadOnly(
    "clickup_list_documents",
    "List documents with filters. GET /team/{team_id}/doc",
    ListDocumentsInput,
    (input, client, config) => listDocuments(input, client, config, sessionCapabilityTracker),
    readOnlyAnnotation("doc", "doc list", { scope: "workspace", input: "filters" }),
    { requiresDocs: true }
  )
  registerReadOnly(
    "clickup_get_document",
    "Fetch document metadata and pages. GET /team/{team_id}/doc/{doc_id}",
    GetDocumentInput,
    (input, client, config) => getDocument(input, client, config, sessionCapabilityTracker),
    readOnlyAnnotation("doc", "doc fetch", { scope: "doc", input: "docId", limit: "previewCharLimit" }),
    { requiresDocs: true }
  )
  registerReadOnly(
    "clickup_get_document_pages",
    "Fetch selected document pages. POST /doc/{doc_id}/page/bulk",
    GetDocumentPagesInput,
    (input, client, config) => getDocumentPages(input, client, config, sessionCapabilityTracker),
    readOnlyAnnotation("doc", "doc pages fetch", { scope: "doc", input: "docId+pageIds", limit: "previewCharLimit" }),
    { requiresDocs: true }
  )
  registerReadOnly(
    "clickup_list_doc_pages",
    "List page hierarchy for a document. GET /doc/{doc_id}/page",
    ListDocPagesInput,
    (input, client, config) => listDocPages(input, client, config, sessionCapabilityTracker),
    readOnlyAnnotation("doc", "doc page list", { scope: "doc", input: "docId" }),
    { requiresDocs: true }
  )
  registerReadOnly(
    "clickup_get_doc_page",
    "Fetch a single document page. GET /doc/{doc_id}/page/{page_id}",
    GetDocPageInput,
    (input, client, config) => getDocPage(input, client, config, sessionCapabilityTracker),
    readOnlyAnnotation("doc", "doc page fetch", { scope: "doc", input: "docId+pageId" }),
    { requiresDocs: true },
    {
      input_examples: [{ docId: "doc-123", pageId: "page-2" }]
    }
  )
  registerDestructive(
    "clickup_create_document_page",
    "Create a document page. POST /doc/{doc_id}/page",
    CreateDocumentPageInput,
    (input, client, config) => createDocumentPage(input, client, config, sessionCapabilityTracker),
    destructiveAnnotation("doc", "create page", { scope: "doc", input: "docId", dry: true }),
    { requiresDocs: true },
    {
      input_examples: [
        {
          docId: "doc-123",
          title: "Retrospective notes",
          content: "Action items to follow up",
          parentId: "page-1",
          position: 0,
          dryRun: true
        }
      ]
    }
  )
  registerDestructive(
    "clickup_update_doc_page",
    "Update a document page. PUT /doc/{doc_id}/page/{page_id}",
    UpdateDocPageInput,
    (input, client, config) => updateDocPage(input, client, config, sessionCapabilityTracker),
    destructiveAnnotation("doc", "update page", { scope: "doc", input: "docId+pageId", dry: true, idempotent: true }),
    { requiresDocs: true }
  )
  registerReadOnly(
    "clickup_doc_search",
    "Search document content. GET /team/{team_id}/doc",
    DocSearchInput,
    async (input, client, config) => {
      const result = await docSearch(input, client, config, sessionCapabilityTracker)
      if (isDocCapabilityError(result)) {
        return result
      }
      return { docs: result.docs, expandedPages: result.expandedPages, guidance: result.guidance }
    },
    readOnlyAnnotation("doc", "doc search", { scope: "workspace", input: "query", option: "expandPages" }),
    { requiresDocs: true },
    {
      input_examples: [
        { workspaceId: "12345", query: "Q3 roadmap", limit: 5, expandPages: true }
      ]
    }
  )
  registerReadOnly(
    "clickup_bulk_doc_search",
    "Batch document searches. GET /team/{team_id}/doc",
    BulkDocSearchInput,
    async (input, client, config) => {
      const result = await bulkDocSearch(input, client, config, sessionCapabilityTracker)
      if (isDocCapabilityError(result)) {
        return result
      }
      return { queries: result }
    },
    readOnlyAnnotation("doc", "doc search bulk", { scope: "workspace", input: "queries[]" }),
    { requiresDocs: true }
  )

  // Time tracking
  registerDestructive(
    "clickup_start_timer",
    "Start a timer on a task. POST /task/{task_id}/time",
    StartTimerInput,
    startTimer,
    destructiveAnnotation("time", "start timer", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_stop_timer",
    "Stop the running timer for a task. POST /task/{task_id}/time",
    StopTimerInput,
    stopTimer,
    destructiveAnnotation("time", "stop timer", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_create_time_entry",
    "Create a manual time entry. POST /task/{task_id}/time",
    CreateTimeEntryInput,
    createTimeEntry,
    destructiveAnnotation("time", "create entry", { scope: "task", input: "taskId", dry: true })
  )
  registerDestructive(
    "clickup_update_time_entry",
    "Update a time entry. PUT /team/{team_id}/time_entries/{timer_id}",
    UpdateTimeEntryInput,
    (input, client, config) => updateTimeEntry(input, client, config),
    destructiveAnnotation("time", "update entry", { scope: "time", input: "entryId", dry: true, idempotent: true })
  )
  registerDestructive(
    "clickup_delete_time_entry",
    "Delete a time entry. DELETE /team/{team_id}/time_entries/{timer_id}",
    DeleteTimeEntryInput,
    (input, client, config) => deleteTimeEntry(input, client, config),
    destructiveAnnotation("time", "delete entry", { scope: "time", input: "entryId", dry: true })
  )

  registerReadOnly(
    "clickup_get_task_time_entries",
    "Fetch time entries for a task. GET /task/{task_id}/time",
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
    "Retrieve the current running timer. GET /team/{team_id}/time_entries/current",
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
    "List time entries with filters. GET /team/{team_id}/time_entries. Accepts ISO 8601 or epoch (seconds/milliseconds) boundaries.",
    ListTimeEntriesInput,
    async (input, client, config) => {
      const result = await listTimeEntries(input, client, config)
      return { entries: result.entries, truncated: result.truncated }
    },
    readOnlyAnnotation("time", "entry list", { scope: "workspace", input: "filters" }),
    undefined,
    {
      input_examples: [
        { from: "2024-05-01T00:00:00Z", to: "2024-05-07T00:00:00Z", pageSize: 10 }
      ]
    }
  )
  registerReadOnly(
    "clickup_report_time_for_tag",
    "Aggregate logged time for a tag.",
    ReportTimeForTagInput,
    reportTimeForTag,
    readOnlyAnnotation("time", "tag report", { scope: "workspace", input: "tag", window: "from|to" })
  )
  registerReadOnly(
    "clickup_report_time_for_container",
    "Aggregate time for a container.",
    ReportTimeForContainerInput,
    reportTimeForContainer,
    readOnlyAnnotation("time", "container report", { scope: "space|folder|list", input: "containerId", window: "from|to" }),
    undefined,
    {
      input_examples: [
        { containerId: "list-123", from: "2024-04-01T00:00:00Z", to: "2024-04-08T00:00:00Z" }
      ]
    }
  )
  registerReadOnly(
    "clickup_report_time_for_space_tag",
    "Aggregate time for a tag in a space.",
    ReportTimeForSpaceTagInput,
    reportTimeForSpaceTag,
    readOnlyAnnotation("time", "space tag report", { scope: "space", input: "spaceId+tag", window: "from|to" })
  )
}
