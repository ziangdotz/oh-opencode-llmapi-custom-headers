import test from "node:test";
import assert from "node:assert/strict";
import type { Plugin } from "@opencode/plugin";
import { configSchema } from "../src/core/config.js";
import { registerProviders } from "../src/server/providers.js";
test("custom and shared credential integrations are associated with their provider", async () => {
  const config = configSchema.parse({
    providers: {
      own: { api: "openai-responses", baseURL: "https://example.com" },
      shared: {
        api: "openai-completions",
        baseURL: "https://example.com",
        credential: "existing",
      },
    },
  });
  const added: { info: { id: string; integrationID?: string } }[] = [];
  const ctx = {
    provider: {
      transform: async (fn: (editor: unknown) => void) => {
        fn({
          get: () => undefined,
          add: (value: (typeof added)[number]) => added.push(value),
        });
        return { dispose: async () => {} };
      },
    },
  };
  await registerProviders(ctx as unknown as Plugin.Context, () => config);
  assert.deepEqual(
    added.map((p) => [p.info.id, p.info.integrationID]),
    [
      ["llmapi-own", "llmapi-own"],
      ["llmapi-shared", "existing"],
    ],
  );
});
