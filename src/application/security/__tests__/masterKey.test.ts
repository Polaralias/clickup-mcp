import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getMasterKeyBytes, getMasterKeyInfo } from "../masterKey.js"
import { createHash } from "node:crypto"

describe("masterKey utility", () => {
    const originalEnv = process.env.MASTER_KEY

    afterEach(() => {
        process.env.MASTER_KEY = originalEnv
    })

    it("decodes a 64-character hex string as 32 bytes", () => {
        const hex = "a".repeat(64)
        process.env.MASTER_KEY = hex
        const bytes = getMasterKeyBytes()
        expect(bytes.length).toBe(32)
        expect(bytes.toString("hex")).toBe(hex)
    })

    it("is case-insensitive for hex strings", () => {
        const hex = "ABCDEF" + "0".repeat(58)
        process.env.MASTER_KEY = hex
        const bytes = getMasterKeyBytes()
        expect(bytes.length).toBe(32)
        expect(bytes.toString("hex")).toBe(hex.toLowerCase())
    })

    it("derives a key from a passphrase using SHA-256", () => {
        const passphrase = "my-secure-passphrase"
        process.env.MASTER_KEY = passphrase
        const bytes = getMasterKeyBytes()
        const expected = createHash("sha256").update(passphrase).digest()
        expect(bytes.length).toBe(32)
        expect(bytes.equals(expected)).toBe(true)
    })

    it("trims whitespace from the environment variable", () => {
        const hex = "a".repeat(64)
        process.env.MASTER_KEY = `  ${hex}  `
        const bytes = getMasterKeyBytes()
        expect(bytes.length).toBe(32)
        expect(bytes.toString("hex")).toBe(hex)
    })

    it("throws an error if MASTER_KEY is missing", () => {
        process.env.MASTER_KEY = ""
        expect(() => getMasterKeyBytes()).toThrow(/MASTER_KEY environment variable is missing/)
    })

    it("returns correct diagnostics in getMasterKeyInfo", () => {
        process.env.MASTER_KEY = "a".repeat(64)
        const infoHex = getMasterKeyInfo()
        expect(infoHex.status).toBe("present")
        expect(infoHex.format).toBe("64-hex")

        process.env.MASTER_KEY = "passphrase"
        const infoPass = getMasterKeyInfo()
        expect(infoPass.status).toBe("present")
        expect(infoPass.format).toBe("passphrase")
    })
})
