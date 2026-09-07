import type { Metadata } from "next";

import { env } from "@/server/env";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — TETRA",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <LoginForm
      googleEnabled={!!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET}
      devLoginEnabled={env.ALLOW_DEV_LOGIN}
      authError={error}
    />
  );
}
