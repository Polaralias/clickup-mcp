import { z } from "zod"

const PositiveInt = z.number().int().positive()

export const ListReferenceLinksInput = z.object({
  limit: PositiveInt.max(200).default(50)
})

export const FetchReferencePageInput = z.object({
  url: z.string().url(),
  maxCharacters: PositiveInt.max(16000).optional()
})
