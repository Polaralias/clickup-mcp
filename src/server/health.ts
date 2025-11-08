import type { Express, Request, Response } from "express"

export function registerHealthEndpoint(app: Express) {
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ ok: true })
  })
}
