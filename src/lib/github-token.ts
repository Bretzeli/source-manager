import crypto from "crypto"

// Simple encryption/decryption using BETTER_AUTH_SECRET
export function encryptToken(token: string): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set")
  }
  
  const algorithm = "aes-256-cbc"
  const key = crypto.scryptSync(secret, "salt", 32)
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(token, "utf8", "hex")
  encrypted += cipher.final("hex")
  
  return `${iv.toString("hex")}:${encrypted}`
}

export function decryptToken(encryptedToken: string): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set")
  }
  
  const algorithm = "aes-256-cbc"
  const key = crypto.scryptSync(secret, "salt", 32)
  const [ivHex, encrypted] = encryptedToken.split(":")
  
  if (!ivHex || !encrypted) {
    throw new Error("Invalid encrypted token format")
  }
  
  const iv = Buffer.from(ivHex, "hex")
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  
  return decrypted
}

