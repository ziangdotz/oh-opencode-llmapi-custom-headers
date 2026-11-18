import type { Plugin } from "@opencode/plugin";
import { Integration, Model, Provider } from "@opencode/plugin";
import type { Config } from "../core/config.js";
export function registerProviders(ctx: Plugin.Context, get: () => Config) {
  return ctx.provider.transform((editor) => {
    for (const [id, r] of Object.entries(get().providers)) {
      const providerID = Provider.ID.make(`llmapi-${id}`);
      if (editor.get(providerID))
        throw new Error(`Provider collision: ${providerID}`);
      editor.add({
        info: {
          ...Provider.Info.empty(providerID),
          name: id,
          integrationID: Integration.ID.make(`llmapi-${id}`),
          activation: "enabled",
          package:
            r.api === "anthropic-messages"
              ? "@opencode/ai/providers/anthropic"
              : r.api === "openai-responses"
                ? "@opencode/ai/providers/openai"
                : "@opencode/ai/providers/openai-compatible",
          settings: { baseURL: r.baseURL },
          headers: r.headers,
        },
        models: r.models.map((m) => ({
          ...Model.Info.default(providerID, Model.ID.make(m.id)),
          name: m.id,
          capabilities: { tools: true, input: m.input, output: ["text"] },
          limit: { context: m.contextWindow, output: m.maxTokens },
          variants: m.reasoningEfforts
            ? Object.entries(m.reasoningEfforts).map(([level, wire]) => ({
                id: Model.VariantID.make(level),
                body:
                  wire === null
                    ? {}
                    : r.api === "openai-responses"
                      ? { reasoning: { effort: wire } }
                      : { reasoning_effort: wire },
              }))
            : [],
        })),
      });
    }
  });
}
