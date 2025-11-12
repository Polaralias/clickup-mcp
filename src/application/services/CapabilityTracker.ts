export type MemberEndpointCapability = {
  teamId: string
  directAvailable: boolean
  lastChecked: string
  diagnostics?: string
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
}
