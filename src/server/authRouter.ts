import { Router, json, urlencoded } from "express"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"
import { randomBytes } from "node:crypto"
import rateLimit from "express-rate-limit"
import { connectionManager, authService, ensureServices } from "./services.js"
import { resolveTeamIdFromApiKey } from "./teamResolution.js"

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

// Rate limiters
const connectLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many connection requests, please try again later."
})

const tokenLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many token requests, please try again later."
})

// Middleware for parsing body
router.use(json())
router.use(urlencoded({ extended: true }))

// GET /connect
router.get("/connect", (req, res) => {
    const { redirect_uri, state, code_challenge, code_challenge_method } = req.query

    if (!redirect_uri || typeof redirect_uri !== "string") {
         return res.status(400).send("Invalid or missing redirect_uri")
    }

    // Validate URI format
    try {
        const url = new URL(redirect_uri)
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return res.status(400).send("Redirect URI must use http or https")
        }
    } catch {
        return res.status(400).send("Invalid redirect_uri format")
    }

    const allowlist = (process.env.REDIRECT_URI_ALLOWLIST || "").split(",").map(s => s.trim()).filter(s => s.length > 0)
    const mode = process.env.REDIRECT_URI_ALLOWLIST_MODE === "prefix" ? "prefix" : "exact"

    let allowed = false
    if (mode === "exact") {
        allowed = allowlist.includes(redirect_uri)
    } else {
        allowed = allowlist.some(allowedUri => redirect_uri.startsWith(allowedUri))
    }

    if (!allowed) {
         return res.status(400).send("Redirect URI not allowed")
    }

    if (!code_challenge || !code_challenge_method) {
         return res.status(400).send("Missing PKCE parameters")
    }
    if (code_challenge_method !== 'S256') {
         return res.status(400).send("Only S256 supported")
    }

    const csrfToken = randomBytes(16).toString("hex")
    res.cookie("csrf_token", csrfToken, { httpOnly: true, sameSite: "strict" })

    const htmlPath = join(__dirname, "../public/connect.html")
    let html = readFileSync(htmlPath, "utf-8")
    html = html.replace("{{CSRF_TOKEN}}", csrfToken)

    res.send(html)
})

// POST /connect
router.post("/connect", connectLimiter, ensureServices, async (req, res) => {
    try {
        const { name, config, redirect_uri, state, code_challenge, code_challenge_method, csrf_token } = req.body

        const cookieHeader = req.headers.cookie || ""
        const match = cookieHeader.match(/csrf_token=([^;]+)/)
        const cookieToken = match ? match[1] : null

        if (!cookieToken || !csrf_token || cookieToken !== csrf_token) {
             return res.status(403).json({ error: "Invalid CSRF token" })
        }

        // Validate inputs
        if (!name || !config || !config.apiKey) {
             return res.status(400).json({ error: "Missing required fields" })
        }

        // Resolve Team ID if missing
        if (!config.teamId) {
            try {
                config.teamId = await resolveTeamIdFromApiKey(config.apiKey)
            } catch (error) {
                return res.status(400).json({ error: "Failed to resolve team ID: " + (error instanceof Error ? error.message : String(error)) })
            }
        }

        // Create Connection
        const connection = await connectionManager.create({ name, config })

        // Create Auth Code
        const code = await authService.generateCode(connection.id, redirect_uri, code_challenge, code_challenge_method)

        // Construct Redirect URL
        const url = new URL(redirect_uri)
        url.searchParams.set("code", code)
        if (state) url.searchParams.set("state", state)

        res.json({ redirectUrl: url.toString() })

    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
})

// POST /token
router.post("/token", tokenLimiter, ensureServices, async (req, res) => {
    try {
        const { grant_type, code, redirect_uri, code_verifier } = req.body

        if (grant_type !== "authorization_code") {
             // Optional check
        }

        if (!code || !code_verifier) {
            return res.status(400).json({ error: "Missing code or code_verifier" })
        }

        const accessToken = await authService.exchangeCode(code, redirect_uri, code_verifier)

        // Determine expires_in
        const ttl = parseInt(process.env.TOKEN_TTL_SECONDS || "3600", 10)

        res.json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: ttl
        })
    } catch (err) {
        res.status(400).json({ error: (err as Error).message })
    }
})

export default router
