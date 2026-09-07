import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
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
}): Promise<{ id: string; timezone: string }> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    const updates: Partial<{ googleId: string; image: string; name: string }> =
      {};
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
            "openid email profile https://www.googleapis.com/auth/spreadsheets",
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
      if (user) {
        const email = user.email ?? (token.email as string | undefined);
        if (email) {
          const googleId =
            account?.provider === "google"
              ? (account.providerAccountId as string | undefined)
              : undefined;
          const u = await upsertUser({
            name: user.name ?? email.split("@")[0] ?? email,
            email,
            image: user.image ?? undefined,
            googleId,
          });
          token.userId = u.id;
          token.timezone = u.timezone;
        }
      }
      if (account?.provider === "google") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.userId as string | undefined) ?? "";
      session.user.timezone =
        (token.timezone as string | undefined) ?? env.DEFAULT_TIMEZONE;
      return session;
    },
  },
});
