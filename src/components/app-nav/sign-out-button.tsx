"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Ends the session and returns to the login screen. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-11 w-full justify-start gap-3 px-3 font-normal text-muted-foreground hover:text-foreground"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ redirectTo: "login" });
      }}
    >
      {pending ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : (
        <LogOut aria-hidden />
      )}
      Sign out
    </Button>
  );
}
