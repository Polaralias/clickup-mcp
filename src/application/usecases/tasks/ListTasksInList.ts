import { z } from "zod"
import { ListTasksInListInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { SearchParams } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { truncateList } from "../../limits/truncation.js"
import { resolveTaskReference, normaliseTaskRecord } from "./resolveTaskReference.js"
import type { TaskResolution } from "./resolveTaskReference.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import type { TaskResolutionRecord } from "./resolveTaskReference.js"

type Input = z.infer<typeof ListTasksInListInput>

type TaskMember = {
  id: string
  username?: string
  email?: string
}

type TaskListItem = {
  id: string
  name?: string
  status?: string
  dueDate?: string
  startDate?: string
  priority?: string
  url: string
  assignees: TaskMember[]
  assigneesTruncated: boolean
}

type Result = {
  list: {
    id: string
    name?: string
    url?: string
  }
  tasks: TaskListItem[]
  truncated: boolean
  total: number
  page: number
  resolution: {
    method: "direct" | "task-context" | "task-fetch"
    task?: {
      id: string
      method: TaskResolution["method"]
      matchedName?: string
      score?: number
      usedContext: boolean
    }
  }
  filters: {
    includeClosed: boolean
    includeSubtasks: boolean
    includeTasksInMultipleLists: boolean
  }
  guidance?: string
}

function toIsoDate(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString()
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Date(parsed).toISOString()
    }
  }
  return undefined
}

function mapMember(candidate: unknown): TaskMember | undefined {
  if (!candidate || typeof candidate !== "object") {
    return undefined
  }
  const raw = candidate as Record<string, unknown>
  const id = raw.id ?? raw.user_id ?? raw.member_id ?? raw.userId
  if (!id) {
    return undefined
  }
  const username =
    typeof raw.username === "string"
      ? raw.username
      : typeof raw.name === "string"
        ? raw.name
        : undefined
  const email =
    typeof raw.email === "string"
      ? raw.email
      : typeof raw.user_email === "string"
        ? raw.user_email
        : undefined
  return { id: String(id), username, email }
}

function mapTask(task: any, assigneeLimit: number): TaskListItem | undefined {
  const id = task?.id ?? task?.task_id
  if (!id) {
    return undefined
  }
  const assigneeCandidates: unknown[] = Array.isArray(task?.assignees) ? task.assignees : []
  const assigneeRecords = assigneeCandidates
    .map((member) => mapMember(member))
    .filter((member): member is TaskMember => Boolean(member))
  const { items: assignees, truncated: assigneesTruncated } = truncateList<TaskMember>(assigneeRecords, assigneeLimit)
  const status =
    typeof task?.status === "string"
      ? task.status
      : typeof task?.status === "object" && task.status && typeof task.status.status === "string"
        ? task.status.status
        : undefined
  const priority =
    typeof task?.priority === "string"
      ? task.priority
      : typeof task?.priority === "object" && task.priority
        ? (task.priority as any).priority ?? (task.priority as any).label
        : undefined
  const url = typeof task?.url === "string" ? task.url : `https://app.clickup.com/t/${id}`
  return {
    id: String(id),
    name: typeof task?.name === "string" ? task.name : undefined,
    status,
    dueDate: toIsoDate(task?.due_date ?? task?.dueDate),
    startDate: toIsoDate(task?.start_date ?? task?.date_started),
    priority,
    url,
    assignees,
    assigneesTruncated
  }
}

type ListResolution = {
  listId: string
  listName?: string
  listUrl?: string
  method: "direct" | "task-context" | "task-fetch"
  taskResolution?: TaskResolution
}

async function resolveListDetails(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<ListResolution> {
  if (input.listId) {
    return { listId: input.listId, method: "direct" }
  }
  const resolution = resolveTaskReference({
    taskId: input.taskId,
    taskName: input.taskName,
    context: input.context
  }, catalogue)
  if (resolution.record?.listId) {
    return {
      listId: resolution.record.listId,
      listName: resolution.record.listName,
      listUrl: resolution.record.listUrl,
      method: "task-context",
      taskResolution: resolution
    }
  }
  const taskResponse = await client.getTask(resolution.taskId)
  const payload = taskResponse?.task ?? taskResponse ?? {}
  const listSource = payload?.list
  const listId =
    (listSource && typeof listSource.id === "string" && listSource.id) ??
    (typeof payload?.list_id === "string" && payload.list_id) ??
    (typeof payload?.listId === "string" && payload.listId)
  if (!listId) {
    throw new Error("Unable to determine listId from task reference")
  }
  const listName =
    (listSource && typeof listSource.name === "string" && listSource.name) ??
    resolution.record?.listName
  const listUrl =
    (listSource && typeof listSource.url === "string" && listSource.url) ??
    resolution.record?.listUrl
  return {
    listId: String(listId),
    listName,
    listUrl,
    method: "task-fetch",
    taskResolution: resolution
  }
}

export async function listTasksInList(
  input: Input,
  client: ClickUpClient,
  _config: ApplicationConfig,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const listResolution = await resolveListDetails(input, client, catalogue)
  const filters = {
    includeClosed: input.includeClosed,
    includeSubtasks: input.includeSubtasks,
    includeTasksInMultipleLists: input.includeTasksInMultipleLists
  }
  let listName = listResolution.listName
  let listUrl = listResolution.listUrl
  const pageSize = Math.min(input.limit, 100)

  type LoadedPage = {
    tasks: TaskListItem[]
    listName?: string
    listUrl?: string
  }

  async function loadListPage(page: number): Promise<LoadedPage> {
    const cached = catalogue?.getListPage(listResolution.listId, filters, page)
    if (cached) {
      const tasks = Array.isArray(cached.items)
        ? (cached.items as TaskListItem[])
        : cached.tasks.map((task) => ({
            id: task.id,
            name: task.name,
            status: task.status,
            url: task.url ?? `https://app.clickup.com/t/${task.id}`,
            assignees: [],
            assigneesTruncated: false
          }))
      return {
        tasks,
        listName: cached.listName,
        listUrl: cached.listUrl
      }
    }

    const query: SearchParams = {
      page,
      include_closed: input.includeClosed ? true : undefined,
      subtasks: input.includeSubtasks ? true : undefined,
      include_timl: input.includeTasksInMultipleLists ? true : undefined,
      page_size: pageSize
    }
    const response = await client.listTasksInList(listResolution.listId, query)
    const rawTasks: unknown[] = Array.isArray(response?.tasks)
      ? response.tasks
      : Array.isArray(response)
        ? response
        : []
    const mappedTasks = rawTasks
      .map((task) => mapTask(task, input.assigneePreviewLimit))
      .filter((task): task is TaskListItem => Boolean(task))

    const listCarrier = rawTasks.find((task) => {
      if (!task || typeof task !== "object") {
        return false
      }
      const candidate = (task as Record<string, unknown>).list
      if (!candidate || typeof candidate !== "object") {
        return false
      }
      const listRecord = candidate as Record<string, unknown>
      return typeof listRecord.name === "string" || typeof listRecord.url === "string"
    }) as { list?: { name?: string; url?: string } } | undefined

    const resolvedListName =
      listCarrier && typeof listCarrier.list?.name === "string" ? listCarrier.list.name : undefined
    const resolvedListUrl =
      listCarrier && typeof listCarrier.list?.url === "string" ? listCarrier.list.url : undefined

    const records: TaskResolutionRecord[] = rawTasks
      .map((task) => normaliseTaskRecord(task))
      .filter((task): task is TaskResolutionRecord => Boolean(task))

    catalogue?.storeListPage({
      listId: listResolution.listId,
      filters,
      page,
      tasks: records,
      items: mappedTasks,
      total: mappedTasks.length,
      listName: resolvedListName,
      listUrl: resolvedListUrl
    })

    return {
      tasks: mappedTasks,
      listName: resolvedListName,
      listUrl: resolvedListUrl
    }
  }

  const aggregatedTasks: TaskListItem[] = []
  let currentPage = input.page

  while (true) {
    const page = await loadListPage(currentPage)
    if (page.listName && !listName) {
      listName = page.listName
    }
    if (page.listUrl && !listUrl) {
      listUrl = page.listUrl
    }

    if (page.tasks.length === 0) {
      break
    }

    aggregatedTasks.push(...page.tasks)
    currentPage += 1

    if (aggregatedTasks.length > input.limit) {
      break
    }
  }

  const total = aggregatedTasks.length
  const { items, truncated } = truncateList<TaskListItem>(aggregatedTasks, input.limit)

  const guidance = truncated
    ? "Task list truncated for token safety. Increase limit or paginate with page to see more results."
    : undefined

  return {
    list: {
      id: listResolution.listId,
      name: listName,
      url: listUrl
    },
    tasks: items,
    truncated,
    total,
    page: input.page,
    resolution: {
      method: listResolution.method,
      task: listResolution.taskResolution
        ? {
            id: listResolution.taskResolution.taskId,
            method: listResolution.taskResolution.method,
            matchedName: listResolution.taskResolution.matchedName,
            score: listResolution.taskResolution.score,
            usedContext: listResolution.taskResolution.method === "fuzzy"
          }
        : undefined
    },
    filters: {
      includeClosed: input.includeClosed,
      includeSubtasks: input.includeSubtasks,
      includeTasksInMultipleLists: input.includeTasksInMultipleLists
    },
    guidance
  }
}
