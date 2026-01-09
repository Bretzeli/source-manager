import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { username } from "better-auth/plugins/username";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { genericOAuth } from "better-auth/plugins/generic-oauth";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is not set");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL environment variable is not set");
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
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    },
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
    // Atlassian OAuth - using generic OAuth plugin
    genericOAuth({
      config: [
        {
          providerId: "atlassian",
          clientId: process.env.ATLASSIAN_CLIENT_ID || "",
          clientSecret: process.env.ATLASSIAN_CLIENT_SECRET || "",
          scopes: ["read:user", "offline_access"],
          authorizationUrl: "https://auth.atlassian.com/authorize",
          tokenUrl: "https://auth.atlassian.com/oauth/token",
          userInfoUrl: "https://api.atlassian.com/me",
          authorizationUrlParams: {
            audience: "api.atlassian.com",
            prompt: "consent",
          },
          mapProfileToUser: (profile: Record<string, unknown>) => {
            return {
              id: (profile.account_id as string) || (profile.id as string),
              name: (profile.name as string) || (profile.displayName as string),
              email: profile.email as string,
              image: (profile.picture as string) || (profile.avatar_url as string),
            };
          },
        },
      ],
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

