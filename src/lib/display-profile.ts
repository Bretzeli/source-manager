import { and, asc, eq, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { account, oauthAccountIdentity, user } from "@/lib/db/schema"

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

/** After an OAuth row is removed, fix display email / image so they never reference removed data. */
export async function reconcileDisplayPreferencesAfterUnlink(
  userId: string,
  removedAccountId: string,
  removedIdentityEmail: string | null,
) {
  const [row] = await db
    .select({
      email: user.email,
      displayEmail: user.displayEmail,
      displayImageAccountId: user.displayImageAccountId,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!row) return

  const remaining = await db
    .select({
      accountId: oauthAccountIdentity.accountId,
      email: oauthAccountIdentity.email,
    })
    .from(oauthAccountIdentity)
    .innerJoin(account, eq(account.id, oauthAccountIdentity.accountId))
    .where(and(eq(account.userId, userId), ne(account.providerId, "credential")))
    .orderBy(asc(account.createdAt))

  const remainingEmails = [...new Set(remaining.map((r) => normalizeEmail(r.email)).filter(Boolean))]

  const effectiveDisplay = normalizeEmail(row.displayEmail) || normalizeEmail(row.email)
  const removedNorm = normalizeEmail(removedIdentityEmail)

  let nextDisplayEmail = row.displayEmail
  let nextPrimaryEmail = row.email

  if (removedNorm && effectiveDisplay === removedNorm) {
    const stillLinkedElsewhere = remaining.some((r) => normalizeEmail(r.email) === removedNorm)
    if (!stillLinkedElsewhere && remainingEmails.length > 0) {
      const replacement = remainingEmails[0]
      if (row.displayEmail?.trim()) {
        nextDisplayEmail = replacement
      } else {
        nextDisplayEmail = null
      }
      if (normalizeEmail(row.email) === removedNorm) {
        nextPrimaryEmail = replacement
      }
      if (nextDisplayEmail && normalizeEmail(nextDisplayEmail) === normalizeEmail(nextPrimaryEmail)) {
        nextDisplayEmail = null
      }
    }
  }

  let nextDisplayImageAccountId = row.displayImageAccountId
  let nextUserImage = row.image

  if (row.displayImageAccountId === removedAccountId) {
    nextDisplayImageAccountId = null
    nextUserImage = null
  }

  await db
    .update(user)
    .set({
      email: nextPrimaryEmail,
      displayEmail: nextDisplayEmail,
      displayImageAccountId: nextDisplayImageAccountId,
      image: nextUserImage,
    })
    .where(eq(user.id, userId))
}
