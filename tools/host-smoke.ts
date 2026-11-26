// No-model host smoke check. Run against an isolated OpenCode 2.4.2 service
// with this plugin installed. It reads and temporarily replaces the isolated
// service configuration, verifies provider/model registration, then restores.
// It never calls a model or a remote model-listing endpoint.
import assert from "node:assert/strict";
import { OpenCode } from "@opencode/client";
import { HeadersRpc } from "../src/rpc.js";

if (
  !process.env.OPENCODE_TEST_URL ||
  process.env.OPENCODE_TEST_ISOLATED !== "1"
) {
  throw new Error(
    "Set OPENCODE_TEST_URL and OPENCODE_TEST_ISOLATED=1 for an isolated test service",
  );
}

const client = OpenCode.make({
  baseUrl: process.env.OPENCODE_TEST_URL,
  headers: process.env.OPENCODE_SERVER_PASSWORD
    ? {
        Authorization:
          "Basic " +
          Buffer.from(
            "opencode:" + process.env.OPENCODE_SERVER_PASSWORD,
          ).toString("base64"),
      }
    : {},
});

async function readReadyConfiguration() {
  for (let attempt = 0; ; attempt++) {
    await client.plugin.list();
    try {
      return await client.rpc(HeadersRpc).read({});
    } catch (error) {
      if (
        attempt >= 79 ||
        typeof error !== "object" ||
        error === null ||
        !("type" in error) ||
        error.type !== "rpc.unavailable"
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

const original = await readReadyConfiguration();
assert.equal(original.config.version, 1);
assert.equal(typeof original.revision, "number");
console.log(
  "PASS rpc read",
  JSON.stringify({
    revision: original.revision,
    providers: Object.keys(original.config.providers).length,
  }),
);

const route = `host-smoke-${process.pid}`;
const config = {
  version: 1 as const,
  providers: {
    [route]: {
      api: "openai-completions" as const,
      baseURL: "http://127.0.0.1:19091/v1",
      headers: { "X-Host-Check": "no-model" },
      models: [{ id: "runtime-check", input: ["text" as const] }],
    },
  },
};

try {
  const saved = await client.rpc(HeadersRpc).save({
    revision: original.revision,
    config,
  });
  assert.equal(saved.saved, true);
  assert.equal(saved.refreshed, true);

  const providers = await client.provider.list({});
  const provider = providers.data.find((item) => item.id === `llmapi-${route}`);
  assert.ok(provider, `llmapi-${route} provider was not registered`);
  assert.equal(provider.integrationID, `llmapi-${route}`);
  assert.equal(provider.package, "@opencode/ai/providers/openai-compatible");

  const models = await client.model.list({});
  const model = models.data.find(
    (item) =>
      item.providerID === `llmapi-${route}` && item.id === "runtime-check",
  );
  assert.ok(model, "runtime-check model was not registered");
  console.log(
    "PASS provider/model registration",
    JSON.stringify({
      provider: provider.id,
      integration: provider.integrationID,
      package: provider.package,
      model: model.id,
    }),
  );
} finally {
  const state = await client.rpc(HeadersRpc).read({});
  await client
    .rpc(HeadersRpc)
    .save({ revision: state.revision, config: original.config });
  console.log("PASS configuration restored");
}
