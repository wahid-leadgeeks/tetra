import { NextResponse } from "next/server";
import { getCompanionAlerts } from "@/features/notifications/service";
import { auth } from "@/server/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await getCompanionAlerts(session.user.id);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("Failed to evaluate companion alerts:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load notifications" },
      { status: 500 },
    );
  }
}
