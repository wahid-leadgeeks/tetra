import { redirect } from "next/navigation";

import { MobileNav, SidebarNav } from "@/components/app-nav/app-nav";
import { SignOutButton } from "@/components/app-nav/sign-out-button";
import { Wordmark } from "@/components/app-nav/wordmark";
import { auth } from "@/server/auth";

/**
 * Authenticated app shell: desktop sidebar + mobile bottom nav
 * (DESIGN.md responsive rules). Every route below requires a session.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const email = session.user.email ?? "";

  return (
    <div className="min-h-svh">
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

      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-2xl px-6 pt-10 pb-32 md:px-10 md:pt-14 md:pb-20">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
