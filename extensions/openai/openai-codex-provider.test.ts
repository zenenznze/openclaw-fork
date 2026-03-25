import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginOpenAICodexOAuth: vi.fn(),
}));

vi.mock("openclaw/plugin-sdk/provider-auth-login", () => ({
  loginOpenAICodexOAuth: mocks.loginOpenAICodexOAuth,
}));

const { buildOpenAICodexProviderPlugin } = await import("./openai-codex-provider.js");

describe("buildOpenAICodexProviderPlugin auth", () => {
  it("honors an explicit profileName override from auth opts", async () => {
    mocks.loginOpenAICodexOAuth.mockResolvedValue({
      access: `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ "https://api.openai.com/profile": { email: "user@example.com" } })).toString("base64url")}.signature`,
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
      email: "user@example.com",
    });

    const plugin = buildOpenAICodexProviderPlugin();
    const method = plugin.auth?.[0];
    if (!method) throw new Error("missing auth method");

    const result = await method.run({
      config: {},
      agentDir: "/tmp/openclaw/agents/main",
      workspaceDir: "/tmp/openclaw/workspace",
      prompter: { note: vi.fn(), select: vi.fn() } as never,
      runtime: { log: vi.fn(), error: vi.fn(), exit: vi.fn() } as never,
      opts: { profileName: "codex2" },
      allowSecretRefPrompt: false,
      isRemote: false,
      openUrl: async () => {},
      oauth: { createVpsAwareHandlers: vi.fn() as never },
    });

    expect(result.profiles).toHaveLength(1);
    expect(result.profiles[0]?.profileId).toBe("openai-codex:codex2");
    expect(result.profiles[0]?.credential).toMatchObject({
      provider: "openai-codex",
      email: "user@example.com",
    });
  });
});
