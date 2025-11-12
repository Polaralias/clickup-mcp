import { z } from "zod"
import { SafetyInput } from "./safety.js"
import { toEpochMilliseconds } from "../../shared/time.js"

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

const TimeBoundary = z
  .union([z.string(), z.number()])
  .superRefine((value, ctx) => {
    try {
      const label = typeof ctx.path.at(-1) === "string" ? ctx.path.at(-1) : "timestamp"
      toEpochMilliseconds(value, label)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid timestamp boundary."
      })
    }
  })

export const ListTimeEntriesInput = z.object({
  taskId: Id.describe("Filter to entries for this task ID.").optional(),
  from: TimeBoundary.describe(
    "Inclusive start boundary as ISO 8601 string or epoch seconds/milliseconds."
  ).optional(),
  to: TimeBoundary.describe(
    "Exclusive end boundary as ISO 8601 string or epoch seconds/milliseconds."
  ).optional(),
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
