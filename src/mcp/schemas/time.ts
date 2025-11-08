import { z } from "zod"
import { SafetyInput } from "./safety.js"

export const StartTimerInput = SafetyInput.extend({
  taskId: z.string()
})

export const StopTimerInput = SafetyInput.extend({
  taskId: z.string()
})

export const CreateTimeEntryInput = SafetyInput.extend({
  taskId: z.string(),
  start: z.string(),
  end: z.string().optional(),
  durationMs: z.number().int().optional(),
  description: z.string().optional()
})

export const UpdateTimeEntryInput = SafetyInput.extend({
  entryId: z.string(),
  start: z.string().optional(),
  end: z.string().optional(),
  durationMs: z.number().int().optional(),
  description: z.string().optional()
})

export const DeleteTimeEntryInput = SafetyInput.extend({
  entryId: z.string()
})

export const ListTimeEntriesInput = z.object({
  taskId: z.string().optional(),
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
  containerId: z.string(),
  from: z.string().optional(),
  to: z.string().optional()
})

export const ReportTimeForSpaceTagInput = z.object({
  spaceId: z.string(),
  tag: z.string(),
  from: z.string().optional(),
  to: z.string().optional()
})
