import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { RuntimeEnv } from "../../runtime.js";

const mocks = vi.hoisted(() => ({
  resolveDefaultAgentId: vi.fn(),
  resolveAgentDir: vi.fn(),
  ensureAuthProfileStore: vi.fn(),
  setAuthProfileOrder: vi.fn(),
  loadModelsConfig: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: mocks.resolveDefaultAgentId,
  resolveAgentDir: mocks.resolveAgentDir,
}));

vi.mock("../../agents/auth-profiles.js", () => ({
  ensureAuthProfileStore: mocks.ensureAuthProfileStore,
  setAuthProfileOrder: mocks.setAuthProfileOrder,
}));

vi.mock("./load-config.js", () => ({
  loadModelsConfig: mocks.loadModelsConfig,
}));

const { modelsAuthOrderGetCommand, modelsAuthOrderSetCommand, modelsAuthOrderPreferCommand } =
  await import("./auth-order.js");

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

describe("models auth order commands", () => {
  let currentConfig: OpenClawConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    currentConfig = {};
    mocks.resolveDefaultAgentId.mockReturnValue("main");
    mocks.resolveAgentDir.mockReturnValue("/tmp/openclaw/agents/main");
    mocks.loadModelsConfig.mockImplementation(async () => currentConfig);
    mocks.ensureAuthProfileStore.mockReturnValue({
      profiles: {
        "openai-codex:default": { type: "oauth", provider: "openai-codex" },
        "openai-codex:codex2": { type: "oauth", provider: "openai-codex" },
        "anthropic:default": { type: "oauth", provider: "anthropic" },
      },
      order: undefined,
    });
    mocks.setAuthProfileOrder.mockImplementation(async ({ provider, order }) => ({
      profiles: {},
      order: order?.length ? { [provider]: order } : undefined,
    }));
  });

  it("returns current order in json mode", async () => {
    const runtime = createRuntime();
    mocks.ensureAuthProfileStore.mockReturnValue({
      profiles: {},
      order: { "openai-codex": ["openai-codex:codex2"] },
    });

    await modelsAuthOrderGetCommand({ provider: "openai-codex", json: true }, runtime);

    expect(runtime.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          agentId: "main",
          agentDir: "/tmp/openclaw/agents/main",
          provider: "openai-codex",
          authStorePath: "/tmp/openclaw/agents/main/auth-profiles.json",
          order: ["openai-codex:codex2"],
        },
        null,
        2,
      ),
    );
  });

  it("prefers a single profile by writing single-entry order override", async () => {
    const runtime = createRuntime();

    await modelsAuthOrderPreferCommand(
      { provider: "openai-codex", profileId: "openai-codex:codex2" },
      runtime,
    );

    expect(mocks.setAuthProfileOrder).toHaveBeenCalledWith({
      agentDir: "/tmp/openclaw/agents/main",
      provider: "openai-codex",
      order: ["openai-codex:codex2"],
    });
    expect(runtime.log).toHaveBeenCalledWith("Preferred auth profile: openai-codex:codex2");
    expect(runtime.log).toHaveBeenCalledWith("Order override: openai-codex:codex2");
  });

  it("rejects prefer when the profile belongs to another provider", async () => {
    const runtime = createRuntime();

    await expect(
      modelsAuthOrderPreferCommand(
        { provider: "openai-codex", profileId: "anthropic:default" },
        runtime,
      ),
    ).rejects.toThrow('Auth profile "anthropic:default" is for anthropic, not openai-codex.');
  });

  it("keeps existing set behavior for multiple profiles", async () => {
    const runtime = createRuntime();

    await modelsAuthOrderSetCommand(
      { provider: "openai-codex", order: ["openai-codex:default", "openai-codex:codex2"] },
      runtime,
    );

    expect(mocks.setAuthProfileOrder).toHaveBeenCalledWith({
      agentDir: "/tmp/openclaw/agents/main",
      provider: "openai-codex",
      order: ["openai-codex:default", "openai-codex:codex2"],
    });
  });
});
