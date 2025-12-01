import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { ClickUpClient } from "../infrastructure/clickup/ClickUpClient.js"
import { listWorkspaces } from "../application/usecases/hierarchy/ListWorkspaces.js"
import { listSpaces } from "../application/usecases/hierarchy/ListSpaces.js"
import { listFolders } from "../application/usecases/hierarchy/ListFolders.js"
import { listLists } from "../application/usecases/hierarchy/ListLists.js"
import { getWorkspaceHierarchy } from "../application/usecases/hierarchy/GetWorkspaceHierarchy.js"
import { listTasksInList } from "../application/usecases/tasks/ListTasksInList.js"
import { listDocuments } from "../application/usecases/docs/ListDocuments.js"
import { getDocument } from "../application/usecases/docs/GetDocument.js"
import { getDocumentPages } from "../application/usecases/docs/GetDocumentPages.js"
import {
  ensureDocsCapability,
  isDocCapabilityError,
  isDocsCapabilityUnavailableError
} from "../application/services/DocCapability.js"
import { HierarchyDirectory } from "../application/services/HierarchyDirectory.js"
import { TaskCatalogue } from "../application/services/TaskCatalogue.js"
import { CapabilityTracker } from "../application/services/CapabilityTracker.js"
import { SessionCache } from "../application/services/SessionCache.js"

type Identifiable = Record<string, unknown>

function resolveId(entity: Identifiable, keys: string[]) {
  for (const key of keys) {
    const value = entity[key]
    if (typeof value === "string" && value) {
      return value
    }
    if (typeof value === "number") {
      return String(value)
    }
  }
  return undefined
}

function resolveName(entity: Identifiable, fallbacks: string[]) {
  for (const key of fallbacks) {
    const value = entity[key]
    if (typeof value === "string" && value.trim() !== "") {
      return value
    }
  }
  return undefined
}

function formatResourceContent(uri: URL, payload: unknown) {
  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  }
}

export function registerResources(server: McpServer, config: ApplicationConfig, sessionCache: SessionCache) {
  const createClient = () => new ClickUpClient(config.apiKey)
  const hierarchyDirectory = new HierarchyDirectory(
    config.hierarchyCacheTtlMs,
    sessionCache,
    config.teamId
  )
  const taskCatalogue = new TaskCatalogue()
  const capabilityTracker = new CapabilityTracker()

  const workspaceTemplate = new ResourceTemplate("clickup://workspace/{workspaceId}/hierarchy", {
    list: async () => {
      const client = createClient()
      const { workspaces } = await listWorkspaces(client, hierarchyDirectory)
      const resources = workspaces
        .map((workspace) => {
          const workspaceId =
            resolveId(workspace, ["id", "team_id", "teamId", "workspace_id", "workspaceId"]) ?? config.teamId
          const workspaceName = resolveName(workspace, ["name", "team_name", "workspace_name"]) ?? workspaceId
          const uri = `clickup://workspace/${encodeURIComponent(workspaceId)}/hierarchy`
          return {
            name: `workspace-${workspaceId}`,
            uri,
            title: workspaceName,
            description: `Hierarchy for workspace ${workspaceName}`
          }
        })
        .filter((resource) => Boolean(resource.uri))
      return { resources }
    }
  })

  server.registerResource(
    "clickup-workspace-hierarchy",
    workspaceTemplate,
    { description: "Browse ClickUp workspaces and nested hierarchy." },
    async (uri, variables) => {
      const client = createClient()
      const workspaceId = (variables.workspaceId as string | undefined) ?? config.teamId
      const hierarchy = await getWorkspaceHierarchy(
        { workspaceIds: [workspaceId], maxDepth: 3 },
        client,
        config,
        hierarchyDirectory
      )
      return formatResourceContent(uri, hierarchy)
    }
  )

  const listsTemplate = new ResourceTemplate("clickup://space/{spaceId}/list/{listId}", {
    list: async () => {
      const client = createClient()
      const { workspaces } = await listWorkspaces(client, hierarchyDirectory)
      const resources: Array<{ name: string; uri: string; title?: string; description?: string }> = []

      for (const workspace of workspaces) {
        const workspaceId =
          resolveId(workspace, ["id", "team_id", "teamId", "workspace_id", "workspaceId"]) ?? config.teamId
        const spacesResult = await listSpaces({ workspaceId }, client, hierarchyDirectory)
        for (const space of spacesResult.spaces) {
          const spaceId = resolveId(space as Identifiable, ["id", "space_id", "spaceId"])
          if (!spaceId) continue
          const spaceName =
            resolveName(space as Identifiable, ["name", "space_name"]) ?? `Space ${spaceId}`

          const directLists = await listLists({ spaceId }, client, hierarchyDirectory)
          for (const list of directLists.lists) {
            const listId = resolveId(list as Identifiable, ["id", "list_id", "listId"])
            if (!listId) continue
            const listName = resolveName(list as Identifiable, ["name", "list_name", "title"]) ?? `List ${listId}`
            resources.push({
              name: `space-${spaceId}-list-${listId}`,
              uri: `clickup://space/${encodeURIComponent(spaceId)}/list/${encodeURIComponent(listId)}`,
              title: listName,
              description: `${spaceName} (${listId})`
            })
          }

          const folders = await listFolders({ spaceId }, client, hierarchyDirectory)
          for (const folder of folders.folders) {
            const folderId = resolveId(folder as Identifiable, ["id", "folder_id", "folderId"])
            if (!folderId) continue
            const folderLists = await listLists({ folderId }, client, hierarchyDirectory)
            for (const list of folderLists.lists) {
              const listId = resolveId(list as Identifiable, ["id", "list_id", "listId"])
              if (!listId) continue
              const listName = resolveName(list as Identifiable, ["name", "list_name", "title"]) ?? `List ${listId}`
              resources.push({
                name: `space-${spaceId}-folder-${folderId}-list-${listId}`,
                uri: `clickup://space/${encodeURIComponent(spaceId)}/list/${encodeURIComponent(listId)}`,
                title: listName,
                description: `${spaceName} folder ${folderId}`
              })
            }
          }
        }
      }
      return { resources }
    }
  })

  server.registerResource(
    "clickup-lists",
    listsTemplate,
    { description: "List ClickUp lists and preview their tasks." },
    async (uri, variables) => {
      const client = createClient()
      const spaceId = variables.spaceId as string
      const listId = variables.listId as string
      const result = await listTasksInList(
        {
          listId,
          limit: 5,
          page: 0,
          includeClosed: false,
          includeSubtasks: true,
          includeTasksInMultipleLists: false,
          assigneePreviewLimit: 5
        },
        client,
        config,
        taskCatalogue
      )

      const rawTasks = (result as any)?.tasks ?? result
      const tasksArray = Array.isArray(rawTasks) ? rawTasks : rawTasks ? [rawTasks] : []
      const total = (result as any)?.total ?? tasksArray.length
      const truncated = !!(result as any)?.truncated
      const guidance = (result as any)?.guidance

      return formatResourceContent(uri, {
        listId,
        spaceId,
        tasks: tasksArray,
        total,
        truncated,
        guidance
      })
    }
  )

  const docsTemplate = new ResourceTemplate("clickup://doc/{docId}", {
    list: async () => {
      const client = createClient()
      try {
        await ensureDocsCapability(config.teamId, client, capabilityTracker)
      } catch (error) {
        if (isDocsCapabilityUnavailableError(error)) {
          return { resources: [] }
        }
      }

      const docs = await listDocuments(
        {
          workspaceId: config.teamId,
          limit: 10,
          includePreviews: true,
          previewPageLimit: 3,
          previewCharLimit: config.charLimit
        },
        client,
        config,
        capabilityTracker
      )

      if (isDocCapabilityError(docs)) {
        return { resources: [] }
      }

      const resources: Array<{ name: string; uri: string; title?: string; description?: string }> = []

      for (const entry of docs.documents) {
        const docId = entry.summary.docId
        const docTitle = entry.summary.name ?? `Doc ${docId}`
        const docUri = `clickup://doc/${encodeURIComponent(docId)}`
        resources.push({
          name: `doc-${docId}`,
          uri: docUri,
          title: docTitle,
          description: entry.summary.hierarchy.path
        })

        entry.summary.pagePreviews.slice(0, 3).forEach((preview) => {
          const pageUri = `${docUri}?pageId=${encodeURIComponent(preview.pageId)}`
          const pageTitle = preview.title ?? `Page ${preview.pageId}`
          resources.push({
            name: `doc-${docId}-page-${preview.pageId}`,
            uri: pageUri,
            title: `${docTitle} / ${pageTitle}`,
            description: preview.preview
          })
        })
      }

      return { resources }
    }
  })

  server.registerResource(
    "clickup-docs",
    docsTemplate,
    { description: "Browse ClickUp docs and pages with previews." },
    async (uri, variables) => {
      const client = createClient()
      const docId = variables.docId as string
      const searchParams = new URL(uri.toString()).searchParams
      const pageId = searchParams.get("pageId") ?? undefined

      if (pageId) {
        const pages = await getDocumentPages(
          { workspaceId: config.teamId, docId, pageIds: [pageId], previewCharLimit: config.charLimit },
          client,
          config,
          capabilityTracker
        )
        return formatResourceContent(uri, pages)
      }

      const doc = await getDocument(
        { workspaceId: config.teamId, docId, includePages: true, pageLimit: 3, previewCharLimit: config.charLimit },
        client,
        config,
        capabilityTracker
      )
      return formatResourceContent(uri, doc)
    }
  )
}
