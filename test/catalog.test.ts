import test from "node:test";
import assert from "node:assert/strict";
import { mergeDiscoveredModels } from "../src/core/catalog.js";
import { routeSchema } from "../src/core/config.js";
test("discovery retains image support, variants, manual limits and models missing remotely", () => {
  const existing = routeSchema.parse({
    api: "openai-completions",
    baseURL: "https://example.com",
    models: [
      {
        id: "vision",
        input: ["text", "image"],
        contextWindow: 65536,
        reasoningEfforts: { high: "high" },
      },
      { id: "manual" },
    ],
  }).models;
  const merged = mergeDiscoveredModels(existing, [
    { id: "vision", contextWindow: 8192 },
    { id: "new", maxTokens: 256 },
    { id: "new" },
  ]);
  assert.deepEqual(merged.slice(0, 2), existing);
  assert.deepEqual(merged[2], {
    id: "new",
    maxTokens: 256,
    contextWindow: 262144,
    input: ["text"],
  });
  assert.equal(merged.length, 3);
});
