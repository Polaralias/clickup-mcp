import type { NextFunction, Request, Response } from "express"

export type SessionCredential = {
  token: string
  source: 'bearer' | 'apikey'
}

declare module "express-serve-static-core" {
  interface Request {
    sessionCredential?: SessionCredential
  }
}

function lastHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[value.length - 1]
  }
  return value
}

function extractBearerToken(headerValue: string | undefined) {
  if (!headerValue) {
    return undefined
  }
  const match = /^Bearer\s+(.+)$/i.exec(headerValue)
  const token = match?.[1]?.trim()
  return token || undefined
}

function lastQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value[value.length - 1]
  }
  if (typeof value === "string") {
    return value
  }
  return undefined
}

export function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = lastHeaderValue(req.headers.authorization)
  const token = extractBearerToken(header)
  if (!token) {
    const sessionHeader = lastHeaderValue(req.headers["mcp-session-id"])
    if (sessionHeader) {
      next()
      return
    }
    const apiKey = lastQueryString((req.query as Record<string, unknown> | undefined)?.apiKey)
    const trimmedApiKey = apiKey?.trim()
    if (trimmedApiKey) {
      req.sessionCredential = { token: trimmedApiKey, source: 'apikey' }
      next()
      return
    }
    res.status(401).json({ error: "Missing or invalid Authorization header" })
    return
  }
  req.sessionCredential = { token, source: 'bearer' }
  next()
}
