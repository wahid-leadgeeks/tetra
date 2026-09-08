import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";

/** Find-or-create the user row for an authenticated identity. */
async function upsertUser(input: {
  name: string;
  email: string;
  image?: string | null;
  googleId?: string;
  googleAccessToken?: string | null;
  googleRefreshToken?: string | null;
  googleTokenExpiresAt?: Date | null;
}): Promise<{ id: string; timezone: string }> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    const updates: Partial<{
      googleId: string;
      image: string;
      name: string;
      googleAccessToken: string | null;
      googleRefreshToken: string | null;
      googleTokenExpiresAt: Date | null;
    }> = {};
    if (input.googleId && u.googleId !== input.googleId) {
      updates.googleId = input.googleId;
    }
    if (input.image && u.image !== input.image) {
      updates.image = input.image;
    }
    if (
      input.name &&
      u.name !== input.name &&
      u.name === input.email.split("@")[0]
    ) {
      updates.name = input.name;
    }
    if (input.googleAccessToken !== undefined) {
      updates.googleAccessToken = input.googleAccessToken;
    }
    if (input.googleRefreshToken) {
      updates.googleRefreshToken = input.googleRefreshToken;
    }
    if (input.googleTokenExpiresAt !== undefined) {
      updates.googleTokenExpiresAt = input.googleTokenExpiresAt;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, u.id));
    }
    return { id: u.id, timezone: u.timezone };
  }
  const created = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      image: input.image ?? null,
      googleId: input.googleId,
      googleAccessToken: input.googleAccessToken ?? null,
      googleRefreshToken: input.googleRefreshToken ?? null,
      googleTokenExpiresAt: input.googleTokenExpiresAt ?? null,
      timezone: env.DEFAULT_TIMEZONE,
    })
    .returning();
  return { id: created[0].id, timezone: created[0].timezone };
}

const providers: NextAuthConfig["providers"] = [];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.readonly",
        },
      },
    }),
  );
}

if (env.ALLOW_DEV_LOGIN) {
  providers.push(
    Credentials({
      id: "dev-login",
      credentials: { email: {}, name: {} },
      authorize: async (creds) => {
        const parsed = z
          .object({ email: z.email(), name: z.string().min(1).optional() })
          .safeParse(creds);
        if (!parsed.success) return null;
        const { email, name } = parsed.data;
        const u = await upsertUser({
          name: name ?? email.split("@")[0] ?? email,
          email,
        });
        return { id: u.id, name: name ?? email.split("@")[0] ?? email, email };
      },
    }),
  );
}

/**
 * Refresh expired Google access token using the stored refresh token.
 */
async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    let refreshToken = token.refreshToken;

    // Fall back to database if refresh token is not on the JWT
    if (!refreshToken && token.userId) {
      const userRows = await db
        .select({ googleRefreshToken: users.googleRefreshToken })
        .from(users)
        .where(eq(users.id, token.userId))
        .limit(1);
      refreshToken = userRows[0]?.googleRefreshToken ?? undefined;
    }

    if (!refreshToken || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return token;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error(
        "Failed to refresh Google token in NextAuth JWT:",
        refreshedTokens,
      );
      if (token.userId) {
        await db
          .update(users)
          .set({
            googleAccessToken: null,
            googleRefreshToken: null,
            googleTokenExpiresAt: null,
          })
          .where(eq(users.id, token.userId as string))
          .catch(() => {});
      }
      return {
        ...token,
        accessToken: undefined,
        error: "RefreshAccessTokenError",
      };
    }

    const newAccessToken = refreshedTokens.access_token as string;
    const expiresIn = (refreshedTokens.expires_in as number) ?? 3600;
    const newExpiresAt = Math.floor(Date.now() / 1000 + expiresIn);
    const newRefreshToken =
      (refreshedTokens.refresh_token as string) ?? refreshToken;

    if (token.userId && newAccessToken) {
      await db
        .update(users)
        .set({
          googleAccessToken: newAccessToken,
          googleTokenExpiresAt: new Date(newExpiresAt * 1000),
          googleRefreshToken: newRefreshToken,
        })
        .where(eq(users.id, token.userId));
    }

    return {
      ...token,
      accessToken: newAccessToken,
      expiresAt: newExpiresAt,
      refreshToken: newRefreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("Error in refreshGoogleAccessToken:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  secret: env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        token.accessToken = account.access_token;
        if (account.refresh_token) {
          token.refreshToken = account.refresh_token;
        }
        token.expiresAt = account.expires_at;
      }
      if (user) {
        const email = user.email ?? (token.email as string | undefined);
        if (email) {
          const isGoogle = account?.provider === "google";
          const googleId = isGoogle
            ? (account.providerAccountId as string | undefined)
            : undefined;
          const u = await upsertUser({
            name: user.name ?? email.split("@")[0] ?? email,
            email,
            image: user.image ?? undefined,
            googleId,
            googleAccessToken: isGoogle ? (account.access_token ?? null) : undefined,
            googleRefreshToken: isGoogle
              ? (account.refresh_token ?? undefined)
              : undefined,
            googleTokenExpiresAt:
              isGoogle && account.expires_at
                ? new Date(account.expires_at * 1000)
                : undefined,
          });
          token.userId = u.id;
          token.timezone = u.timezone;
        }
        return token;
      }

      // If Google access token is expired or expiring within 60 seconds, refresh it
      if (
        token.expiresAt &&
        typeof token.expiresAt === "number" &&
        Date.now() >= token.expiresAt * 1000 - 60_000
      ) {
        return refreshGoogleAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.userId as string | undefined) ?? "";
      session.user.timezone =
        (token.timezone as string | undefined) ?? env.DEFAULT_TIMEZONE;
      session.accessToken = token.accessToken as string | undefined;
      session.hasGoogleAuth = !!token.accessToken;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});
