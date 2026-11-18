import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "../src/tui/management.js";
import { configSchema } from "../src/core/config.js";
import type { Plugin } from "@opencode/plugin/tui";
function harness(
  selections: (string | undefined)[],
  prompts: (string | undefined)[] = [],
  confirm = true,
  drafts: (string | undefined)[] = [],
  syncFails = false,
  onRead?: (
    read: number,
    state: { revision: number; config: ReturnType<typeof configSchema.parse> },
  ) => void,
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
  const pages: string[] = [];
  const editorValues: string[] = [];
  let reads = 0;
  const rpc = {
    read: async (
      _input: unknown,
      options: { location: { directory: string } },
    ) => {
      assert.equal(options.location.directory, "C:/test");
      onRead?.(++reads, state);
      return structuredClone(state);
    },
    save: async (input: unknown) => {
      saves.push(input);
      state.config = configSchema.parse((input as { config: unknown }).config);
      state.revision++;
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
            if (syncFails) throw new Error("terminal unavailable");
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
        select: async (options: { title: string }) => {
          pages.push(options.title);
          return selections.shift();
        },
        prompt: async () => prompts.shift(),
        confirm: async () => confirm,
        alert: async (input: { message: string }) => {
          messages.push(input.message);
        },
      },
    },
  };
  setup(ctx as unknown as Plugin.Context, async (options) => {
    editorValues.push(options.value);
    const draft = drafts.shift();
    if (draft !== undefined) options.onDraft?.(draft);
    const value = prompts.shift();
    if (value !== undefined) options.validate(value);
    return value;
  });
  return {
    run: (name: string) => commands.find((c) => c.slash?.name === name)!.run(),
    syncs,
    saves,
    messages,
    pages,
    editorValues,
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

test("editing opens full JSON directly with models before headers", async () => {
  const route = {
    api: "openai-completions",
    baseURL: "https://example.com",
    models: [{ id: "vision", input: ["text", "image"] }],
    headers: { "X-Test": "yes" },
  };
  const h = harness(["edit", "demo"], [JSON.stringify(route)]);
  await h.run("llmapi-custom-headers");
  assert.equal(h.saves.length, 1);
  assert.equal(h.editorValues.length, 1);
  assert.ok(
    h.editorValues[0].indexOf('"models"') <
      h.editorValues[0].indexOf('"headers"'),
  );
  assert.equal(
    h.pages.some((title) => title.startsWith("编辑 demo")),
    false,
  );
  assert.deepEqual(
    (h.saves[0] as { config: ReturnType<typeof configSchema.parse> }).config
      .providers.demo.models[0].input,
    ["text", "image"],
  );
});
test("JSON cancel returns to routes and then main without saving", async () => {
  const h = harness(["edit", "demo", undefined, "refresh"], [undefined]);
  await h.run("llmapi-custom-headers");
  assert.equal(h.saves.length, 0);
  assert.equal(
    h.pages.filter((p) => p.startsWith("Routes / 路由列表")).length,
    2,
  );
  assert.equal(h.syncs.length, 3);
});
test("new models each receive input types before headers", async () => {
  const h = harness(
    ["add", "openai-completions", "text+image", "image"],
    ["new-route", "https://example.com", "one\ntwo", '{"X-Test":"yes"}'],
  );
  await h.run("llmapi-custom-headers");
  const r = (h.saves[0] as { config: ReturnType<typeof configSchema.parse> })
    .config.providers["new-route"];
  assert.deepEqual(
    r.models.map((m) => m.input),
    [["text", "image"], ["image"]],
  );
  assert.deepEqual(r.headers, { "X-Test": "yes" });
});
test("new-route back navigation retains header draft and model types", async () => {
  const h = harness(
    ["add", "openai-completions", "text+image", "text+image"],
    ["new-route", "https://example.com", "one", undefined, "{}"],
    true,
    [undefined, '{"X-Draft":'],
  );
  await h.run("llmapi-custom-headers");
  assert.equal(h.editorValues[2], '{"X-Draft":');
  assert.equal(h.saves.length, 1);
});
test("key help is a short connect instruction", async () => {
  const h = harness(["credentials"]);
  await h.run("llmapi-custom-headers");
  assert.match(h.messages[0], /\/connect/);
  assert.ok(h.messages[0].length < 100);
});

test("terminal sync failure reports saved state without retrying the write", async () => {
  const h = harness(
    ["edit", "demo"],
    [
      JSON.stringify({
        api: "openai-completions",
        baseURL: "https://example.com",
        models: [],
        headers: {},
      }),
    ],
    true,
    [],
    true,
  );
  await h.run("llmapi-custom-headers");
  assert.equal(h.saves.length, 1);
  assert.match(h.messages[0], /Saved; terminal sync failed/);
});

test("new-route commit retains concurrent unrelated edits and uses current revision", async () => {
  const h = harness(
    ["add", "openai-completions", "text"],
    ["new-route", "https://example.com", "model", "{}"],
    true,
    [],
    false,
    (read, state) => {
      if (read === 2) {
        state.config.providers.other = configSchema.parse({
          providers: {
            other: {
              api: "openai-responses",
              baseURL: "https://other.example",
            },
          },
        }).providers.other;
        state.revision++;
      }
    },
  );
  await h.run("llmapi-custom-headers");
  const saved = h.saves[0] as {
    revision: number;
    config: ReturnType<typeof configSchema.parse>;
  };
  assert.equal(saved.revision, 1);
  assert.ok(saved.config.providers.other);
  assert.ok(saved.config.providers["new-route"]);
});
