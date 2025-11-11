import { z } from "zod"
import { SafetyInput } from "./safety.js"

const Id = z.coerce.string()
const RequiredId = z.coerce.string().min(1)

export const StartTimerInput = SafetyInput.extend({
  taskId: Id
})

export const StopTimerInput = SafetyInput.extend({
  taskId: Id
})

export const CreateTimeEntryInput = SafetyInput.extend({
  taskId: Id,
  start: z.string(),
  end: z.string().optional(),
  durationMs: z.number().int().optional(),
  description: z.string().optional()
})

export const UpdateTimeEntryInput = SafetyInput.extend({
  entryId: RequiredId,
  start: z.string().optional(),
  end: z.string().optional(),
  durationMs: z.number().int().optional(),
  description: z.string().optional()
})

export const DeleteTimeEntryInput = SafetyInput.extend({
  entryId: RequiredId
})

export const ListTimeEntriesInput = z.object({
  taskId: Id.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20)
})

export const ReportTimeForTagInput = z.object({
  tag: z.string(),
  from: z.string().optional(),
  to: z.string().optional()
})

export const ReportTimeForContainerInput = z.object({
  containerId: RequiredId,
  from: z.string().optional(),
  to: z.string().optional()
})

export const ReportTimeForSpaceTagInput = z.object({
  spaceId: RequiredId,
  tag: z.string(),
  from: z.string().optional(),
  to: z.string().optional()
})

export const GetTaskTimeEntriesInput = z.object({
  taskId: Id,
  pageSize: z.number().int().min(1).max(100).default(20)
})

export const GetCurrentTimeEntryInput = z.object({
  teamId: Id.optional()
})
