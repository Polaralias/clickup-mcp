import type { Express, Request, Response } from "express"

export function registerHealthEndpoint(app: Express) {
  // Legacy health check
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  // Standard health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" })
  })
}
