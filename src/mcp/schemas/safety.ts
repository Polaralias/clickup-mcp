import { z } from "zod"

export const SafetyInput = z.object({
  confirm: z.string().optional(),
  dryRun: z.boolean().optional()
})
