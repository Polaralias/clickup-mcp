import { z } from "zod"
import { GetWorkspaceHierarchyInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import { truncateList } from "../../limits/truncation.js"
import { listWorkspaces } from "./ListWorkspaces.js"
import { listSpaces } from "./ListSpaces.js"
import { listFolders } from "./ListFolders.js"
import { listLists } from "./ListLists.js"

const DEFAULT_MAX_WORKSPACES = 3
const DEFAULT_MAX_SPACES_PER_WORKSPACE = 6
const DEFAULT_MAX_FOLDERS_PER_SPACE = 6
const DEFAULT_MAX_LISTS_PER_SPACE = 6
const DEFAULT_MAX_LISTS_PER_FOLDER = 6
const DEFAULT_MAX_DEPTH = 3
const DEFAULT_CONCURRENCY = 4

const MAX_DEPTH = 3

type Input = z.infer<typeof GetWorkspaceHierarchyInput>

type Container<T> = {
  items: T[]
  truncated: boolean
  guidance?: string
}

type ListNode = {
  list: Record<string, unknown>
}

type FolderNode = {
  folder: Record<string, unknown>
  lists?: Container<ListNode>
}

type SpaceNode = {
  space: Record<string, unknown>
  lists?: Container<ListNode>
  folders?: Container<FolderNode>
}

type WorkspaceNode = {
  workspace: Record<string, unknown>
  spaces?: Container<SpaceNode>
}

type Result = {
  workspaces: Container<WorkspaceNode>
  unmatchedSelectors?: Array<{ id?: string; name?: string }>
  shape: {
    layers: Array<{ level: string; path: string; description: string }>
    containerFields: ["items", "truncated", "guidance"]
  }
}

type WorkspaceSelector = { id?: string; name?: string }

type WorkspaceContext = {
  workspaceNode: WorkspaceNode
  workspaceId: string | undefined
}

type SpaceContext = {
  workspaceNode: WorkspaceNode
  spaceNode: SpaceNode
  spaceId: string | undefined
}

type FolderContext = {
  spaceNode: SpaceNode
  folderNode: FolderNode
  folderId: string | undefined
}

function parsePositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }
  return undefined
}

function resolveConcurrency(override?: number) {
  const parsedOverride = parsePositiveInt(override)
  if (parsedOverride) {
    return parsedOverride
  }
  const envCandidates = [process.env.MAX_HIERARCHY_CONCURRENCY, process.env.MAX_BULK_CONCURRENCY]
  for (const candidate of envCandidates) {
    const parsed = parsePositiveInt(candidate)
    if (parsed) {
      return parsed
    }
  }
  return DEFAULT_CONCURRENCY
}

function ensureArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }
  return []
}

function resolveWorkspaceId(workspace: Record<string, unknown>) {
  const candidates = ["id", "team_id", "teamId", "workspace_id", "workspaceId"]
  for (const key of candidates) {
    const value = workspace[key]
    if (typeof value === "string" && value) {
      return value
    }
    if (typeof value === "number") {
      return String(value)
    }
  }
  return undefined
}

function resolveSpaceId(space: Record<string, unknown>) {
  const candidates = ["id", "space_id", "spaceId"]
  for (const key of candidates) {
    const value = space[key]
    if (typeof value === "string" && value) {
      return value
    }
    if (typeof value === "number") {
      return String(value)
    }
  }
  return undefined
}

function resolveFolderId(folder: Record<string, unknown>) {
  const candidates = ["id", "folder_id", "folderId"]
  for (const key of candidates) {
    const value = folder[key]
    if (typeof value === "string" && value) {
      return value
    }
    if (typeof value === "number") {
      return String(value)
    }
  }
  return undefined
}

function resolveName(entity: Record<string, unknown>) {
  const candidates = ["name", "team_name", "space_name", "folder_name", "list_name", "title"]
  for (const key of candidates) {
    const value = entity[key]
    if (typeof value === "string" && value.trim() !== "") {
      return value
    }
  }
  return undefined
}

function describeEntity(entity: Record<string, unknown>, fallback: string) {
  const name = resolveName(entity)
  const id =
    resolveWorkspaceId(entity) ??
    resolveSpaceId(entity) ??
    resolveFolderId(entity) ??
    (typeof entity.id === "string"
      ? entity.id
      : typeof entity.id === "number"
        ? String(entity.id)
        : undefined)
  if (typeof name === "string") {
    return `${fallback} "${name}"`
  }
  if (typeof id === "string" && id) {
    return `${fallback} ${id}`
  }
  return fallback
}

function limitGuidance(kind: string, context: string, limit: number) {
  return `Only the first ${limit} ${kind} were returned for ${context}. Narrow the scope or request a higher limit if you need more detail.`
}

function depthGuidance(kind: string, context: string, maxDepth: number, required: number) {
  return `${kind} for ${context} were not loaded because maxDepth is ${maxDepth}. Increase maxDepth to at least ${required} to drill further.`
}

function buildContainer<T>(items: T[], truncated: boolean, guidance?: string): Container<T> {
  return {
    items,
    truncated,
    guidance
  }
}

function createDepthSkippedContainer<T>(kind: string, context: string, maxDepth: number, required: number): Container<T> {
  return buildContainer([], true, depthGuidance(kind, context, maxDepth, required))
}

function normaliseSelectors(input: Input, config: ApplicationConfig): WorkspaceSelector[] {
  const selectors: WorkspaceSelector[] = []
  if (Array.isArray(input.workspaces)) {
    for (const item of input.workspaces) {
      if (item?.id || item?.name) {
        selectors.push({ id: item.id ?? undefined, name: item.name ?? undefined })
      }
    }
  }
  if (Array.isArray(input.workspaceIds)) {
    for (const id of input.workspaceIds) {
      if (typeof id === "string" && id.trim() !== "") {
        selectors.push({ id })
      }
    }
  }
  if (Array.isArray(input.workspaceNames)) {
    for (const name of input.workspaceNames) {
      if (typeof name === "string" && name.trim() !== "") {
        selectors.push({ name })
      }
    }
  }
  if (selectors.length === 0 && config.defaultTeamId) {
    selectors.push({ id: config.defaultTeamId })
  }
  return selectors
}

export async function getWorkspaceHierarchy(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const maxDepth = Math.min(input.maxDepth ?? DEFAULT_MAX_DEPTH, MAX_DEPTH)
  const workspaceLimit = input.maxWorkspaces ?? DEFAULT_MAX_WORKSPACES
  const spacesLimit = input.maxSpacesPerWorkspace ?? DEFAULT_MAX_SPACES_PER_WORKSPACE
  const foldersLimit = input.maxFoldersPerSpace ?? DEFAULT_MAX_FOLDERS_PER_SPACE
  const listsPerSpaceLimit = input.maxListsPerSpace ?? DEFAULT_MAX_LISTS_PER_SPACE
  const listsPerFolderLimit = input.maxListsPerFolder ?? DEFAULT_MAX_LISTS_PER_FOLDER
  const concurrency = resolveConcurrency(input.concurrency)

  const selectors = normaliseSelectors(input, config)

  const { workspaces: rawWorkspaces } = await listWorkspaces(client)
  const allWorkspaces = ensureArray(rawWorkspaces)

  const workspaceById = new Map<string, Record<string, unknown>>()
  const workspaceByName = new Map<string, Record<string, unknown>>()
  for (const workspace of allWorkspaces) {
    if (!workspace || typeof workspace !== "object") continue
    const typedWorkspace = workspace as Record<string, unknown>
    const id = resolveWorkspaceId(typedWorkspace)
    if (id) {
      workspaceById.set(id, typedWorkspace)
    }
    const name = resolveName(typedWorkspace)
    if (name) {
      const key = name.toLowerCase()
      if (!workspaceByName.has(key)) {
        workspaceByName.set(key, typedWorkspace)
      }
    }
  }

  const unmatchedSelectors: WorkspaceSelector[] = []
  const matchedWorkspaces: Record<string, unknown>[] = []
  const seenWorkspaceIds = new Set<string>()

  if (selectors.length > 0) {
    for (const selector of selectors) {
      let match: Record<string, unknown> | undefined
      if (selector.id) {
        match = workspaceById.get(selector.id)
      }
      if (!match && selector.name) {
        match = workspaceByName.get(selector.name.toLowerCase())
      }
      if (match) {
        const id = resolveWorkspaceId(match)
        if (!id || !seenWorkspaceIds.has(id)) {
          matchedWorkspaces.push(match)
          if (id) {
            seenWorkspaceIds.add(id)
          }
        }
      } else {
        unmatchedSelectors.push(selector)
      }
    }
  } else {
    for (const workspace of allWorkspaces) {
      if (!workspace || typeof workspace !== "object") continue
      const typedWorkspace = workspace as Record<string, unknown>
      const id = resolveWorkspaceId(typedWorkspace)
      if (id && seenWorkspaceIds.has(id)) {
        continue
      }
      if (id) {
        seenWorkspaceIds.add(id)
      }
      matchedWorkspaces.push(typedWorkspace)
    }
  }

  const { items: limitedWorkspaces, truncated: workspacesTruncated } = truncateList(matchedWorkspaces, workspaceLimit)
  const workspaceNodes: WorkspaceNode[] = limitedWorkspaces.map((workspace) => ({ workspace }))
  const workspaceContainer = buildContainer(
    workspaceNodes,
    workspacesTruncated,
    workspacesTruncated ? limitGuidance("workspaces", "the account", workspaceLimit) : undefined
  )

  const workspaceContexts: WorkspaceContext[] = workspaceNodes.map((workspaceNode) => ({
    workspaceNode,
    workspaceId: resolveWorkspaceId(workspaceNode.workspace)
  }))

  if (maxDepth >= 1 && workspaceContexts.length > 0) {
    const spacesProcessor = new BulkProcessor<WorkspaceContext, { workspaceNode: WorkspaceNode; spaces: Container<SpaceNode> }>(
      concurrency
    )
    const spacesResults = await spacesProcessor.run(workspaceContexts, async (context) => {
      const { workspaceNode, workspaceId } = context
      if (!workspaceId) {
        return {
          workspaceNode,
          spaces: buildContainer([], false)
        }
      }
      const spaceResponse = await listSpaces({ workspaceId }, client)
      const spaces = ensureArray(spaceResponse.spaces)
      const { items, truncated } = truncateList(spaces, spacesLimit)
      const spaceNodes = items.map((space) => ({ space }))
      const workspaceDescription = describeEntity(workspaceNode.workspace, "workspace")
      const guidance = truncated ? limitGuidance("spaces", workspaceDescription, spacesLimit) : undefined
      return {
        workspaceNode,
        spaces: buildContainer(spaceNodes, truncated, guidance)
      }
    })
    const spaceContexts: SpaceContext[] = []
    for (const result of spacesResults) {
      const { workspaceNode, spaces } = result
      workspaceNode.spaces = spaces
      for (const spaceNode of spaces.items) {
        spaceContexts.push({
          workspaceNode,
          spaceNode,
          spaceId: resolveSpaceId(spaceNode.space)
        })
      }
    }

    if (spaceContexts.length > 0) {
      if (maxDepth >= 2) {
        const spaceProcessor = new BulkProcessor<SpaceContext, {
          spaceNode: SpaceNode
          lists: Container<ListNode>
          folders: Container<FolderNode>
          folderContexts: FolderContext[]
        }>(concurrency)
        const spaceResults = await spaceProcessor.run(spaceContexts, async (context) => {
          const { spaceNode, spaceId } = context
          const spaceDescription = describeEntity(spaceNode.space, "space")
          if (!spaceId) {
            return {
              spaceNode,
              lists: buildContainer([], false),
              folders: buildContainer([], false),
              folderContexts: []
            }
          }
          const listsResponse = await listLists({ spaceId }, client)
          const spaceLists = ensureArray(listsResponse.lists)
          const { items: limitedLists, truncated: listsTruncated } = truncateList(spaceLists, listsPerSpaceLimit)
          const listNodes = limitedLists.map((list) => ({ list }))
          const listGuidance = listsTruncated
            ? limitGuidance("lists", spaceDescription, listsPerSpaceLimit)
            : undefined

          const foldersResponse = await listFolders({ spaceId }, client)
          const spaceFolders = ensureArray(foldersResponse.folders)
          const { items: limitedFolders, truncated: foldersTruncated } = truncateList(spaceFolders, foldersLimit)
          const folderNodes = limitedFolders.map((folder) => ({ folder }))
          const folderGuidance = foldersTruncated
            ? limitGuidance("folders", spaceDescription, foldersLimit)
            : undefined

          const folderContexts: FolderContext[] = folderNodes.map((folderNode) => ({
            spaceNode,
            folderNode,
            folderId: resolveFolderId(folderNode.folder)
          }))

          return {
            spaceNode,
            lists: buildContainer(listNodes, listsTruncated, listGuidance),
            folders: buildContainer(folderNodes, foldersTruncated, folderGuidance),
            folderContexts
          }
        })

        const folderContexts: FolderContext[] = []
        for (const result of spaceResults) {
          const { spaceNode, lists, folders, folderContexts: contexts } = result
          spaceNode.lists = lists
          spaceNode.folders = folders
          folderContexts.push(...contexts)
        }

        if (folderContexts.length > 0) {
          if (maxDepth >= 3) {
            const folderProcessor = new BulkProcessor<FolderContext, { folderNode: FolderNode; lists: Container<ListNode> }>(
              concurrency
            )
            const folderResults = await folderProcessor.run(folderContexts, async (context) => {
              const { folderNode, folderId } = context
              const folderDescription = describeEntity(folderNode.folder, "folder")
              if (!folderId) {
                return {
                  folderNode,
                  lists: buildContainer([], false)
                }
              }
              const listsResponse = await listLists({ folderId }, client)
              const folderLists = ensureArray(listsResponse.lists)
              const { items: limitedLists, truncated } = truncateList(folderLists, listsPerFolderLimit)
              const listNodes = limitedLists.map((list) => ({ list }))
              const guidance = truncated
                ? limitGuidance("lists", folderDescription, listsPerFolderLimit)
                : undefined
              return {
                folderNode,
                lists: buildContainer(listNodes, truncated, guidance)
              }
            })
            for (const result of folderResults) {
              const { folderNode, lists } = result
              folderNode.lists = lists
            }
          } else {
            for (const context of folderContexts) {
              const folderDescription = describeEntity(context.folderNode.folder, "folder")
              context.folderNode.lists = createDepthSkippedContainer(
                "lists",
                folderDescription,
                maxDepth,
                3
              )
            }
          }
        }
      } else {
        for (const context of spaceContexts) {
          const description = describeEntity(context.spaceNode.space, "space")
          context.spaceNode.lists = createDepthSkippedContainer("lists", description, maxDepth, 2)
          context.spaceNode.folders = createDepthSkippedContainer("folders", description, maxDepth, 2)
        }
      }
    }
  } else {
    for (const context of workspaceContexts) {
      const workspaceDescription = describeEntity(context.workspaceNode.workspace, "workspace")
      context.workspaceNode.spaces = createDepthSkippedContainer("spaces", workspaceDescription, maxDepth, 1)
    }
  }

  return {
    workspaces: workspaceContainer,
    unmatchedSelectors: unmatchedSelectors.length > 0 ? unmatchedSelectors : undefined,
    shape: {
      layers: [
        {
          level: "workspace",
          path: "workspaces.items[].workspace",
          description: "Workspace/team metadata as returned by ClickUp."
        },
        {
          level: "space",
          path: "workspaces.items[].spaces.items[].space",
          description: "Spaces within the workspace."
        },
        {
          level: "space_lists",
          path: "workspaces.items[].spaces.items[].lists.items[].list",
          description: "Lists that live directly within a space (no folder)."
        },
        {
          level: "folder",
          path: "workspaces.items[].spaces.items[].folders.items[].folder",
          description: "Folders within a space."
        },
        {
          level: "folder_lists",
          path: "workspaces.items[].spaces.items[].folders.items[].lists.items[].list",
          description: "Lists contained inside a folder."
        }
      ],
      containerFields: ["items", "truncated", "guidance"]
    }
  }
}
