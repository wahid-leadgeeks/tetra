import type { Metadata } from "next";

import { env } from "@/server/env";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — TETRA",
};

export default function LoginPage() {
  return (
    <LoginForm
      googleEnabled={!!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET}
      devLoginEnabled={env.ALLOW_DEV_LOGIN}
    />
  );
}
