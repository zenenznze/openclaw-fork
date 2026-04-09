import { hasReplyPayloadContent } from "../interactive/payload.js";
import { FailoverError } from "./failover-error.js";
import type { EmbeddedPiRunResult } from "./pi-embedded-runner/types.js";

export function hasRenderableEmbeddedPiResult(result: EmbeddedPiRunResult): boolean {
  if (result.didSendViaMessagingTool) {
    return true;
  }
  return (result.payloads ?? []).some((payload) =>
    hasReplyPayloadContent(payload, { extraContent: false }),
  );
}

export function ensureEmbeddedPiRunResultHasRenderableOutput(params: {
  result: EmbeddedPiRunResult;
  provider: string;
  model: string;
}): void {
  if (hasRenderableEmbeddedPiResult(params.result)) {
    return;
  }
  throw new FailoverError(
    `Empty successful model response from ${params.provider}/${params.model}`,
    {
      reason: "unknown",
      provider: params.provider,
      model: params.model,
    },
  );
}
