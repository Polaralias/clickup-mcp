import { describe, expect, it, vi } from "vitest"
import type { Request, Response } from "express"
import { authenticationMiddleware } from "../authentication.js"

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response
}

describe("authenticationMiddleware", () => {
  it("attaches the bearer token to the request", () => {
    const req = { headers: { authorization: "Bearer test-token" } } as unknown as Request
    const res = createResponse()
    const next = vi.fn()

    authenticationMiddleware(req, res, next)

    expect(req.sessionCredential?.token).toBe("test-token")
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("rejects requests without a valid Authorization header", () => {
    const req = { headers: {}, query: {} } as unknown as Request
    const res = createResponse()
    const next = vi.fn()

    authenticationMiddleware(req, res, next)

    expect(req.sessionCredential).toBeUndefined()
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Missing or invalid Authorization header" })
  })

  it("allows requests that include a session header", () => {
    const req = { headers: { "mcp-session-id": "session-123" }, query: {} } as unknown as Request
    const res = createResponse()
    const next = vi.fn()

    authenticationMiddleware(req, res, next)

    expect(req.sessionCredential).toBeUndefined()
    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })

  it("derives credentials from the apiKey query parameter", () => {
    const req = { headers: {}, query: { apiKey: "pk_123" } } as unknown as Request
    const res = createResponse()
    const next = vi.fn()

    authenticationMiddleware(req, res, next)

    expect(req.sessionCredential?.token).toBe("pk_123")
    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })
})
