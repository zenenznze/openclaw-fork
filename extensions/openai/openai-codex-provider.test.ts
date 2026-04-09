import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshOpenAICodexToken: vi.fn(),
  loginOpenAICodexOAuth: vi.fn(),
}));

vi.mock("./openai-codex-provider.runtime.js", () => ({
  refreshOpenAICodexToken: mocks.refreshOpenAICodexToken,
}));

vi.mock("openclaw/plugin-sdk/provider-auth-login", () => ({
  loginOpenAICodexOAuth: mocks.loginOpenAICodexOAuth,
}));

let buildOpenAICodexProviderPlugin: typeof import("./openai-codex-provider.js").buildOpenAICodexProviderPlugin;

describe("openai codex provider", () => {
  beforeAll(async () => {
    ({ buildOpenAICodexProviderPlugin } = await import("./openai-codex-provider.js"));
  });

  beforeEach(() => {
    mocks.refreshOpenAICodexToken.mockReset();
    mocks.loginOpenAICodexOAuth.mockReset();
  });

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

  it("falls back to the cached credential when accountId extraction fails", async () => {
    const provider = buildOpenAICodexProviderPlugin();
    const credential = {
      type: "oauth" as const,
      provider: "openai-codex",
      access: "cached-access-token",
      refresh: "refresh-token",
      expires: Date.now() - 60_000,
    };
    mocks.refreshOpenAICodexToken.mockRejectedValueOnce(
      new Error("Failed to extract accountId from token"),
    );

    await expect(provider.refreshOAuth?.(credential)).resolves.toEqual(credential);
  });

  it("rethrows unrelated refresh failures", async () => {
    const provider = buildOpenAICodexProviderPlugin();
    const credential = {
      type: "oauth" as const,
      provider: "openai-codex",
      access: "cached-access-token",
      refresh: "refresh-token",
      expires: Date.now() - 60_000,
    };
    mocks.refreshOpenAICodexToken.mockRejectedValueOnce(new Error("invalid_grant"));

    await expect(provider.refreshOAuth?.(credential)).rejects.toThrow("invalid_grant");
  });

  it("merges refreshed oauth credentials", async () => {
    const provider = buildOpenAICodexProviderPlugin();
    const credential = {
      type: "oauth" as const,
      provider: "openai-codex",
      access: "cached-access-token",
      refresh: "refresh-token",
      expires: Date.now() - 60_000,
      email: "user@example.com",
      displayName: "User",
    };
    mocks.refreshOpenAICodexToken.mockResolvedValueOnce({
      access: "next-access",
      refresh: "next-refresh",
      expires: Date.now() + 60_000,
    });

    await expect(provider.refreshOAuth?.(credential)).resolves.toEqual({
      ...credential,
      access: "next-access",
      refresh: "next-refresh",
      expires: expect.any(Number),
    });
  });

  it("returns deprecated-profile doctor guidance for legacy Codex CLI ids", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.buildAuthDoctorHint?.({
        provider: "openai-codex",
        profileId: "openai-codex:codex-cli",
        config: undefined,
        store: { version: 1, profiles: {} },
      }),
    ).toBe(
      "Deprecated profile. Run `openclaw models auth login --provider openai-codex` or `openclaw configure`.",
    );
  });

  it("owns native reasoning output mode for Codex responses", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.resolveReasoningOutputMode?.({
        provider: "openai-codex",
        modelApi: "openai-codex-responses",
        modelId: "gpt-5.4",
      } as never),
    ).toBe("native");
  });

  it("resolves gpt-5.4 with native contextWindow plus default contextTokens cap", () => {
    const provider = buildOpenAICodexProviderPlugin();

    const model = provider.resolveDynamicModel?.({
      provider: "openai-codex",
      modelId: "gpt-5.4",
      modelRegistry: {
        find: (providerId: string, modelId: string) => {
          if (providerId === "openai-codex" && modelId === "gpt-5.3-codex") {
            return {
              id: "gpt-5.3-codex",
              name: "gpt-5.3-codex",
              provider: "openai-codex",
              api: "openai-codex-responses",
              baseUrl: "https://chatgpt.com/backend-api",
              reasoning: true,
              input: ["text", "image"] as const,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 272_000,
              maxTokens: 128_000,
            };
          }
          return undefined;
        },
      } as never,
    });

    expect(model).toMatchObject({
      id: "gpt-5.4",
      contextWindow: 1_050_000,
      contextTokens: 272_000,
      maxTokens: 128_000,
    });
  });

  it("resolves gpt-5.4-mini from codex templates with codex-sized limits", () => {
    const provider = buildOpenAICodexProviderPlugin();

    const model = provider.resolveDynamicModel?.({
      provider: "openai-codex",
      modelId: "gpt-5.4-mini",
      modelRegistry: {
        find: (providerId: string, modelId: string) => {
          if (providerId === "openai-codex" && modelId === "gpt-5.1-codex-mini") {
            return {
              id: "gpt-5.1-codex-mini",
              name: "gpt-5.1-codex-mini",
              provider: "openai-codex",
              api: "openai-codex-responses",
              baseUrl: "https://chatgpt.com/backend-api",
              reasoning: true,
              input: ["text", "image"],
              cost: { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 },
              contextWindow: 272_000,
              maxTokens: 128_000,
            };
          }
          return null;
        },
      } as never,
    } as never);

    expect(model).toMatchObject({
      id: "gpt-5.4-mini",
      contextWindow: 272_000,
      maxTokens: 128_000,
      cost: { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 },
    });
    expect(model).not.toHaveProperty("contextTokens");
  });

  it("augments catalog with gpt-5.4 native contextWindow and runtime cap", () => {
    const provider = buildOpenAICodexProviderPlugin();

    const entries = provider.augmentModelCatalog?.({
      env: process.env,
      entries: [
        {
          id: "gpt-5.3-codex",
          name: "gpt-5.3-codex",
          provider: "openai-codex",
          reasoning: true,
          input: ["text", "image"],
          contextWindow: 272_000,
        },
      ],
    } as never);

    expect(entries).toContainEqual(
      expect.objectContaining({
        id: "gpt-5.4",
        contextWindow: 1_050_000,
        contextTokens: 272_000,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        id: "gpt-5.4-mini",
        contextWindow: 272_000,
      }),
    );
  });
});
