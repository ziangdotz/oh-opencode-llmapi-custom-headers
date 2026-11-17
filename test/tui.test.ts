import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "../src/tui/management.js";
import { configSchema } from "../src/core/config.js";
import type { Plugin } from "@opencode/plugin/tui";
function harness(
  selections: string[],
  prompts: (string | undefined)[] = [],
  confirm = true,
) {
  const state = {
    revision: 0,
    config: configSchema.parse({
      providers: {
        demo: {
          api: "openai-completions",
          baseURL: "https://example.com",
          models: [
            {
              id: "vision",
              input: ["image"],
              reasoningEfforts: { high: "high" },
            },
          ],
        },
      },
    }),
  };
  let commands: { slash?: { name: string }; run: () => Promise<void> }[] = [];
  const saves: unknown[] = [];
  const messages: string[] = [];
  const syncs: string[] = [];
  const rpc = {
    read: async (
      _input: unknown,
      options: { location: { directory: string } },
    ) => {
      assert.equal(options.location.directory, "C:/test");
      return structuredClone(state);
    },
    save: async (input: unknown) => {
      saves.push(input);
      return { message: "" };
    },
    discover: async () => [{ id: "vision" }, { id: "new" }],
    refresh: async () => null,
  };
  const ctx = {
    location: { directory: "C:/test" },
    data: {
      location: {
        integration: {
          sync: async () => {
            syncs.push("integration");
          },
        },
        provider: {
          sync: async () => {
            syncs.push("provider");
          },
        },
        model: {
          sync: async () => {
            syncs.push("model");
          },
        },
      },
    },
    client: { rpc: () => rpc, plugin: { list: async () => ({ data: [] }) } },
    keymap: {
      layer: (factory: () => { mode: string; commands: typeof commands }) => {
        const layer = factory();
        assert.equal(layer.mode, "global");
        assert.deepEqual(
          layer.commands.map((c) => c.slash?.name),
          ["llmapi-custom-headers"],
        );
        commands = layer.commands;
      },
    },
    ui: {
      dialog: {
        select: async () => selections.shift(),
        prompt: async () => prompts.shift(),
        confirm: async () => confirm,
        alert: async (input: { message: string }) => {
          messages.push(input.message);
        },
      },
    },
  };
  setup(ctx as unknown as Plugin.Context);
  return {
    run: (name: string) => commands.find((c) => c.slash?.name === name)!.run(),
    syncs,
    saves,
    messages,
  };
}
test("TUI discovery merges models without erasing vision and reasoning settings", async () => {
  const h = harness(["discover", "demo"]);
  await h.run("llmapi-custom-headers");
  const saved = h.saves[0] as {
    config: { providers: { demo: { models: unknown[] } } };
  };
  assert.deepEqual(saved.config.providers.demo.models[0], {
    id: "vision",
    input: ["image"],
    reasoningEfforts: { high: "high" },
    contextWindow: 262144,
    maxTokens: 32768,
  });
  assert.equal(saved.config.providers.demo.models.length, 2);
});
test("TUI deletion requires confirmation and never mutates credentials", async () => {
  const cancelled = harness(["delete", "demo"], [], false);
  await cancelled.run("llmapi-custom-headers");
  assert.equal(cancelled.saves.length, 0);
  const confirmed = harness(["delete", "demo"]);
  await confirmed.run("llmapi-custom-headers");
  assert.deepEqual((confirmed.saves[0] as { config: unknown }).config, {
    version: 1,
    providers: {},
  });
});
test("TUI rejects duplicate route IDs and wizard cancellation does not save", async () => {
  const duplicate = harness(["add"], ["demo"]);
  await duplicate.run("llmapi-custom-headers");
  assert.equal(duplicate.saves.length, 0);
  assert.match(duplicate.messages[0], /duplicate/);
  const cancelled = harness(["add"], [undefined]);
  await cancelled.run("llmapi-custom-headers");
  assert.equal(cancelled.saves.length, 0);
});

test("TUI menu refresh synchronizes connect and model catalogs", async () => {
  const h = harness(["refresh"]);
  await h.run("llmapi-custom-headers");
  assert.deepEqual(h.syncs.sort(), ["integration", "model", "provider"]);
});
