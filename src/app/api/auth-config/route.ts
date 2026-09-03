import { NextResponse } from "next/server";

import { env } from "@/server/env";

/** GET /api/auth-config — which sign-in options this deployment offers. */
export async function GET() {
  return NextResponse.json({
    googleEnabled: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    devLoginEnabled: env.ALLOW_DEV_LOGIN,
  });
}
