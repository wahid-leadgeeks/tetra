/**
 * Typed fetch helper for the TETRA API surface.
 * Server errors are `{ error: string }` — surface the human message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, status: number): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  if (status === 401) return "You need to sign in to see this.";
  return `Request failed (${status}).`;
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const body = await parseBody(res);
  if (!res.ok) {
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      try {
        const { signOut } = await import("next-auth/react");
        void signOut({ redirectTo: "/login?error=SessionExpired" });
      } catch {
        window.location.replace(
          `${window.location.origin}/login?error=SessionExpired`,
        );
      }
    }
    throw new ApiError(errorMessage(body, res.status), res.status);
  }
  return body as T;
}
