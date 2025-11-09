import { z } from "zod"
import { ListTagsForSpaceInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { SpaceTagCache } from "../../services/SpaceTagCache.js"
import { ensureSpaceTagCollection } from "./tagShared.js"

type Input = z.infer<typeof ListTagsForSpaceInput>

type Result = {
  tags: unknown[]
}

export async function listTagsForSpace(
  input: Input,
  client: ClickUpClient,
  cache: SpaceTagCache
): Promise<Result> {
  const tags = await ensureSpaceTagCollection(input.spaceId, client, cache, {
    forceRefresh: input.forceRefresh
  })
  return { tags }
}
