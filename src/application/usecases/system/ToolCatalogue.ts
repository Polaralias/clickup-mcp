export type ToolCatalogueEntry = {
  name: string
  description: string
  annotations?: Record<string, unknown>
}

export async function toolCatalogue(tools: ToolCatalogueEntry[]) {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      annotations: tool.annotations ?? {}
    }))
  }
}
