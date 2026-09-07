"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Wordmark } from "@/components/app-nav/wordmark";

interface LoginFormProps {
  googleEnabled: boolean;
  devLoginEnabled: boolean;
  authError?: string;
}

type PendingProvider = "google" | "dev" | null;

function GoogleIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function getAuthErrorMessage(error: string): string {
  switch (error) {
    case "SessionExpired":
      return "Your session has expired. Please sign in again to continue.";
    case "Configuration":
      return "Google OAuth credentials not configured. Please verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.";
    case "AccessDenied":
      return "Sign-in cancelled or access was denied in Google.";
    case "OAuthCallbackError":
    case "OAuthSignin":
    case "OAuthCreateAccount":
      return "Could not complete authentication with Google. Please try again.";
    default:
      return `Sign-in issue (${error}). Please try again.`;
  }
}

export function LoginForm({
  googleEnabled,
  devLoginEnabled,
  authError,
}: LoginFormProps) {
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
            {authError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive dark:border-destructive/40 dark:text-red-400"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{getAuthErrorMessage(authError)}</span>
              </div>
            ) : null}

            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2.5"
                onClick={handleGoogleSignIn}
                disabled={googlePending || devPending}
              >
                {googlePending ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </Button>
            ) : (
              <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Google Auth Callback URI
                </p>
                <code className="mt-1 block rounded bg-background px-1.5 py-1 text-[11px] font-mono break-all border border-border/60">
                  http://localhost:3000/api/auth/callback/google
                </code>
                <p className="mt-2 text-[11px]">
                  Set <span className="font-mono">GOOGLE_CLIENT_ID</span> and{" "}
                  <span className="font-mono">GOOGLE_CLIENT_SECRET</span> in{" "}
                  <span className="font-mono">.env.local</span> to activate.
                </p>
              </div>
            )}

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
