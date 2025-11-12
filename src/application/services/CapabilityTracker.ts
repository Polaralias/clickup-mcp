export type MemberEndpointCapability = {
  teamId: string
  directAvailable: boolean
  lastChecked: string
  diagnostics?: string
}

export type DocsEndpointCapability = {
  teamId: string
  docsAvailable: boolean
  lastChecked: string
  diagnostics?: string
}

export type CapabilitySnapshot = {
  memberEndpoint: MemberEndpointCapability[]
  docsEndpoint: DocsEndpointCapability[]
}

function sanitiseDiagnostics(value?: string) {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  if (trimmed.length <= 400) {
    return trimmed
  }
  return `${trimmed.slice(0, 400)}…`
}

export class CapabilityTracker {
  private readonly memberEndpoint = new Map<string, { directAvailable: boolean; lastChecked: number; diagnostics?: string }>()
  private readonly docsEndpoint = new Map<string, { docsAvailable: boolean; lastChecked: number; diagnostics?: string }>()

  recordMemberEndpoint(teamId: string, directAvailable: boolean, diagnostics?: string): MemberEndpointCapability {
    const sanitised = sanitiseDiagnostics(diagnostics)
    const entry = { directAvailable, lastChecked: Date.now(), diagnostics: sanitised }
    this.memberEndpoint.set(teamId, entry)
    return {
      teamId,
      directAvailable,
      lastChecked: new Date(entry.lastChecked).toISOString(),
      ...(sanitised ? { diagnostics: sanitised } : {})
    }
  }

  getMemberEndpoint(teamId: string): MemberEndpointCapability | undefined {
    const entry = this.memberEndpoint.get(teamId)
    if (!entry) {
      return undefined
    }
    return {
      teamId,
      directAvailable: entry.directAvailable,
      lastChecked: new Date(entry.lastChecked).toISOString(),
      ...(entry.diagnostics ? { diagnostics: entry.diagnostics } : {})
    }
  }

  recordDocsEndpoint(teamId: string, docsAvailable: boolean, diagnostics?: string): DocsEndpointCapability {
    const sanitised = sanitiseDiagnostics(diagnostics)
    const entry = { docsAvailable, lastChecked: Date.now(), diagnostics: sanitised }
    this.docsEndpoint.set(teamId, entry)
    return {
      teamId,
      docsAvailable,
      lastChecked: new Date(entry.lastChecked).toISOString(),
      ...(sanitised ? { diagnostics: sanitised } : {})
    }
  }

  getDocsEndpoint(teamId: string): DocsEndpointCapability | undefined {
    const entry = this.docsEndpoint.get(teamId)
    if (!entry) {
      return undefined
    }
    return {
      teamId,
      docsAvailable: entry.docsAvailable,
      lastChecked: new Date(entry.lastChecked).toISOString(),
      ...(entry.diagnostics ? { diagnostics: entry.diagnostics } : {})
    }
  }

  snapshot(): CapabilitySnapshot {
    const memberEndpoint = Array.from(this.memberEndpoint.entries()).map(([teamId, entry]) => ({
      teamId,
      directAvailable: entry.directAvailable,
      lastChecked: new Date(entry.lastChecked).toISOString(),
      ...(entry.diagnostics ? { diagnostics: entry.diagnostics } : {})
    }))
    const docsEndpoint = Array.from(this.docsEndpoint.entries()).map(([teamId, entry]) => ({
      teamId,
      docsAvailable: entry.docsAvailable,
      lastChecked: new Date(entry.lastChecked).toISOString(),
      ...(entry.diagnostics ? { diagnostics: entry.diagnostics } : {})
    }))
    return { memberEndpoint, docsEndpoint }
  }
}
