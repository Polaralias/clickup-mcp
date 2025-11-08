import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

export async function listWorkspaces(client: ClickUpClient) {
  const response = await client.listWorkspaces()
  return { workspaces: response?.teams ?? response }
}
