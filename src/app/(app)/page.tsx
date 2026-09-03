import { TodayScreen } from "@/components/today/today-screen";
import { auth } from "@/server/auth";

/**
 * Today screen (DESIGN.md): what am I working on, how much have I tracked.
 * The RSC supplies the session timezone and a server timestamp so the client
 * timer starts from server truth — durations are never client-authoritative.
 */
export default async function TodayPage() {
  const session = await auth();
  const timezone = session?.user.timezone ?? "UTC";

  return (
    <TodayScreen timezone={timezone} nowIso={new Date().toISOString()} />
  );
}
