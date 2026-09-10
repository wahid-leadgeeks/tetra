import { redirect } from "next/navigation";

import { MobileNav, SidebarNav } from "@/components/app-nav/app-nav";
import { HeaderNav } from "@/components/app-nav/header-nav";
import { SignOutButton } from "@/components/app-nav/sign-out-button";
import { Wordmark } from "@/components/app-nav/wordmark";
import { TourProvider } from "@/components/guide-tour/tour-provider";
import { KeyboardNav } from "@/components/keyboard/keyboard-nav";
import { NetworkStatusBanner } from "@/components/network-status";
import { auth } from "@/server/auth";

/**
 * Authenticated app shell: desktop sidebar + mobile bottom nav
 * (DESIGN.md responsive rules). Every route below requires a session.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (session?.error === "RefreshAccessTokenError") {
    redirect("/login?error=SessionExpired");
  }
  if (!session?.user?.id) {
    redirect("/login");
  }

  const email = session.user.email ?? "";
  const name = session.user.name ?? email.split("@")[0] ?? "User";
  const timezone = session.user.timezone ?? "Asia/Jakarta";

  return (
    <TourProvider>
      <div className="min-h-svh flex flex-col">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-6 pt-7 pb-7">
          <Wordmark />
        </div>
        <SidebarNav />
        <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border p-3">
          <p
            className="truncate px-3 pb-1 text-xs text-muted-foreground"
            title={email}
          >
            {email}
          </p>
          <SignOutButton />
        </div>
      </aside>

      <div className="md:pl-64 min-w-0 flex flex-col flex-1">
        <NetworkStatusBanner />
        <HeaderNav email={email} name={name} timezone={timezone} />
        <main className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-6 pb-28 sm:px-6 md:px-8 md:pt-8 md:pb-16 lg:max-w-6xl xl:max-w-7xl flex-1">
          {children}
        </main>
      </div>

      <MobileNav />
      <KeyboardNav />
    </div>
    </TourProvider>
  );
}
