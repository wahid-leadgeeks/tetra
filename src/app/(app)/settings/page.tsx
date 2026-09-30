import { auth } from "@/server/auth";
import { SettingsView } from "@/components/settings/settings-view";

const FALLBACK_TIMEZONE = "Asia/Jakarta";

export const metadata = {
  title: "Settings — TETRA",
};

export default async function SettingsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const name = session?.user?.name ?? null;
  const image = session?.user?.image ?? null;
  const hasGoogleAuth = session?.hasGoogleAuth ?? false;
  const userTimezone = session?.user?.timezone ?? FALLBACK_TIMEZONE;

  return (
    <SettingsView
      email={email}
      name={name}
      image={image}
      hasGoogleAuth={hasGoogleAuth}
      userTimezone={userTimezone}
    />
  );
}
