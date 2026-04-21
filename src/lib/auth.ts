import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { username } from "better-auth/plugins/username";
import { oneTimeToken } from "better-auth/plugins/one-time-token";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is not set");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL environment variable is not set");
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
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            tenantId: process.env.MICROSOFT_TENANT_ID || "common",
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
  ],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    generateId: () => crypto.randomUUID(),
  },
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  accountLinking: {
    allowDifferentEmails: true,
  },
});

