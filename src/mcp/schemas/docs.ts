import { z } from "zod"
import { SafetyInput } from "./safety.js"

export const ListDocumentsInput = z.object({
  workspaceId: z.string().optional(),
  search: z.string().min(1).optional(),
  spaceId: z.string().optional(),
  folderId: z.string().optional(),
  page: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  includePreviews: z.boolean().default(true),
  previewPageLimit: z.number().int().min(1).max(5).default(3),
  previewCharLimit: z.number().int().min(64).max(16000).optional()
})

export const GetDocumentInput = z.object({
  workspaceId: z.string().optional(),
  docId: z.string(),
  includePages: z.boolean().default(true),
  pageIds: z.array(z.string()).optional(),
  pageLimit: z.number().int().min(1).max(50).default(20),
  previewCharLimit: z.number().int().min(64).max(16000).optional()
})

export const GetDocumentPagesInput = z.object({
  workspaceId: z.string().optional(),
  docId: z.string(),
  pageIds: z.array(z.string()).nonempty(),
  previewCharLimit: z.number().int().min(64).max(16000).optional()
})

export const CreateDocumentPageInput = SafetyInput.extend({
  docId: z.string(),
  title: z.string().min(1),
  content: z.string().optional(),
  parentId: z.string().optional(),
  position: z.number().int().min(0).optional()
})

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
