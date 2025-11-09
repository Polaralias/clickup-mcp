import { z } from "zod"
import { ListTasksInListInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { truncateList } from "../../limits/truncation.js"
import { resolveTaskReference } from "./resolveTaskReference.js"
import type { TaskResolution } from "./resolveTaskReference.js"

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

async function resolveListDetails(input: Input, client: ClickUpClient): Promise<ListResolution> {
  if (input.listId) {
    return { listId: input.listId, method: "direct" }
  }
  const resolution = resolveTaskReference({
    taskId: input.taskId,
    taskName: input.taskName,
    context: input.context
  })
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
  _config: ApplicationConfig
): Promise<Result> {
  const listResolution = await resolveListDetails(input, client)
  const query: Record<string, unknown> = {
    page: input.page,
    archived: input.includeClosed ? true : undefined,
    subtasks: input.includeSubtasks ? true : undefined
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
  const { items, truncated } = truncateList<TaskListItem>(mappedTasks, input.limit)
  const total = mappedTasks.length

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
  const listName =
    listResolution.listName ??
    (listCarrier && typeof listCarrier.list?.name === "string" ? listCarrier.list.name : undefined)
  const listUrl =
    listResolution.listUrl ??
    (listCarrier && typeof listCarrier.list?.url === "string" ? listCarrier.list.url : undefined)

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
      includeSubtasks: input.includeSubtasks
    },
    guidance
  }
}
