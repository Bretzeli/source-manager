import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq, ne } from "drizzle-orm";
import { customSession } from "better-auth/plugins";
import { db } from "./db";
import { username } from "better-auth/plugins/username";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { oauthIdentityEmailLinkPlugin } from "./auth-oauth-identity-link-plugin";
import { account, oauthAccountIdentity, user } from "./db/schema";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is not set");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL environment variable is not set");
}

const appOrigin = process.env.BETTER_AUTH_URL.replace(/\/$/, "");

async function applyDisplayProfileToSessionPayload(payload: {
  session: Record<string, unknown>
  user: Record<string, unknown>
}) {
  const userId = typeof payload.user.id === "string" ? payload.user.id : null
  if (!userId) return payload

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

  if (!row) return payload

  const explicitDisplayEmail = row.displayEmail?.trim()
  const effectiveEmail =
    explicitDisplayEmail && explicitDisplayEmail.length > 0 ? explicitDisplayEmail : row.email

  let effectiveImage: string | null = null
  if (row.displayImageAccountId) {
    const [imgRow] = await db
      .select({ url: oauthAccountIdentity.profileImageUrl })
      .from(oauthAccountIdentity)
      .where(eq(oauthAccountIdentity.accountId, row.displayImageAccountId))
      .limit(1)
    effectiveImage = imgRow?.url ?? null
  } else {
    effectiveImage = row.image ?? null
  }

  return {
    ...payload,
    user: {
      ...payload.user,
      email: effectiveEmail,
      image: effectiveImage,
    },
  }
}

/** Atlassian 3LO scopes (space-separated). Must match what is enabled under Permissions → User identity API. */
function atlassianOAuthScopes(): string[] {
  const raw = process.env.ATLASSIAN_OAUTH_SCOPES?.trim()
  if (raw) return raw.split(/\s+/).filter(Boolean)
  return ["read:me"]
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  user: {
    additionalFields: {
      displayEmail: {
        type: "string",
        required: false,
        input: false,
      },
      displayImageAccountId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, 
    sendResetPassword: async (data: { user: { email: string; id: string; name?: string | null; emailVerified?: boolean; image?: string | null; createdAt?: Date; updatedAt?: Date; [key: string]: unknown }; url: string; token: string }) => {
      const { user, url, token } = data;
      // TODO: Implement  email sending logic here
      // Needs email provider (e.g., Resend, SendGrid, etc.)
      // For now, this is a placeholder that logs the password reset info
      console.log("Password reset email:", { 
        user: user.email, 
        url, 
        token 
      });
    },
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET
      ? {
          atlassian: {
            clientId: process.env.ATLASSIAN_CLIENT_ID,
            clientSecret: process.env.ATLASSIAN_CLIENT_SECRET,
            // Skip default read:jira-user (Jira site). Use User Identity only — see ATLASSIAN_OAUTH_SCOPES.
            // Atlassian still maps OAuth to "sites"; accounts with no Cloud site may see
            // "User identity site ... create a site" until you add a free Cloud product to that account.
            disableDefaultScope: true,
            scope: atlassianOAuthScopes(),
            prompt: "consent",
          },
        }
      : {}),
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 15,
    }),
    // One-time token plugin for password reset with email
    oneTimeToken({
      expiresIn: 15, 
    }),
    oauthIdentityEmailLinkPlugin(),
    customSession(async (payload) => {
      const data = payload as { session: Record<string, unknown>; user: Record<string, unknown> }
      return applyDisplayProfileToSessionPayload(data)
    }),
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    generateId: () => crypto.randomUUID(),
  },
  onAPIError: {
    errorURL: `${appOrigin}/auth/oauth-error`,
  },
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  account: {
    accountLinking: {
      allowDifferentEmails: true,
      trustedProviders: ["github", "google", "discord", "atlassian"],
    },
  },
  databaseHooks: {
    account: {
      create: {
        before: async (nextAccount, context) => {
          if (!nextAccount.userId || !nextAccount.providerId) {
            return;
          }

          // Manual linking via /link-social is explicitly allowed.
          if (context?.path?.includes("/link-social")) {
            return;
          }

          const [owner] = await db
            .select({ allowDifferentProviders: user.allowDifferentProviders })
            .from(user)
            .where(eq(user.id, nextAccount.userId))
            .limit(1);

          if (!owner || owner.allowDifferentProviders) {
            return;
          }

          const existingDifferentProvider = await db
            .select({ id: account.id })
            .from(account)
            .where(
              and(
                eq(account.userId, nextAccount.userId),
                ne(account.providerId, nextAccount.providerId),
              ),
            )
            .limit(1);

          if (existingDifferentProvider.length > 0) {
            throw new Error(
              "Only one account is allowed per mail address and you have disabled automatic cross-provider linking in your account settings.",
            );
          }
        },
      },
    },
  },
});

