import { createAuthMiddleware } from "@better-auth/core/api"
import { getCurrentAuthContext } from "@better-auth/core/context"
import type { BetterAuthPlugin } from "better-auth"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { account, oauthAccountIdentity, user as userTable } from "@/lib/db/schema"
import {
  readOAuthEmailFromAccountRecord,
  readOAuthProfileFromAccountRecord,
  upsertOAuthIdentity,
} from "@/lib/oauth-account-identity"

const ADAPTER_OAUTH_IDENTITY_PATCHED = Symbol("adapterOauthIdentityPatched")

/** Stashed on the Better Auth endpoint context for the duration of an OAuth callback. */
const PENDING_OAUTH_PROFILE_EMAIL = Symbol.for("sourceManager.pendingOAuthProfileEmail")

type InternalAdapterLike = {
  findOAuthUser: (
    email: string,
    accountId: string,
    providerId: string,
  ) => Promise<{ user: { id: string }; accounts: unknown[] } | null>
  findUserById: (userId: string) => Promise<{ id: string; email?: string | null } | null>
  findAccounts: (userId: string) => Promise<unknown[]>
  linkAccount: (account: Record<string, unknown>) => Promise<{ id: string } & Record<string, unknown>>
  createOAuthUser: (
    user: Record<string, unknown>,
    account: Record<string, unknown>,
  ) => Promise<{ user: { id: string; email?: string | null }; account: { id: string } }>
  updateAccount: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown> & { id?: string }>
}

function isOAuthCallbackPath(path: string | undefined): boolean {
  if (!path) return false
  return path.startsWith("/callback/") || path.startsWith("/oauth2/callback/")
}

async function setPendingOAuthProfileEmail(email: string) {
  try {
    const ctx = await getCurrentAuthContext()
    const bag = ctx as unknown as Record<symbol, string | undefined>
    bag[PENDING_OAUTH_PROFILE_EMAIL] = email.toLowerCase()
  } catch {
    /* outside endpoint context */
  }
}

async function takePendingOAuthProfileEmail(): Promise<string | undefined> {
  try {
    const ctx = await getCurrentAuthContext()
    const bag = ctx as unknown as Record<symbol, string | undefined>
    const v = bag[PENDING_OAUTH_PROFILE_EMAIL]
    delete bag[PENDING_OAUTH_PROFILE_EMAIL]
    return v
  } catch {
    return undefined
  }
}

async function clearPendingOAuthProfileEmail() {
  try {
    const ctx = await getCurrentAuthContext()
    delete (ctx as unknown as Record<symbol, string | undefined>)[PENDING_OAUTH_PROFILE_EMAIL]
  } catch {
    /* */
  }
}

function oauthCallbackProviderId(context: { path?: string; params?: Record<string, string | undefined> }): string | null {
  const id = context.params?.id
  if (typeof id === "string" && id.length > 0) return id
  const providerId = context.params?.providerId
  if (typeof providerId === "string" && providerId.length > 0) return providerId
  const path = context.path ?? ""
  const tail = path.split("/").filter(Boolean).pop()
  return tail && tail !== "callback" ? tail : null
}

async function findUserByStoredOAuthIdentityEmail(
  internalAdapter: InternalAdapterLike,
  normalizedEmail: string,
): Promise<{ user: { id: string }; accounts: unknown[] } | null> {
  const rows = await db
    .select({ userId: account.userId })
    .from(oauthAccountIdentity)
    .innerJoin(account, eq(oauthAccountIdentity.accountId, account.id))
    .where(eq(oauthAccountIdentity.email, normalizedEmail))

  const userIds = [...new Set(rows.map((r) => r.userId))]
  if (userIds.length === 0) return null
  if (userIds.length > 1) {
    throw new Error(
      "The same OAuth provider email is associated with more than one user. Remove the duplicate or contact support.",
    )
  }

  const user = await internalAdapter.findUserById(userIds[0])
  if (!user) return null

  const accounts = await internalAdapter.findAccounts(user.id)
  return { user, accounts }
}

function patchInternalAdapter(ia: InternalAdapterLike & { [ADAPTER_OAUTH_IDENTITY_PATCHED]?: true }) {
  if (ia[ADAPTER_OAUTH_IDENTITY_PATCHED]) return
  ia[ADAPTER_OAUTH_IDENTITY_PATCHED] = true

  const originalFindOAuthUser = ia.findOAuthUser.bind(ia)
  ia.findOAuthUser = async (email: string, accountId: string, providerId: string) => {
    await setPendingOAuthProfileEmail(email)
    const direct = await originalFindOAuthUser(email, accountId, providerId)
    if (direct) return direct
    return findUserByStoredOAuthIdentityEmail(ia, email.toLowerCase())
  }

  const originalLinkAccount = ia.linkAccount.bind(ia)
  ia.linkAccount = async (accountRow: Record<string, unknown>) => {
    const created = await originalLinkAccount(accountRow)
    const email = await takePendingOAuthProfileEmail()
    if (email && created?.id) {
      const profile = readOAuthProfileFromAccountRecord(
        created as { id?: string | null; idToken?: string | null },
      )
      await upsertOAuthIdentity(created.id, email, profile.image ?? undefined)
    }
    return created
  }

  const originalCreateOAuthUser = ia.createOAuthUser.bind(ia)
  ia.createOAuthUser = async (user: Record<string, unknown>, accountRow: Record<string, unknown>) => {
    const out = await originalCreateOAuthUser(user, accountRow)
    const email = typeof out.user?.email === "string" ? out.user.email.toLowerCase() : undefined
    if (email && out.account?.id) {
      const profile = readOAuthProfileFromAccountRecord(
        out.account as { id?: string | null; idToken?: string | null },
      )
      await upsertOAuthIdentity(out.account.id, email, profile.image ?? undefined)
    }
    const userRecord = out.user as { id: string; name?: unknown; email?: string | null }
    const currentName = typeof userRecord.name === "string" ? userRecord.name.trim() : ""
    if (email && userRecord.id && (!currentName || currentName.toLowerCase() === email)) {
      const local = email.split("@")[0]?.trim()
      if (local) {
        await db.update(userTable).set({ name: local }).where(eq(userTable.id, userRecord.id))
      }
    }
    await clearPendingOAuthProfileEmail()
    return out
  }

  const originalUpdateAccount = ia.updateAccount.bind(ia)
  ia.updateAccount = async (id: string, data: Record<string, unknown>) => {
    const updated = await originalUpdateAccount(id, data)
    const email = await takePendingOAuthProfileEmail()
    if (email && id) {
      const profile = readOAuthProfileFromAccountRecord(
        updated as { id?: string | null; idToken?: string | null },
      )
      await upsertOAuthIdentity(id, email, profile.image ?? undefined)
    }
    return updated
  }
}

/**
 * Better Auth only matches OAuth sign-in to existing users via `user.email`.
 * We also store per-provider emails in `oauth_account_identity`; extend resolution so
 * signing in with provider R and email M links to the user who already has that email
 * on another provider (unless account linking is blocked by settings — enforced elsewhere).
 *
 * On every OAuth callback we persist the provider profile email into `oauth_account_identity`
 * (via pending email captured from `findOAuthUser` + account create/link/update), so matching
 * by M stays correct even when `user.email` differs or there is no JWT email on the account row.
 */
export function oauthIdentityEmailLinkPlugin(): BetterAuthPlugin {
  return {
    id: "oauth-identity-email-link",
    init() {
      return {
        options: {
          databaseHooks: {
            account: {
              create: {
                after: async (created) => {
                  const fromJwt = readOAuthProfileFromAccountRecord(created)
                  const email = fromJwt.email ?? readOAuthEmailFromAccountRecord(created)
                  if (email) await upsertOAuthIdentity(created.id, email, fromJwt.image ?? undefined)
                },
              },
              update: {
                after: async (updated) => {
                  const fromJwt = readOAuthProfileFromAccountRecord(updated)
                  const email = fromJwt.email ?? readOAuthEmailFromAccountRecord(updated)
                  if (email) await upsertOAuthIdentity(updated.id, email, fromJwt.image ?? undefined)
                },
              },
            },
            session: {
              create: {
                after: async (session, context) => {
                  if (!context || !session.userId) return
                  if (!isOAuthCallbackPath(context.path)) return
                  const email = await takePendingOAuthProfileEmail()
                  if (!email) return
                  const providerId = oauthCallbackProviderId(context)
                  if (!providerId) {
                    await clearPendingOAuthProfileEmail()
                    return
                  }
                  const [row] = await db
                    .select({ id: account.id })
                    .from(account)
                    .where(and(eq(account.userId, session.userId), eq(account.providerId, providerId)))
                    .orderBy(desc(account.updatedAt))
                    .limit(1)
                  if (row) await upsertOAuthIdentity(row.id, email)
                },
              },
            },
          },
        },
      }
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => isOAuthCallbackPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            patchInternalAdapter(ctx.context.internalAdapter as unknown as InternalAdapterLike)
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => isOAuthCallbackPath(ctx.path),
          handler: createAuthMiddleware(async () => {
            await clearPendingOAuthProfileEmail()
          }),
        },
      ],
    },
  }
}
