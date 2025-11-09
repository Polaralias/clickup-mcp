import { z } from "zod"

export const FindMemberByNameInput = z.object({
  query: z.string().min(1),
  teamId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  refresh: z.boolean().optional()
})

export const ResolveAssigneesInput = z.object({
  identifiers: z.array(z.string().min(1)),
  teamId: z.string().min(1).optional(),
  limitPerIdentifier: z.number().int().min(1).max(10).optional(),
  refresh: z.boolean().optional()
})

