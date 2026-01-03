import { createHash } from "node:crypto"

/**
 * Standardises MASTER_KEY handling across all repos:
 * 1. If MASTER_KEY is 64 hex characters, treat it as 32 bytes of key material by decoding hex.
 * 2. Otherwise, treat MASTER_KEY as a passphrase and derive a 32-byte key using SHA-256.
 * 3. The resulting output is always exactly 32 bytes.
 * 
 * Fails fast if MASTER_KEY is missing or empty.
 */
export function getMasterKeyBytes(): Buffer {
    const value = (process.env.MASTER_KEY || "").trim()

    if (!value) {
        throw new Error("MASTER_KEY environment variable is missing or empty. This is required for secure operation.")
    }

    // Check if it's 64 hex characters (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(value)) {
        return Buffer.from(value, "hex")
    }

    // Otherwise, derive using SHA-256
    return createHash("sha256").update(value, "utf8").digest()
}

/**
 * Get diagnostics about the master key without revealing the key itself.
 */
export function getMasterKeyInfo() {
    const value = (process.env.MASTER_KEY || "").trim()
    if (!value) {
        return { status: "missing" }
    }

    const isHex = /^[0-9a-fA-F]{64}$/.test(value)
    const bytes = getMasterKeyBytes()

    return {
        status: "present",
        format: isHex ? "64-hex" : "passphrase",
        length: bytes.length,
        // Add a small hint/checksum for debugging without exposing the key
        checksum: createHash("sha256").update(bytes).digest("hex").substring(0, 8)
    }
}
