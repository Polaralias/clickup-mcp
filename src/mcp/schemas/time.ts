import { z } from "zod"
import { SafetyInput } from "./safety.js"

const Id = z.coerce.string().describe("ClickUp identifier; numeric string accepted.")
const RequiredId = z.coerce
  .string()
  .min(1)
  .describe("ClickUp identifier required for this call.")

export const StartTimerInput = SafetyInput.extend({
  taskId: Id.describe("Task ID to start tracking time on.")
})

export const StopTimerInput = SafetyInput.extend({
  taskId: Id.describe("Task ID whose active timer should stop.")
})

export const CreateTimeEntryInput = SafetyInput.extend({
  taskId: Id.describe("Task ID the manual entry belongs to."),
  start: z.string().describe("ISO 8601 start timestamp."),
  end: z
    .string()
    .describe("ISO 8601 end timestamp; omit if using durationMs.")
    .optional(),
  durationMs: z
    .number()
    .int()
    .describe("Duration in milliseconds when end absent.")
    .optional(),
  description: z
    .string()
    .describe("Optional notes for the entry.")
    .optional()
})

export const UpdateTimeEntryInput = SafetyInput.extend({
  entryId: RequiredId.describe("Time entry ID to modify."),
  start: z.string().describe("New start timestamp.").optional(),
  end: z.string().describe("New end timestamp.").optional(),
  durationMs: z
    .number()
    .int()
    .describe("Override duration in milliseconds.")
    .optional(),
  description: z
    .string()
    .describe("Replacement notes for the entry.")
    .optional(),
  teamId: Id.describe("Workspace/team owning the time entry.").optional()
})

export const DeleteTimeEntryInput = SafetyInput.extend({
  entryId: RequiredId.describe("Time entry ID to delete."),
  teamId: Id.describe("Workspace/team owning the time entry.").optional()
})

export const ListTimeEntriesInput = z.object({
  taskId: Id.describe("Filter to entries for this task ID.").optional(),
  from: z
    .string()
    .describe("Inclusive ISO start boundary.")
    .optional(),
  to: z
    .string()
    .describe("Exclusive ISO end boundary.")
    .optional(),
  page: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Zero-based page index."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Entries per page; capped at 100.")
})

export const ReportTimeForTagInput = z.object({
  tag: z.string().describe("Tag name to summarise."),
  from: z
    .string()
    .describe("Inclusive ISO start boundary.")
    .optional(),
  to: z
    .string()
    .describe("Exclusive ISO end boundary.")
    .optional()
})

export const ReportTimeForContainerInput = z.object({
  containerId: RequiredId.describe("List/folder/space ID to summarise."),
  from: z
    .string()
    .describe("Inclusive ISO start boundary.")
    .optional(),
  to: z
    .string()
    .describe("Exclusive ISO end boundary.")
    .optional()
})

export const ReportTimeForSpaceTagInput = z.object({
  spaceId: RequiredId.describe("Space ID scoping the tag report."),
  tag: z.string().describe("Tag name within the space."),
  from: z
    .string()
    .describe("Inclusive ISO start boundary.")
    .optional(),
  to: z
    .string()
    .describe("Exclusive ISO end boundary.")
    .optional()
})

export const GetTaskTimeEntriesInput = z.object({
  taskId: Id.describe("Task ID whose entries to list."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Entries per page when streaming results.")
})

export const GetCurrentTimeEntryInput = z.object({
  teamId: Id.describe("Workspace/team to inspect for an active timer.").optional()
})
