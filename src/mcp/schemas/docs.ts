import { z } from "zod"
import { SafetyInput } from "./safety.js"

export const CreateDocInput = SafetyInput.extend({
  folderId: z.string(),
  name: z.string().min(1),
  content: z.string().optional()
})

export const ListDocPagesInput = z.object({
  docId: z.string()
})

export const GetDocPageInput = z.object({
  docId: z.string(),
  pageId: z.string()
})

export const UpdateDocPageInput = SafetyInput.extend({
  docId: z.string(),
  pageId: z.string(),
  title: z.string().optional(),
  content: z.string().optional()
})

export const DocSearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(25).default(10),
  expandPages: z.boolean().default(false)
})

export const BulkDocSearchInput = z.object({
  queries: z.array(z.string().min(1)),
  limit: z.number().int().min(1).max(10).default(5),
  expandPages: z.boolean().default(false)
})
