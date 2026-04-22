"use server"

import { headers } from "next/headers"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, inArray, ne } from "drizzle-orm"
import { createHmac, timingSafeEqual } from "node:crypto"
import { auth } from "@/lib/auth"
import { reconcileDisplayPreferencesAfterUnlink } from "@/lib/display-profile"
import { db } from "@/lib/db"
import { account, oauthAccountIdentity, user as userTable } from "@/lib/db/schema"
import { upsertOAuthIdentity } from "@/lib/oauth-account-identity"

const ACCOUNT_DELETE_REAUTH_COOKIE = "account_delete_reauth"
const ACCOUNT_DELETE_REAUTH_PURPOSE = "delete-account"
const ACCOUNT_REAUTH_MAX_AGE_SECONDS = 5 * 60

function createSignedVerificationToken(userId: string) {
  const issuedAt = Date.now()
  const payload = `${ACCOUNT_DELETE_REAUTH_PURPOSE}:${userId}:${issuedAt}`
  const secret = process.env.BETTER_AUTH_SECRET ?? ""
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

function isValidVerificationToken(token: string, userId: string) {
  const separator = token.lastIndexOf(".")
  if (separator <= 0) return false
  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const payloadParts = payload.split(":")
  if (payloadParts.length !== 3) return false

  const [purpose, tokenUserId, issuedAtRaw] = payloadParts
  if (purpose !== ACCOUNT_DELETE_REAUTH_PURPOSE) return false
  if (tokenUserId !== userId) return false

  const issuedAt = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAt)) return false
  if (Date.now() - issuedAt > ACCOUNT_REAUTH_MAX_AGE_SECONDS * 1000) return false

  const secret = process.env.BETTER_AUTH_SECRET ?? ""
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url")

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(signatureBuffer, expectedBuffer)
}

async function hasDeleteVerification(userId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ACCOUNT_DELETE_REAUTH_COOKIE)?.value
  if (!token) return false
  return isValidVerificationToken(token, userId)
}

async function clearDeleteVerification() {
  const cookieStore = await cookies()
  cookieStore.delete(ACCOUNT_DELETE_REAUTH_COOKIE)
}

/** Clears short-lived account re-auth (delete / OAuth sensitive actions). Call when user leaves account settings. */
export async function clearAccountReauthVerification() {
  await clearDeleteVerification()
}

function assertSessionUserId(id: unknown): string {
  if (typeof id !== "string" || !id) {
    throw new Error("Unauthorized")
  }
  return id
}

async function requireSessionUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  return assertSessionUserId(session?.user?.id)
}

export type LinkedOAuthAccount = {
  id: string
  providerId: string
  accountId: string
  createdAt: Date
  email: string
}

export type OAuthConflictPreview = {
  mode: "delete" | "keep"
  movedEmail: string | null
  retainedLinks: Array<{
    providerId: string
    email: string | null
  }>
}

function extractEmailFromAccountInfo(info: unknown): string | null {
  if (!info || typeof info !== "object") return null

  const payload = info as Record<string, unknown>
  const userPart =
    payload.user && typeof payload.user === "object"
      ? (payload.user as Record<string, unknown>)
      : null
  const dataPart =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null

  const candidates: unknown[] = [
    userPart?.email,
    dataPart?.email,
    dataPart?.mail,
    dataPart?.emailAddress,
    dataPart?.["email_address"],
    dataPart?.account && typeof dataPart.account === "object"
      ? (dataPart.account as Record<string, unknown>).email
      : null,
    dataPart?.profile && typeof dataPart.profile === "object"
      ? (dataPart.profile as Record<string, unknown>).email
      : null,
  ]

  for (const value of candidates) {
    if (typeof value === "string" && value.includes("@")) {
      return value.toLowerCase()
    }
  }

  return null
}

function extractImageFromAccountInfo(info: unknown): string | null {
  if (!info || typeof info !== "object") return null

  const payload = info as Record<string, unknown>
  const userPart =
    payload.user && typeof payload.user === "object"
      ? (payload.user as Record<string, unknown>)
      : null
  const dataPart =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null

  const candidates: unknown[] = [
    userPart?.image,
    userPart?.picture,
    userPart?.avatar_url,
    dataPart?.picture,
    dataPart?.avatar_url,
    dataPart?.image,
    dataPart?.profile && typeof dataPart.profile === "object"
      ? (dataPart.profile as Record<string, unknown>).picture
      : null,
    dataPart?.profile && typeof dataPart.profile === "object"
      ? (dataPart.profile as Record<string, unknown>).avatar_url
      : null,
  ]

  for (const value of candidates) {
    if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
      return value
    }
  }

  return null
}

export type DisplayImageOption = {
  accountId: string
  providerId: string
  email: string
  imageUrl: string | null
}

export async function getDisplayInformationSettings() {
  const ownerUserId = await requireSessionUserId()

  await getOAuthLoginSettings()

  const [urow] = await db
    .select({
      name: userTable.name,
      email: userTable.email,
      displayEmail: userTable.displayEmail,
      displayImageAccountId: userTable.displayImageAccountId,
    })
    .from(userTable)
    .where(eq(userTable.id, ownerUserId))
    .limit(1)

  if (!urow) {
    throw new Error("Unauthorized")
  }

  const rows = await db
    .select({
      accountId: oauthAccountIdentity.accountId,
      email: oauthAccountIdentity.email,
      profileImageUrl: oauthAccountIdentity.profileImageUrl,
      providerId: account.providerId,
    })
    .from(oauthAccountIdentity)
    .innerJoin(account, eq(account.id, oauthAccountIdentity.accountId))
    .where(and(eq(account.userId, ownerUserId), ne(account.providerId, "credential")))

  const emailChoices = [...new Set(rows.map((r) => r.email.toLowerCase()))]
  if (urow.email) {
    emailChoices.push(urow.email.toLowerCase())
  }
  const uniqueEmails = [...new Set(emailChoices)].sort()

  const imageOptions: DisplayImageOption[] = rows.map((r) => ({
    accountId: r.accountId,
    providerId: r.providerId,
    email: r.email,
    imageUrl: r.profileImageUrl,
  }))

  const effectiveDisplayEmail =
    urow.displayEmail?.trim() && urow.displayEmail.trim().length > 0
      ? urow.displayEmail.trim().toLowerCase()
      : urow.email.toLowerCase()

  return {
    displayName: urow.name,
    displayEmail: effectiveDisplayEmail,
    emailChoices: uniqueEmails,
    imageOptions,
    displayImageAccountId: urow.displayImageAccountId,
  }
}

export async function updateDisplayInformation(params: {
  displayName: string
  displayEmail: string
  displayImageAccountId: string | null
}) {
  const userId = await requireSessionUserId()

  const trimmedName = params.displayName.trim()
  if (!trimmedName) {
    throw new Error("INVALID_DISPLAY_NAME")
  }

  const emailNorm = params.displayEmail.trim().toLowerCase()

  const identityRows = await db
    .select({
      accountId: oauthAccountIdentity.accountId,
      email: oauthAccountIdentity.email,
    })
    .from(oauthAccountIdentity)
    .innerJoin(account, eq(account.id, oauthAccountIdentity.accountId))
    .where(and(eq(account.userId, userId), ne(account.providerId, "credential")))

  const allowedEmails = new Set(identityRows.map((r) => r.email.toLowerCase()))
  const [primary] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
  if (primary?.email) {
    allowedEmails.add(primary.email.toLowerCase())
  }

  if (!allowedEmails.has(emailNorm)) {
    throw new Error("INVALID_DISPLAY_EMAIL")
  }

  const displayEmailCol =
    primary?.email && emailNorm === primary.email.toLowerCase() ? null : emailNorm

  let nextDisplayImageAccountId: string | null = params.displayImageAccountId
  let nextUserImage: string | null = null

  if (params.displayImageAccountId) {
    const owned = identityRows.some((r) => r.accountId === params.displayImageAccountId)
    if (!owned) {
      throw new Error("INVALID_DISPLAY_IMAGE")
    }
    const [imgRow] = await db
      .select({ url: oauthAccountIdentity.profileImageUrl })
      .from(oauthAccountIdentity)
      .where(eq(oauthAccountIdentity.accountId, params.displayImageAccountId))
      .limit(1)
    nextUserImage = imgRow?.url ?? null
  } else {
    nextDisplayImageAccountId = null
    nextUserImage = null
  }

  await db
    .update(userTable)
    .set({
      name: trimmedName,
      displayEmail: displayEmailCol,
      displayImageAccountId: nextDisplayImageAccountId,
      image: nextUserImage,
    })
    .where(eq(userTable.id, userId))

  revalidatePath("/account/settings")
}

export async function getOAuthLoginSettings() {
  const userId = await requireSessionUserId()

  const [userSettings] = await db
    .select({ allowDifferentProviders: userTable.allowDifferentProviders })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)

  const linkedAccounts = await auth.api.listUserAccounts({
    headers: await headers(),
  })

  const linkedOAuthAccounts = linkedAccounts.filter((entry) => entry.providerId !== "credential")
  const linkedOAuthAccountsWithEmail = await Promise.all(
    linkedOAuthAccounts.map(async (entry) => {
      const existingIdentity = await db
        .select({
          email: oauthAccountIdentity.email,
          profileImageUrl: oauthAccountIdentity.profileImageUrl,
        })
        .from(oauthAccountIdentity)
        .where(eq(oauthAccountIdentity.accountId, entry.id))
        .limit(1)

      if (existingIdentity.length > 0) {
        const row = existingIdentity[0]
        if (!row.profileImageUrl) {
          try {
            const info = await auth.api.accountInfo({
              headers: await headers(),
              query: { accountId: entry.accountId },
            })
            const resolvedImage = extractImageFromAccountInfo(info)
            if (resolvedImage) {
              await upsertOAuthIdentity(entry.id, row.email, resolvedImage)
            }
          } catch {
            /* keep stored email */
          }
        }
        return {
          ...entry,
          email: row.email,
        }
      }

      try {
        const info = await auth.api.accountInfo({
          headers: await headers(),
          query: { accountId: entry.accountId },
        })
        const resolvedEmail = extractEmailFromAccountInfo(info)
        if (resolvedEmail) {
          const resolvedImage = extractImageFromAccountInfo(info)
          await upsertOAuthIdentity(entry.id, resolvedEmail, resolvedImage ?? undefined)
          return {
            ...entry,
            email: resolvedEmail,
          }
        }
      } catch {
        // Fall through to user-email fallback below.
      }

      const fallbackUser = await db
        .select({ email: userTable.email })
        .from(account)
        .innerJoin(userTable, eq(userTable.id, account.userId))
        .where(eq(account.id, entry.id))
        .limit(1)

      const fallbackEmail = fallbackUser[0]?.email?.toLowerCase() ?? "unknown@provider.local"
      let fallbackImage: string | null = null
      try {
        const info = await auth.api.accountInfo({
          headers: await headers(),
          query: { accountId: entry.accountId },
        })
        fallbackImage = extractImageFromAccountInfo(info)
      } catch {
        /* */
      }
      await upsertOAuthIdentity(entry.id, fallbackEmail, fallbackImage ?? undefined)
      return {
        ...entry,
        email: fallbackEmail,
      }
    }),
  )

  return {
    allowDifferentProviders: userSettings?.allowDifferentProviders ?? true,
    linkedAccounts: linkedOAuthAccountsWithEmail as LinkedOAuthAccount[],
  }
}

export async function updateAllowDifferentProviders(allowDifferentProviders: boolean) {
  const userId = await requireSessionUserId()
  const verified = await hasDeleteVerification(userId)
  if (!verified) {
    throw new Error("REAUTH_REQUIRED")
  }

  await db
    .update(userTable)
    .set({ allowDifferentProviders })
    .where(eq(userTable.id, userId))

  await clearDeleteVerification()
  revalidatePath("/account/settings")
}

export async function resolveOAuthConflictAfterVerification(providerId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  const targetUserId = assertSessionUserId(session?.user?.id)
  const verified = await hasDeleteVerification(targetUserId)
  if (!verified) {
    throw new Error("REAUTH_REQUIRED")
  }

  const targetAccounts = await db
    .select({
      id: account.id,
    })
    .from(account)
    .where(eq(account.userId, targetUserId))

  const targetAccountIds = targetAccounts.map((entry) => entry.id)
  const targetEmailRows = targetAccountIds.length
    ? await db
        .select({ email: oauthAccountIdentity.email })
        .from(oauthAccountIdentity)
        .where(inArray(oauthAccountIdentity.accountId, targetAccountIds))
    : []

  const targetEmails = new Set(targetEmailRows.map((entry) => entry.email.toLowerCase()))
  const sessionEmail = session?.user?.email
  if (typeof sessionEmail === "string" && sessionEmail) {
    targetEmails.add(sessionEmail.toLowerCase())
  }

  const providerCandidates = await db
    .select({
      id: account.id,
      userId: account.userId,
      providerId: account.providerId,
      email: oauthAccountIdentity.email,
    })
    .from(account)
    .leftJoin(oauthAccountIdentity, eq(oauthAccountIdentity.accountId, account.id))
    .where(
      and(
        eq(account.providerId, providerId),
        ne(account.userId, targetUserId),
      ),
    )

  const directMatchingCandidates = providerCandidates.filter(
    (candidate) => candidate.email && targetEmails.has(candidate.email.toLowerCase()),
  )

  let sourceUserId: string | null = null
  let sourceEmail: string | null = null
  let sourceProviderAccountId: string | null = null

  const directCandidateUserIds = [...new Set(directMatchingCandidates.map((candidate) => candidate.userId))]
  if (directCandidateUserIds.length === 1) {
    sourceUserId = directCandidateUserIds[0]
    sourceEmail = directMatchingCandidates[0]?.email?.toLowerCase() ?? null
    sourceProviderAccountId = directMatchingCandidates[0]?.id ?? null
  }

  // If there is exactly one conflicting provider account candidate, anchor on it directly.
  // This covers the common case where target account A does not yet contain email M,
  // so overlap-based matching against A cannot identify M.
  if (!sourceUserId && providerCandidates.length === 1) {
    sourceUserId = providerCandidates[0].userId
    sourceEmail = providerCandidates[0].email?.toLowerCase() ?? null
    sourceProviderAccountId = providerCandidates[0].id
  }

  // Fallback path for legacy/missing identity rows on the conflicting provider account:
  // derive overlap from *any* email known on the candidate source user.
  if (!sourceUserId) {
    const candidateUserIds = [...new Set(providerCandidates.map((candidate) => candidate.userId))]
    if (candidateUserIds.length === 0) {
      throw new Error("CONFLICT_ACCOUNT_NOT_IDENTIFIED")
    }

    const candidateUserEmailRows = await db
      .select({
        userId: account.userId,
        email: oauthAccountIdentity.email,
      })
      .from(account)
      .leftJoin(oauthAccountIdentity, eq(oauthAccountIdentity.accountId, account.id))
      .where(inArray(account.userId, candidateUserIds))

    const userMatchedEmails = new Map<string, string[]>()
    for (const row of candidateUserEmailRows) {
      const normalized = row.email?.toLowerCase()
      if (!normalized || !targetEmails.has(normalized)) continue
      const existing = userMatchedEmails.get(row.userId) ?? []
      existing.push(normalized)
      userMatchedEmails.set(row.userId, existing)
    }

    const candidateUsers = await db
      .select({
        id: userTable.id,
        email: userTable.email,
      })
      .from(userTable)
      .where(inArray(userTable.id, candidateUserIds))

    const scoredCandidates = candidateUserIds
      .map((candidateId) => {
        const matched = new Set(userMatchedEmails.get(candidateId) ?? [])
        const directMatches = directMatchingCandidates.filter((entry) => entry.userId === candidateId).length
        const providerCandidateCount = providerCandidates.filter(
          (entry) => entry.userId === candidateId,
        ).length
        const candidateUser = candidateUsers.find((entry) => entry.id === candidateId)
        const hasPrimaryEmailOverlap = candidateUser?.email
          ? targetEmails.has(candidateUser.email.toLowerCase())
          : false

        // Score by strongest evidence first:
        // - direct conflicting-provider email overlap
        // - count of overlapping emails across all linked identities
        // - primary account email overlap
        const score = directMatches * 100 + matched.size * 10 + (hasPrimaryEmailOverlap ? 1 : 0)

        return {
          candidateId,
          score,
          providerCandidateCount,
          providerCandidates: providerCandidates.filter((entry) => entry.userId === candidateId),
          matchedEmails: [...matched],
        }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.providerCandidateCount !== a.providerCandidateCount) {
          return b.providerCandidateCount - a.providerCandidateCount
        }
        return a.candidateId.localeCompare(b.candidateId)
      })

    // Zero-score fallback: if all identity overlap metadata is missing, still resolve by
    // the conflicting provider candidates instead of hard failing.
    const bestCandidate = scoredCandidates[0]
    if (!bestCandidate) {
      throw new Error("CONFLICT_ACCOUNT_NOT_IDENTIFIED")
    }

    sourceUserId = bestCandidate.candidateId
    sourceEmail =
      bestCandidate.providerCandidates.find((entry) => entry.email)?.email?.toLowerCase() ??
      bestCandidate.matchedEmails[0] ??
      null
    sourceProviderAccountId = bestCandidate.providerCandidates[0]?.id ?? null
  }

  if (!sourceUserId) {
    throw new Error("CONFLICT_ACCOUNT_NOT_IDENTIFIED")
  }

  const sourceAccounts = await db
    .select({
      id: account.id,
      userId: account.userId,
      providerId: account.providerId,
      email: oauthAccountIdentity.email,
    })
    .from(account)
    .leftJoin(oauthAccountIdentity, eq(oauthAccountIdentity.accountId, account.id))
    .where(eq(account.userId, sourceUserId))

  if (!sourceEmail) {
    const sourceUser = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, sourceUserId))
      .limit(1)
    const normalizedPrimary = sourceUser[0]?.email?.toLowerCase()
    const primaryBackedByIdentity = normalizedPrimary
      ? sourceAccounts.some((entry) => entry.email?.toLowerCase() === normalizedPrimary)
      : false
    if (normalizedPrimary && primaryBackedByIdentity) {
      sourceEmail = normalizedPrimary
    }
  }

  const accountsToMoveByEmail = sourceEmail
    ? sourceAccounts.filter((entry) => entry.email?.toLowerCase() === sourceEmail)
    : []

  const fallbackProviderAccount = sourceProviderAccountId
    ? sourceAccounts.find((entry) => entry.id === sourceProviderAccountId)
    : sourceAccounts.find((entry) => entry.providerId === providerId)
  const accountsToMove = accountsToMoveByEmail.length
    ? accountsToMoveByEmail
    : fallbackProviderAccount
      ? [fallbackProviderAccount]
      : []

  if (accountsToMove.length === 0) {
    throw new Error("NO_ACCOUNTS_TO_MOVE")
  }

  await db
    .update(account)
    .set({ userId: targetUserId })
    .where(inArray(account.id, accountsToMove.map((entry) => entry.id)))

  const remainingSourceAccounts = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.userId, sourceUserId))

  const sourceUserDeleted = remainingSourceAccounts.length === 0
  if (sourceUserDeleted) {
    await db.delete(userTable).where(eq(userTable.id, sourceUserId))
  }

  await clearDeleteVerification()
  revalidatePath("/account/settings")

  return {
    moved: true as const,
    movedCount: accountsToMove.length,
    sourceUserDeleted,
    sourceUserRetained: !sourceUserDeleted,
  }
}

export async function getOAuthConflictPreview(providerId: string): Promise<OAuthConflictPreview> {
  const session = await auth.api.getSession({ headers: await headers() })
  const targetUserId = assertSessionUserId(session?.user?.id)

  const targetAccounts = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.userId, targetUserId))

  const targetAccountIds = targetAccounts.map((entry) => entry.id)
  const targetEmailRows = targetAccountIds.length
    ? await db
        .select({ email: oauthAccountIdentity.email })
        .from(oauthAccountIdentity)
        .where(inArray(oauthAccountIdentity.accountId, targetAccountIds))
    : []

  const targetEmails = new Set(targetEmailRows.map((entry) => entry.email.toLowerCase()))
  const sessionEmail = session?.user?.email
  if (typeof sessionEmail === "string" && sessionEmail) {
    targetEmails.add(sessionEmail.toLowerCase())
  }

  const providerCandidates = await db
    .select({
      id: account.id,
      userId: account.userId,
      providerId: account.providerId,
      email: oauthAccountIdentity.email,
    })
    .from(account)
    .leftJoin(oauthAccountIdentity, eq(oauthAccountIdentity.accountId, account.id))
    .where(and(eq(account.providerId, providerId), ne(account.userId, targetUserId)))

  const directMatchingCandidates = providerCandidates.filter(
    (candidate) => candidate.email && targetEmails.has(candidate.email.toLowerCase()),
  )

  let sourceUserId: string | null = null
  let sourceEmail: string | null = null
  let sourceProviderAccountId: string | null = null

  const directCandidateUserIds = [...new Set(directMatchingCandidates.map((candidate) => candidate.userId))]
  if (directCandidateUserIds.length === 1) {
    sourceUserId = directCandidateUserIds[0]
    sourceEmail = directMatchingCandidates[0]?.email?.toLowerCase() ?? null
    sourceProviderAccountId = directMatchingCandidates[0]?.id ?? null
  }

  if (!sourceUserId && providerCandidates.length === 1) {
    sourceUserId = providerCandidates[0].userId
    sourceEmail = providerCandidates[0].email?.toLowerCase() ?? null
    sourceProviderAccountId = providerCandidates[0].id
  }

  if (!sourceUserId) {
    const candidateUserIds = [...new Set(providerCandidates.map((candidate) => candidate.userId))]
    if (candidateUserIds.length === 0) {
      throw new Error("CONFLICT_ACCOUNT_NOT_IDENTIFIED")
    }

    const candidateUserEmailRows = await db
      .select({
        userId: account.userId,
        email: oauthAccountIdentity.email,
      })
      .from(account)
      .leftJoin(oauthAccountIdentity, eq(oauthAccountIdentity.accountId, account.id))
      .where(inArray(account.userId, candidateUserIds))

    const userMatchedEmails = new Map<string, string[]>()
    for (const row of candidateUserEmailRows) {
      const normalized = row.email?.toLowerCase()
      if (!normalized || !targetEmails.has(normalized)) continue
      const existing = userMatchedEmails.get(row.userId) ?? []
      existing.push(normalized)
      userMatchedEmails.set(row.userId, existing)
    }

    const candidateUsers = await db
      .select({
        id: userTable.id,
        email: userTable.email,
      })
      .from(userTable)
      .where(inArray(userTable.id, candidateUserIds))

    const scoredCandidates = candidateUserIds
      .map((candidateId) => {
        const matched = new Set(userMatchedEmails.get(candidateId) ?? [])
        const directMatches = directMatchingCandidates.filter((entry) => entry.userId === candidateId).length
        const providerCandidateCount = providerCandidates.filter(
          (entry) => entry.userId === candidateId,
        ).length
        const candidateUser = candidateUsers.find((entry) => entry.id === candidateId)
        const hasPrimaryEmailOverlap = candidateUser?.email
          ? targetEmails.has(candidateUser.email.toLowerCase())
          : false
        const score = directMatches * 100 + matched.size * 10 + (hasPrimaryEmailOverlap ? 1 : 0)

        return {
          candidateId,
          score,
          providerCandidateCount,
          providerCandidates: providerCandidates.filter((entry) => entry.userId === candidateId),
          matchedEmails: [...matched],
        }
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.providerCandidateCount !== a.providerCandidateCount) {
          return b.providerCandidateCount - a.providerCandidateCount
        }
        return a.candidateId.localeCompare(b.candidateId)
      })

    const bestCandidate = scoredCandidates[0]
    if (!bestCandidate) {
      throw new Error("CONFLICT_ACCOUNT_NOT_IDENTIFIED")
    }

    sourceUserId = bestCandidate.candidateId
    sourceEmail =
      bestCandidate.providerCandidates.find((entry) => entry.email)?.email?.toLowerCase() ??
      bestCandidate.matchedEmails[0] ??
      null
    sourceProviderAccountId = bestCandidate.providerCandidates[0]?.id ?? null
  }

  if (!sourceUserId) {
    throw new Error("CONFLICT_ACCOUNT_NOT_IDENTIFIED")
  }

  const sourceAccounts = await db
    .select({
      id: account.id,
      userId: account.userId,
      providerId: account.providerId,
      email: oauthAccountIdentity.email,
    })
    .from(account)
    .leftJoin(oauthAccountIdentity, eq(oauthAccountIdentity.accountId, account.id))
    .where(eq(account.userId, sourceUserId))

  if (!sourceEmail) {
    const sourceUser = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, sourceUserId))
      .limit(1)
    const normalizedPrimary = sourceUser[0]?.email?.toLowerCase()
    const primaryBackedByIdentity = normalizedPrimary
      ? sourceAccounts.some((entry) => entry.email?.toLowerCase() === normalizedPrimary)
      : false
    if (normalizedPrimary && primaryBackedByIdentity) {
      sourceEmail = normalizedPrimary
    }
  }

  const accountsToMoveByEmail = sourceEmail
    ? sourceAccounts.filter((entry) => entry.email?.toLowerCase() === sourceEmail)
    : []

  const fallbackProviderAccount = sourceProviderAccountId
    ? sourceAccounts.find((entry) => entry.id === sourceProviderAccountId)
    : sourceAccounts.find((entry) => entry.providerId === providerId)
  const accountsToMove = accountsToMoveByEmail.length
    ? accountsToMoveByEmail
    : fallbackProviderAccount
      ? [fallbackProviderAccount]
      : []

  if (accountsToMove.length === 0) {
    throw new Error("NO_ACCOUNTS_TO_MOVE")
  }

  const movedIds = new Set(accountsToMove.map((entry) => entry.id))
  const retainedLinks = sourceAccounts
    .filter((entry) => !movedIds.has(entry.id))
    .map((entry) => ({
      providerId: entry.providerId,
      email: entry.email,
    }))

  return {
    mode: retainedLinks.length === 0 ? "delete" : "keep",
    movedEmail: sourceEmail,
    retainedLinks,
  }
}

export async function unlinkOAuthAccount(providerId: string, accountId?: string) {
  const userId = await requireSessionUserId()
  const verified = await hasDeleteVerification(userId)
  if (!verified) {
    throw new Error("REAUTH_REQUIRED")
  }

  const linkedAccounts = await auth.api.listUserAccounts({
    headers: await headers(),
  })
  const oauthAccounts = linkedAccounts.filter((entry) => entry.providerId !== "credential")

  if (oauthAccounts.length <= 1) {
    throw new Error("LAST_OAUTH_PROVIDER")
  }

  const target = oauthAccounts.find(
    (entry) =>
      entry.providerId === providerId &&
      (accountId ? entry.accountId === accountId : true),
  )
  if (!target) {
    throw new Error("ACCOUNT_NOT_FOUND")
  }

  const [identityRow] = await db
    .select({ email: oauthAccountIdentity.email })
    .from(oauthAccountIdentity)
    .where(eq(oauthAccountIdentity.accountId, target.id))
    .limit(1)

  await auth.api.unlinkAccount({
    headers: await headers(),
    body: {
      providerId,
      accountId: target.accountId,
    },
  })

  await reconcileDisplayPreferencesAfterUnlink(
    userId,
    target.id,
    identityRow?.email ? identityRow.email.toLowerCase() : null,
  )

  await clearDeleteVerification()
  revalidatePath("/account/settings")
}

export async function getDeleteAccountVerificationStatus() {
  const session = await auth.api.getSession({ headers: await headers() })
  const id = session?.user?.id
  if (typeof id !== "string" || !id) return { verified: false }
  const verified = await hasDeleteVerification(id)
  return { verified }
}

export async function markDeleteAccountReauthVerified() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = assertSessionUserId(session?.user?.id)

  const cookieStore = await cookies()
  cookieStore.set(ACCOUNT_DELETE_REAUTH_COOKIE, createSignedVerificationToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCOUNT_REAUTH_MAX_AGE_SECONDS,
  })
}

export async function deleteAccount() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = assertSessionUserId(session?.user?.id)

  const verified = await hasDeleteVerification(userId)
  if (!verified) {
    throw new Error("REAUTH_REQUIRED")
  }

  await db.delete(userTable).where(eq(userTable.id, userId))
  const cookieStore = await cookies()
  cookieStore.delete(ACCOUNT_DELETE_REAUTH_COOKIE)

  revalidatePath("/")
}
