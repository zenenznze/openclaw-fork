import { describe, expect, it } from "vitest";
import { resolveCodexAuthIdentity } from "./codex-auth-identity.js";

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("resolveCodexAuthIdentity (core)", () => {
  it("prefers JWT profile email when present", () => {
    const identity = resolveCodexAuthIdentity({
      accessToken: createJwt({
        "https://api.openai.com/profile": {
          email: "jwt-user@example.com",
        },
      }),
      email: "credential@example.com",
      accountId: "acct_fallback",
    });

    expect(identity).toEqual({
      email: "jwt-user@example.com",
      profileName: "jwt-user@example.com",
    });
  });

  it("falls back to accountId when JWT has no email", () => {
    const identity = resolveCodexAuthIdentity({
      accessToken: createJwt({}),
      accountId: "acct_456",
    });

    expect(identity).toEqual({
      profileName: `id-${Buffer.from("acct_456").toString("base64url")}`,
    });
  });

  it("returns no metadata when token parsing yields no identity", () => {
    expect(resolveCodexAuthIdentity({ accessToken: "not-a-jwt-token" })).toEqual({});
  });
});
