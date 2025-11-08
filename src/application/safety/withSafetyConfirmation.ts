type SafetyInput = {
  confirm?: string
  dryRun?: boolean
}

type ToolResponse = {
  content: Array<{ type: "text"; text: string }>
  metadata?: Record<string, unknown>
}

type Handler<T extends SafetyInput> = (input: T) => Promise<ToolResponse>

export function withSafetyConfirmation<T extends SafetyInput>(handler: Handler<T>): Handler<T> {
  return async (input: T) => {
    if (input.dryRun) {
      return handler({ ...input, confirm: input.confirm ?? "yes", dryRun: true } as T)
    }

    if (input.confirm !== "yes") {
      return {
        content: [
          {
            type: "text",
            text: "Confirmation required. Resend with confirm: \"yes\" or set dryRun: true for a preview."
          }
        ],
        metadata: {
          requiresConfirmation: true
        }
      }
    }

    return handler({ ...input, dryRun: false } as T)
  }
}
