import { z } from "zod"
import { SafetyInput } from "./safety.js"

const Id = z.coerce.string()
const RequiredId = z.coerce.string().min(1)

export const ListDocumentsInput = z.object({
  workspaceId: Id.optional(),
  search: z.string().min(1).optional(),
  spaceId: Id.optional(),
  folderId: Id.optional(),
  page: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  includePreviews: z.boolean().default(true),
  previewPageLimit: z.number().int().min(1).max(5).default(3),
  previewCharLimit: z.number().int().min(64).max(16000).optional()
})

export const GetDocumentInput = z.object({
  workspaceId: Id.optional(),
  docId: RequiredId,
  includePages: z.boolean().default(true),
  pageIds: z.array(RequiredId).optional(),
  pageLimit: z.number().int().min(1).max(50).default(20),
  previewCharLimit: z.number().int().min(64).max(16000).optional()
})

export const GetDocumentPagesInput = z.object({
  workspaceId: Id.optional(),
  docId: RequiredId,
  pageIds: z.array(RequiredId).nonempty(),
  previewCharLimit: z.number().int().min(64).max(16000).optional()
})

export const CreateDocumentPageInput = SafetyInput.extend({
  docId: RequiredId,
  title: z.string().min(1),
  content: z.string().optional(),
  parentId: Id.optional(),
  position: z.number().int().min(0).optional()
})

export const CreateDocInput = SafetyInput.extend({
  folderId: RequiredId,
  name: z.string().min(1),
  content: z.string().optional()
})

export const ListDocPagesInput = z.object({
  docId: RequiredId
})

export const GetDocPageInput = z.object({
  docId: RequiredId,
  pageId: RequiredId
})

export const UpdateDocPageInput = SafetyInput.extend({
  docId: RequiredId,
  pageId: RequiredId,
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
