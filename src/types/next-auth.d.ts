import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; timezone: string } & DefaultSession["user"];
    accessToken?: string;
    hasGoogleAuth?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    timezone?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
