import { createAuthMiddleware } from "@better-auth/core/api"
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context"
import type { BetterAuthPlugin } from "better-auth"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { account, oauthAccountIdentity } from "@/lib/db/schema"
import {
  readOAuthEmailFromAccountRecord,
  readOAuthProfileFromAccountRecord,
  upsertOAuthIdentity,
} from "@/lib/oauth-account-identity"

const ADAPTER_OAUTH_IDENTITY_PATCHED = Symbol("adapterOauthIdentityPatched")

/**
 * Stashed on the Better Auth endpoint context (one object per request) for the duration of an
 * OAuth callback, so it never leaks into other requests.
 */
const PENDING_OAUTH_PROFILE_EMAIL = Symbol.for("sourceManager.pendingOAuthProfileEmail")

type EndpointContextLike = {
  path?: string
  params?: Record<string, string | undefined>
}

type FoundUser = {
  user: { id: string; email?: string | null } & Record<string, unknown>
  accounts: unknown[]
}

type InternalAdapterLike = {
  findUserByEmail?: (email: string, options?: { includeAccounts: boolean }) => Promise<FoundUser | null>
  findUserById: (userId: string) => Promise<FoundUser["user"] | null>
  findAccounts: (userId: string) => Promise<unknown[]>
}

function isOAuthCallbackPath(path: string | undefined): boolean {
  if (!path) return false
  return path.startsWith("/callback/") || path.startsWith("/oauth2/callback/")
}

function endpointContext(context?: EndpointContextLike | null): EndpointContextLike | undefined {
  return context ?? (tryGetCurrentAuthEndpointContext() as EndpointContextLike | undefined)
}

function pendingBag(context?: EndpointContextLike | null): Record<symbol, string | undefined> | undefined {
  return endpointContext(context) as Record<symbol, string | undefined> | undefined
}

function setPendingOAuthProfileEmail(email: string, context?: EndpointContextLike | null) {
  const bag = pendingBag(context)
  if (bag) bag[PENDING_OAUTH_PROFILE_EMAIL] = email.toLowerCase()
}

function takePendingOAuthProfileEmail(context?: EndpointContextLike | null): string | undefined {
  const bag = pendingBag(context)
  if (!bag) return undefined
  const value = bag[PENDING_OAUTH_PROFILE_EMAIL]
  delete bag[PENDING_OAUTH_PROFILE_EMAIL]
  return value
}

function oauthCallbackProviderId(context: EndpointContextLike): string | null {
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
): Promise<FoundUser | null> {
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

/**
 * Better Auth resolves an OAuth sign-in by (1) the provider account key and (2) `user.email` via
 * `internalAdapter.findUserByEmail`. There is no public hook for (2), so during OAuth callbacks only
 * we fall back to the provider emails stored in `oauth_account_identity`.
 */
function patchInternalAdapter(ia: InternalAdapterLike & { [ADAPTER_OAUTH_IDENTITY_PATCHED]?: true }) {
  if (ia[ADAPTER_OAUTH_IDENTITY_PATCHED]) return
  ia[ADAPTER_OAUTH_IDENTITY_PATCHED] = true

  if (typeof ia.findUserByEmail !== "function") {
    // Degrade instead of failing every OAuth callback if a future Better Auth version renames it.
    console.warn(
      "[oauth-identity-email-link] internalAdapter.findUserByEmail is unavailable; " +
        "sign-in via stored provider emails is disabled.",
    )
    return
  }

  const originalFindUserByEmail = ia.findUserByEmail.bind(ia)
  ia.findUserByEmail = async (email, options) => {
    const direct = await originalFindUserByEmail(email, options)
    if (direct) return direct
    if (!isOAuthCallbackPath(endpointContext()?.path)) return direct
    return findUserByStoredOAuthIdentityEmail(ia, email.toLowerCase())
  }
}

/** Persists the provider email of an OAuth account row into `oauth_account_identity`. */
async function syncOAuthIdentity(
  record: { id?: string | null; idToken?: string | null } | null | undefined,
  context: EndpointContextLike | null | undefined,
) {
  if (!record?.id) return
  const profile = readOAuthProfileFromAccountRecord(record)
  // During an OAuth callback the provider profile email (captured in validateUserInfo) wins.
  const pending = isOAuthCallbackPath(context?.path) ? takePendingOAuthProfileEmail(context) : undefined
  const email = pending ?? profile.email ?? readOAuthEmailFromAccountRecord(record)
  if (email) await upsertOAuthIdentity(record.id, email, profile.image ?? undefined)
}

/**
 * Better Auth only matches OAuth sign-in to existing users via `user.email`.
 * We also store per-provider emails in `oauth_account_identity`; extend resolution so
 * signing in with provider R and email M links to the user who already has that email
 * on another provider (unless account linking is blocked by settings — enforced elsewhere).
 *
 * On every OAuth callback we persist the provider profile email into `oauth_account_identity`
 * (captured via `user.validateUserInfo`, written by the account create/update hooks), so matching
 * by M stays correct even when `user.email` differs or there is no JWT email on the account row.
 */
export function oauthIdentityEmailLinkPlugin(): BetterAuthPlugin {
  return {
    id: "oauth-identity-email-link",
    init() {
      return {
        options: {
          user: {
            // Runs for every OAuth sign-in, account link and OAuth user creation with the fresh
            // provider email. Only records it; it never rejects (Better Auth fails closed on throw).
            validateUserInfo: async (data, context) => {
              try {
                if (data.source.method !== "oauth") return
                const email = data.user.email
                if (typeof email === "string" && email.length > 0) {
                  setPendingOAuthProfileEmail(email, context as EndpointContextLike)
                }
              } catch {
                /* never block authentication */
              }
            },
          },
          databaseHooks: {
            user: {
              create: {
                // OAuth sign-ups without a real name get the email's local part as display name.
                before: async (newUser, context) => {
                  if (!isOAuthCallbackPath(context?.path)) return
                  const email = typeof newUser.email === "string" ? newUser.email.toLowerCase() : undefined
                  if (!email) return
                  const currentName = typeof newUser.name === "string" ? newUser.name.trim() : ""
                  if (currentName && currentName.toLowerCase() !== email) return
                  const local = email.split("@")[0]?.trim()
                  if (!local) return
                  return { data: { name: local } }
                },
              },
            },
            account: {
              create: {
                after: async (created, context) => {
                  await syncOAuthIdentity(created, context)
                },
              },
              update: {
                after: async (updated, context) => {
                  await syncOAuthIdentity(updated, context)
                },
              },
            },
            session: {
              create: {
                // Fallback when the callback did not create/update an account row (e.g. no fresh tokens).
                after: async (session, context) => {
                  if (!context || !session.userId) return
                  if (!isOAuthCallbackPath(context.path)) return
                  const email = takePendingOAuthProfileEmail(context)
                  if (!email) return
                  const providerId = oauthCallbackProviderId(context)
                  if (!providerId) return
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
    },
  }
}
