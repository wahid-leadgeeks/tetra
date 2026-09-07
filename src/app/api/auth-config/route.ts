import { NextResponse } from "next/server";

import { env } from "@/server/env";

/** GET /api/auth-config — which sign-in options this deployment offers. */
export async function GET() {
  const appUrl = env.APP_URL || "http://localhost:3000";
  return NextResponse.json({
    googleEnabled: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    devLoginEnabled: env.ALLOW_DEV_LOGIN,
    googleCallbackUrl: `${appUrl}/api/auth/callback/google`,
  });
}
