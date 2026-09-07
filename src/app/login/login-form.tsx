"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Wordmark } from "@/components/app-nav/wordmark";

interface LoginFormProps {
  googleEnabled: boolean;
  devLoginEnabled: boolean;
}

type PendingProvider = "google" | "dev" | null;

export function LoginForm({ googleEnabled, devLoginEnabled }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<PendingProvider>(null);

  const devPending = pending === "dev";
  const googlePending = pending === "google";

  async function handleGoogleSignIn() {
    setPending("google");
    try {
      // Full-page redirect to Google; on failure next-auth returns to /login.
      await signIn("google", { redirectTo: "/" });
    } catch {
      toast.error("Couldn't start Google sign-in", {
        description: "Please try again.",
      });
    } finally {
      setPending(null);
    }
  }

  async function handleDevSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      toast.error("Enter your email to sign in");
      return;
    }
    const trimmedName = name.trim();
    setPending("dev");
    try {
      const result = await signIn("dev-login", {
        email: trimmedEmail,
        ...(trimmedName.length > 0 ? { name: trimmedName } : {}),
        redirect: false,
      });
      if (!result || result.error) {
        toast.error("Sign-in failed", {
          description: "Check the email address and try again.",
        });
        return;
      }
      router.replace("/");
    } catch {
      toast.error("Sign-in failed", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="flex flex-col items-center gap-3 pb-8 text-center">
          <Wordmark className="text-xl" iconSize={26} />
          <p className="text-sm text-muted-foreground">
            Task, Employee, Time &amp; Resource Analytics
          </p>
        </div>

        <Card className="w-full">
          <CardContent className="flex flex-col gap-6">
            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={handleGoogleSignIn}
                disabled={googlePending || devPending}
              >
                {googlePending ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : null}
                Continue with Google
              </Button>
            ) : null}

            {googleEnabled && devLoginEnabled ? (
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
            ) : null}

            {devLoginEnabled ? (
              <form
                className="flex flex-col gap-5"
                onSubmit={handleDevSignIn}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="h-11"
                    data-testid="login-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={pending !== null}
                    required
                    suppressHydrationWarning
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="login-name">
                    Name{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="login-name"
                    type="text"
                    autoComplete="name"
                    placeholder="How you'll appear in reports"
                    className="h-11"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={pending !== null}
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full"
                  data-testid="login-submit"
                  disabled={pending !== null}
                >
                  {devPending ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : null}
                  Sign in
                </Button>
              </form>
            ) : null}

            {!googleEnabled && !devLoginEnabled ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Sign-in isn&apos;t configured yet. Ask your administrator to
                set it up.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
