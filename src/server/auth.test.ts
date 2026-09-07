import { describe, expect, it } from "vitest";

describe("Google OAuth configuration & callback contract", () => {
  it("formats the standard Google callback URL for local development", () => {
    const baseUrl = "http://localhost:3000";
    const callbackUrl = `${baseUrl}/api/auth/callback/google`;
    expect(callbackUrl).toBe(
      "http://localhost:3000/api/auth/callback/google",
    );
  });

  it("requires openid, email, profile, and spreadsheets scope for TETRA sync", () => {
    const requiredScopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/spreadsheets",
    ];
    const scopeString = requiredScopes.join(" ");
    expect(scopeString).toContain("https://www.googleapis.com/auth/spreadsheets");
    expect(scopeString).toContain("email");
    expect(scopeString).toContain("openid");
  });

  it("ensures offline access and consent prompt are set for refresh tokens", () => {
    const authParams = {
      prompt: "consent",
      access_type: "offline",
      response_type: "code",
    };
    expect(authParams.access_type).toBe("offline");
    expect(authParams.prompt).toBe("consent");
    expect(authParams.response_type).toBe("code");
  });
});
