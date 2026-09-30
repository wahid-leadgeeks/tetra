import Image from "next/image";
import { redirect } from "next/navigation";

import { MobileNav, SidebarNav } from "@/components/app-nav/app-nav";
import { HeaderNav } from "@/components/app-nav/header-nav";
import { SignOutButton } from "@/components/app-nav/sign-out-button";
import { Wordmark } from "@/components/app-nav/wordmark";
import { TourProvider } from "@/components/guide-tour/tour-provider";
import { KeyboardNav } from "@/components/keyboard/keyboard-nav";
import { NetworkStatusBanner } from "@/components/network-status";
import { NotificationBannerOverlay } from "@/components/notifications/notification-banner-overlay";
import { auth } from "@/server/auth";

/**
 * Authenticated app shell: desktop sidebar + mobile bottom nav
 * (DESIGN.md responsive rules). Every route below requires a session.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const isAuthDisabled =
    process.env.DISABLE_AUTH === "true" ||
    process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

  if (session?.error === "RefreshAccessTokenError" && !isAuthDisabled) {
    redirect("/login?error=SessionExpired");
  }
  if (!session?.user?.id && !isAuthDisabled) {
    redirect("/login");
  }

  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? email.split("@")[0] ?? "User";
  const image = session?.user?.image ?? null;
  const timezone = session?.user?.timezone ?? "Asia/Jakarta";
  const hasGoogleAuth = session?.hasGoogleAuth ?? false;

  const initials = (name || email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TourProvider>
      <div className="min-h-svh flex flex-col">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-6 pt-7 pb-7">
          <Wordmark />
        </div>
        <SidebarNav />
        <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-sidebar-accent/30">
            {image ? (
              <Image
                src={image}
                alt={name}
                width={32}
                height={32}
                unoptimized
                referrerPolicy="no-referrer"
                className="size-8 rounded-full object-cover shrink-0 border border-sidebar-border"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground" title={name}>
                {name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground" title={email}>
                {email}
              </p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="md:pl-64 min-w-0 flex flex-col flex-1">
        <NetworkStatusBanner />
        <HeaderNav email={email} name={name} image={image} timezone={timezone} hasGoogleAuth={hasGoogleAuth} />
        <NotificationBannerOverlay timezone={timezone} />
        <main className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-6 pb-28 sm:px-6 md:px-8 md:pt-8 md:pb-16 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] flex-1">
          {children}
        </main>
      </div>

      <MobileNav />
      <KeyboardNav />
    </div>
    </TourProvider>
  );
}
