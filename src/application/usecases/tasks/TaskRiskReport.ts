import { z } from "zod"
import { TaskRiskReportInput } from "../../../mcp/schemas/reporting.js"
import { ClickUpClient, type SearchParams } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { truncateList } from "../../limits/truncation.js"
import { HierarchyDirectory } from "../../services/HierarchyDirectory.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import { TaskSearchIndex } from "../../services/TaskSearchIndex.js"
import { resolveIdsFromPath } from "../hierarchy/structureShared.js"
import { normaliseTaskRecord } from "./resolveTaskReference.js"

type Input = z.infer<typeof TaskRiskReportInput>

type ContainerScope = {
  workspaceId?: string
  spaceId?: string
  folderId?: string
  listId?: string
  path?: Input["path"]
}

type TaskMember = {
  id: string
  username?: string
  email?: string
}

type RiskSample = {
  id: string
  name?: string
  status?: string
  statusType?: string
  priority?: string
  dueDate?: string
  dueInDays?: number
  overdueDays?: number
  url: string
  assignees: TaskMember[]
  assigneesTruncated: boolean
  tags: string[]
}

type AssigneeOverdueGroup = {
  assignee: string
  count: number
  maxOverdueDays: number
}

type AssigneeRiskGroup = {
  assignee: string
  count: number
  nearestDueDays: number
}

type Result = {
  container: ContainerScope
  totals: {
    inspected: number
    limit: number
    truncated: boolean
  }
  overdue: {
    total: number
    bySeverity: Record<string, number>
    byAssignee: AssigneeOverdueGroup[]
  }
  atRisk: {
    windowDays: number
    total: number
    byAssignee: AssigneeRiskGroup[]
    byPriority: Record<string, number>
  }
  samples: {
    tasks: RiskSample[]
    truncated: boolean
  }
  filters: {
    includeClosed: boolean
    includeSubtasks: boolean
    includeTasksInMultipleLists: boolean
    tags: string[]
    assignees: string[]
    statusFilter: string[]
    dueWithinDays: number
  }
  truncated: boolean
}

function readString(candidate: unknown): string | undefined {
  if (typeof candidate === "string") {
    return candidate
  }
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return String(candidate)
  }
  return undefined
}

function toIsoDate(value: unknown): string | undefined {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : undefined
  if (parsed && Number.isFinite(parsed) && parsed > 0) {
    return new Date(parsed).toISOString()
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
  const username = readString(raw.username ?? raw.name)
  const email = readString(raw.email ?? raw.user_email)
  return { id: String(id), username: username ?? undefined, email: email ?? undefined }
}

function mapTags(candidate: unknown): string[] {
  if (!Array.isArray(candidate)) {
    return []
  }
  return candidate
    .map((entry) => {
      if (typeof entry === "string") {
        return entry
      }
      if (entry && typeof entry === "object") {
        const raw = entry as Record<string, unknown>
        const name = raw.name ?? raw.tag ?? raw.label
        if (typeof name === "string" && name.length > 0) {
          return name
        }
      }
      return undefined
    })
    .filter((value): value is string => Boolean(value))
}

function readPriority(task: any): string | undefined {
  const raw = task?.priority
  if (typeof raw === "string" && raw.length > 0) {
    return raw
  }
  if (raw && typeof raw === "object") {
    const value = (raw as any).label ?? (raw as any).priority ?? (raw as any).text
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return undefined
}

function readStatus(task: any): { status?: string; type?: string } {
  if (typeof task?.status === "string") {
    return { status: task.status }
  }
  if (task?.status && typeof task.status === "object") {
    const value = task.status as Record<string, unknown>
    const status = readString(value.status ?? value.name ?? value.text)
    const type = readString(value.type)
    return { status: status ?? undefined, type: type ?? undefined }
  }
  return { status: undefined, type: undefined }
}

function mapTask(task: any, assigneeLimit: number): RiskSample | undefined {
  const id = task?.id ?? task?.task_id
  if (!id) {
    return undefined
  }
  const assigneesRaw: unknown[] = Array.isArray(task?.assignees) ? task.assignees : []
  const assigneeRecords = assigneesRaw
    .map((member) => mapMember(member))
    .filter((member): member is TaskMember => Boolean(member))
  const { items: assignees, truncated: assigneesTruncated } = truncateList<TaskMember>(assigneeRecords, assigneeLimit)
  const { status, type } = readStatus(task)
  const priority = readPriority(task)
  const url = typeof task?.url === "string" ? task.url : `https://app.clickup.com/t/${id}`
  return {
    id: String(id),
    name: typeof task?.name === "string" ? task.name : undefined,
    status,
    statusType: type,
    priority,
    dueDate: toIsoDate(task?.due_date ?? task?.dueDate),
    url,
    assignees,
    assigneesTruncated,
    tags: mapTags(task?.tags)
  }
}

async function fetchSearchPage(
  teamId: string,
  query: SearchParams,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
) {
  const cached = catalogue?.getSearchEntry(teamId, query)
  if (cached) {
    return cached.tasks
  }
  const response = await client.searchTasks(teamId, query)
  const tasks = Array.isArray(response?.tasks) ? response.tasks : []
  const records = tasks
    .map((task: unknown) => normaliseTaskRecord(task))
    .filter((task: unknown): task is NonNullable<ReturnType<typeof normaliseTaskRecord>> => Boolean(task))
  const index = new TaskSearchIndex()
  index.index(records)
  catalogue?.storeSearchEntry({ teamId, params: query, tasks, records, index })
  return tasks
}

function buildContainer(input: Input, pathResolution?: Awaited<ReturnType<typeof resolveIdsFromPath>>): ContainerScope {
  return {
    workspaceId: input.workspaceId ?? pathResolution?.workspaceId,
    spaceId: input.spaceId ?? pathResolution?.spaceId,
    folderId: input.folderId ?? pathResolution?.folderId,
    listId: input.listId ?? pathResolution?.listId,
    path: input.path ?? undefined
  }
}

function buildQuery(
  container: ContainerScope,
  input: Input,
  page: number,
  pageSize: number,
  limit: number
): SearchParams {
  const includeTiml = input.includeTasksInMultipleLists !== false
  const query: SearchParams = {
    page,
    page_size: pageSize,
    include_closed: input.includeClosed,
    subtasks: input.includeSubtasks,
    include_timl: includeTiml ? true : undefined,
    order_by: "due_date",
    reverse: false
  }
  if (container.listId) query.list_ids = [container.listId]
  if (container.folderId) query.project_ids = [container.folderId]
  if (container.spaceId) query.space_ids = [container.spaceId]
  if (input.tags && input.tags.length > 0) query.tags = input.tags
  if (input.assignees && input.assignees.length > 0) query.assignees = input.assignees
  if (input.statusFilter && input.statusFilter.length > 0) query.statuses = input.statusFilter
  query.page_size = Math.min(query.page_size as number, limit)
  return query
}

function matchesAssignees(task: RiskSample, filters?: string[]) {
  if (!filters || filters.length === 0) return true
  const normalised = filters.map((entry) => entry.toLowerCase())
  return task.assignees.some((assignee) => {
    const candidates = [assignee.id, assignee.username, assignee.email]
    return candidates.some((value) => typeof value === "string" && normalised.includes(value.toLowerCase()))
  })
}

function matchesTags(task: RiskSample, filters?: string[]) {
  if (!filters || filters.length === 0) return true
  const set = new Set(task.tags.map((tag) => tag.toLowerCase()))
  return filters.every((tag) => set.has(tag.toLowerCase()))
}

function matchesStatus(task: RiskSample, filters?: string[]) {
  if (!filters || filters.length === 0) return true
  const status = task.status?.toLowerCase()
  return status ? filters.some((entry) => entry.toLowerCase() === status) : false
}

function isClosed(task: RiskSample) {
  const statusType = task.statusType?.toLowerCase()
  if (statusType && ["done", "closed", "complete"].includes(statusType)) {
    return true
  }
  const status = task.status?.toLowerCase()
  return status ? ["done", "closed", "complete", "resolved"].includes(status) : false
}

function severityBucket(days: number) {
  if (days >= 15) return "15+"
  if (days >= 8) return "8-14"
  if (days >= 3) return "3-7"
  return "1-2"
}

function labelAssignee(task: RiskSample) {
  const primary = task.assignees[0]
  const label = primary?.username ?? primary?.email ?? primary?.id
  return label ?? "unassigned"
}

function applyCharLimit(result: Result, config: ApplicationConfig) {
  const initial = JSON.stringify(result)
  if (initial.length <= config.charLimit) {
    return result
  }
  const trimmed: Result = {
    ...result,
    samples: { tasks: [], truncated: true },
    truncated: true
  }
  const fallback = JSON.stringify(trimmed)
  if (fallback.length <= config.charLimit) {
    return trimmed
  }
  return {
    ...trimmed,
    overdue: { ...trimmed.overdue, byAssignee: [], bySeverity: {} },
    atRisk: { ...trimmed.atRisk, byAssignee: [], byPriority: {} }
  }
}

export async function taskRiskReport(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  directory: HierarchyDirectory,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const teamId = requireTeamId(config, "teamId is required for risk reporting")
  const pathResolution = await resolveIdsFromPath(input.path, client, directory, {
    forceRefresh: input.forceRefresh
  })
  const container = buildContainer(input, pathResolution)
  const limit = Math.max(1, config.reportingMaxTasks)
  const pageSize = Math.min(limit, 100)
  const assigneeLimit = 5
  const windowDays = input.dueWithinDays ?? config.defaultRiskWindowDays
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  const tasks: RiskSample[] = []
  let truncated = false
  let page = 0
  while (tasks.length < limit) {
    const query = buildQuery(container, input, page, Math.min(pageSize, limit - tasks.length), limit)
    const pageTasks = await fetchSearchPage(teamId, query, client, catalogue)
    const mapped = pageTasks
      .map((task: unknown) => mapTask(task, assigneeLimit))
      .filter((task: RiskSample | undefined): task is RiskSample => Boolean(task))
      .filter((task: RiskSample) => matchesAssignees(task, input.assignees))
      .filter((task: RiskSample) => matchesTags(task, input.tags))
      .filter((task: RiskSample) => matchesStatus(task, input.statusFilter))
    tasks.push(...mapped)
    if (pageTasks.length < pageSize) {
      break
    }
    page += 1
    if (tasks.length >= limit) {
      truncated = true
      break
    }
  }
  if (tasks.length > limit) {
    tasks.length = limit
    truncated = true
  }

  const now = Date.now()
  const overdueSeverity = new Map<string, number>()
  const overdueByAssignee = new Map<string, AssigneeOverdueGroup>()
  const atRiskByAssignee = new Map<string, AssigneeRiskGroup>()
  const atRiskByPriority = new Map<string, number>()
  const samples: RiskSample[] = []
  const sampleLimit = 10
  let overdueTotal = 0
  let atRiskTotal = 0

  tasks.forEach((task) => {
    if (!task.dueDate) return
    if (!input.includeClosed && isClosed(task)) return
    const due = Date.parse(task.dueDate)
    if (!Number.isFinite(due)) return
    if (due < now) {
      const overdueDays = Math.ceil((now - due) / (24 * 60 * 60 * 1000))
      const bucket = severityBucket(overdueDays)
      overdueSeverity.set(bucket, (overdueSeverity.get(bucket) ?? 0) + 1)
      const assignee = labelAssignee(task)
      const existing = overdueByAssignee.get(assignee)
      if (existing) {
        existing.count += 1
        existing.maxOverdueDays = Math.max(existing.maxOverdueDays, overdueDays)
      } else {
        overdueByAssignee.set(assignee, { assignee, count: 1, maxOverdueDays: overdueDays })
      }
      overdueTotal += 1
      if (samples.length < sampleLimit) {
        samples.push({ ...task, overdueDays })
      }
      return
    }

    if (due <= now + windowMs) {
      const dueInDays = Math.ceil((due - now) / (24 * 60 * 60 * 1000))
      const assignee = labelAssignee(task)
      const existing = atRiskByAssignee.get(assignee)
      if (existing) {
        existing.count += 1
        existing.nearestDueDays = Math.min(existing.nearestDueDays, dueInDays)
      } else {
        atRiskByAssignee.set(assignee, { assignee, count: 1, nearestDueDays: dueInDays })
      }
      const priorityKey = task.priority ?? "none"
      atRiskByPriority.set(priorityKey, (atRiskByPriority.get(priorityKey) ?? 0) + 1)
      atRiskTotal += 1
      if (samples.length < sampleLimit) {
        samples.push({ ...task, dueInDays })
      }
    }
  })

  const { items: sampleItems, truncated: samplesTruncated } = truncateList(samples, sampleLimit)
  sampleItems.sort((a, b) => {
    if (a.overdueDays !== undefined && b.overdueDays !== undefined) {
      return b.overdueDays - a.overdueDays
    }
    if (a.overdueDays !== undefined) return -1
    if (b.overdueDays !== undefined) return 1
    const aDue = a.dueInDays ?? Number.MAX_SAFE_INTEGER
    const bDue = b.dueInDays ?? Number.MAX_SAFE_INTEGER
    return aDue - bDue
  })

  const base: Result = {
    container,
    totals: {
      inspected: tasks.length,
      limit,
      truncated
    },
    overdue: {
      total: overdueTotal,
      bySeverity: Object.fromEntries(overdueSeverity.entries()),
      byAssignee: Array.from(overdueByAssignee.values())
    },
    atRisk: {
      windowDays,
      total: atRiskTotal,
      byAssignee: Array.from(atRiskByAssignee.values()),
      byPriority: Object.fromEntries(atRiskByPriority.entries())
    },
    samples: {
      tasks: sampleItems,
      truncated: samplesTruncated
    },
    filters: {
      includeClosed: Boolean(input.includeClosed),
      includeSubtasks: Boolean(input.includeSubtasks),
      includeTasksInMultipleLists: input.includeTasksInMultipleLists !== false,
      tags: input.tags ?? [],
      assignees: input.assignees ?? [],
      statusFilter: input.statusFilter ?? [],
      dueWithinDays: windowDays
    },
    truncated: false
  }

  return applyCharLimit(base, config)
}
