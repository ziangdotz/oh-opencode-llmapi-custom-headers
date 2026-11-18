import test from "node:test";
import assert from "node:assert/strict";
import { configSchema, migrateConfig } from "../src/core/config.js";
import { ConfigStore } from "../src/server/storage.js";
import {
  mergeHeadersCaseInsensitive,
  assertValidHeaders,
} from "../src/core/headers.js";
import {
  parseListing,
  listingUrl,
  probeModels,
} from "../src/core/discovery.js";
import { createServer } from "node:http";
const route = {
  api: "openai-completions",
  baseURL: "https://example.com/v1",
  models: [{ id: "model" }],
};
test("strict import rejects unsupported legacy settings and invalid headers", () => {
  for (const extra of [
    { retryPolicy: {} },
    { requestImageMaxBytes: 1 },
    { streamIdleTimeoutMs: 1 },
    { headers: { "content-length": "2" } },
    { headers: { "x-test": "a\nb" } },
  ])
    assert.equal(
      configSchema.safeParse({ providers: { test: { ...route, ...extra } } })
        .success,
      false,
    );
  assert.throws(() => assertValidHeaders("test", { "x-foo": "a\rb" }));
  assert.deepEqual(
    mergeHeadersCaseInsensitive(
      { "User-Agent": "host" },
      { "user-agent": "custom" },
    ),
    { "user-agent": "custom" },
  );
});
test("model directory parsing preserves gateway aliases and limits", () => {
  assert.deepEqual(
    parseListing({
      models: {
        alias: { id: "internal", context_length: 8192, max_tokens: 256 },
      },
    }),
    [{ id: "alias", contextWindow: 8192, maxTokens: 256 }],
  );
  assert.equal(
    listingUrl("https://example.com/v1/", "anthropic-messages"),
    "https://example.com/v1/models?limit=1000",
  );
});
test("serialized saves reject stale revisions and retain state on persistence failure", async () => {
  let stored: unknown;
  let fail = false;
  const store = new ConfigStore({
    get: async () => undefined,
    set: async (_, v) => {
      if (fail) throw Error("disk");
      stored = v;
    },
    remove: async () => {},
    scan: async () => ({ entries: [] }),
  });
  await store.load({});
  const config = configSchema.parse({ providers: { test: route } });
  const outcomes = await Promise.allSettled([
    store.save(0, config),
    store.save(0, config),
  ]);
  assert.equal(outcomes[0].status, "fulfilled");
  assert.equal(outcomes[1].status, "rejected");
  assert.equal(store.revision, 1);
  assert.ok(stored);
  fail = true;
  await assert.rejects(store.save(1, {}));
  assert.equal(store.revision, 1);
  assert.deepEqual(store.config, config);
});
test("discovery sends configured headers with highest precedence on actual HTTP", async () => {
  const server = createServer((req, res) => {
    assert.equal(req.headers["user-agent"], "custom");
    assert.equal(req.headers.authorization, "Bearer override");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "wire" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    assert.deepEqual(
      await probeModels({
        baseURL: `http://127.0.0.1:${address.port}`,
        api: "openai-completions",
        headers: { "User-Agent": "custom", Authorization: "Bearer override" },
        apiKey: "key",
      }),
      [{ id: "wire" }],
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});

test("removed naming and shared integration fields are rejected on save", () => {
  for (const extra of [
    { displayName: "old" },
    { credential: "shared" },
    { models: [{ id: "m", name: "old" }] },
  ])
    assert.equal(
      configSchema.safeParse({ providers: { test: { ...route, ...extra } } })
        .success,
      false,
    );
});
test("existing storage migrates removed fields without changing route or model IDs", async () => {
  const store = new ConfigStore({
    get: async () => ({
      revision: 4,
      config: {
        providers: {
          test: {
            ...route,
            displayName: "old",
            credential: "shared",
            models: [{ id: "model", name: "old", input: ["text", "image"] }],
          },
        },
      },
    }),
    set: async () => {},
    remove: async () => {},
    scan: async () => ({ entries: [] }),
  });
  await store.load({});
  assert.equal(store.revision, 4);
  assert.equal("credential" in store.config.providers.test, false);
  assert.equal("displayName" in store.config.providers.test, false);
  assert.equal("name" in store.config.providers.test.models[0], false);
  assert.deepEqual(store.config.providers.test.models[0].input, [
    "text",
    "image",
  ]);
});

test("corrupt storage revisions are rejected without writes or replacement", async () => {
  for (const revision of [-1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1]) {
    let writes = 0;
    const store = new ConfigStore({
      get: async () => ({ revision, config: {} }),
      set: async () => {
        writes++;
      },
      remove: async () => {},
      scan: async () => ({ entries: [] }),
    });
    await assert.rejects(() => store.load({}));
    assert.equal(writes, 0);
    assert.equal(store.revision, 0);
  }
});
test("migration does not reinterpret arrays as configuration records", () => {
  for (const value of [
    [],
    { providers: [] },
    { providers: { route: [] } },
    {
      providers: {
        route: {
          api: "openai-completions",
          baseURL: "https://example.com",
          models: [[]],
        },
      },
    },
  ])
    assert.throws(() => migrateConfig(value));
});
