import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { account, oauthAccountIdentity } from "@/lib/db/schema"

export async function upsertOAuthIdentity(
  accountId: string,
  email: string,
  profileImageUrl?: string | null,
) {
  const normalizedEmail = email.toLowerCase()
  const existing = await db
    .select({ id: oauthAccountIdentity.id })
    .from(oauthAccountIdentity)
    .where(eq(oauthAccountIdentity.accountId, accountId))
    .limit(1)

  if (existing.length > 0) {
    const patch: { email: string; profileImageUrl?: string | null } = { email: normalizedEmail }
    if (profileImageUrl !== undefined) {
      patch.profileImageUrl = profileImageUrl
    }
    await db.update(oauthAccountIdentity).set(patch).where(eq(oauthAccountIdentity.accountId, accountId))
    return
  }

  await db.insert(oauthAccountIdentity).values({
    id: crypto.randomUUID(),
    accountId,
    email: normalizedEmail,
    profileImageUrl: profileImageUrl ?? null,
  })
}

function emailFromJwtPayload(idToken: string | null | undefined): string | null {
  if (!idToken || typeof idToken !== "string") return null
  const parts = idToken.split(".")
  if (parts.length < 2) return null
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8")
    const payload = JSON.parse(payloadJson) as { email?: unknown }
    const email = payload?.email
    return typeof email === "string" ? email.toLowerCase() : null
  } catch {
    return null
  }
}

function profileImageFromJwtPayload(idToken: string | null | undefined): string | null {
  if (!idToken || typeof idToken !== "string") return null
  const parts = idToken.split(".")
  if (parts.length < 2) return null
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8")
    const payload = JSON.parse(payloadJson) as {
      picture?: unknown
      avatar_url?: unknown
    }
    const picture = payload?.picture
    if (typeof picture === "string" && picture.length > 0) return picture
    const avatarUrl = payload?.avatar_url
    if (typeof avatarUrl === "string" && avatarUrl.length > 0) return avatarUrl
    return null
  } catch {
    return null
  }
}

/** Persist provider email from OIDC id_token when available (Google, etc.). */
export function readOAuthEmailFromAccountRecord(account: {
  id?: string | null
  idToken?: string | null
}): string | null {
  if (!account.id) return null
  return emailFromJwtPayload(account.idToken)
}

export function readOAuthProfileFromAccountRecord(account: {
  id?: string | null
  idToken?: string | null
}): { email: string | null; image: string | null } {
  if (!account.id) return { email: null, image: null }
  return {
    email: emailFromJwtPayload(account.idToken),
    image: profileImageFromJwtPayload(account.idToken),
  }
}
