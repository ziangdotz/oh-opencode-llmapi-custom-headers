// Run against an isolated OpenCode 2.3.0 service with this plugin installed.
// Requires an explicitly selected isolated service; temporarily replaces its configuration.
import { OpenCode } from "@opencode/client";
import { HeadersRpc } from "../src/rpc.js";
import { createServer } from "node:http";
import assert from "node:assert/strict";
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
// Location initialization can complete before asynchronous plugin registration on a cold server.
async function readReadyConfiguration() {
  for (let attempt = 0; ; attempt++) {
    await client.plugin.list();
    try {
      return await client.rpc(HeadersRpc).read({});
    } catch (error) {
      if (
        attempt >= 19 ||
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
const seen: string[] = [];
const server = createServer((req, res) => {
  seen.push(req.url!);
  assert.equal(req.headers["user-agent"], "llmapi-wire");
  assert.equal(req.headers["x-custom"], "wire");
  req.resume();
  res.writeHead(400, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      error: {
        type: "invalid_request_error",
        message: "Expected wire-test rejection",
      },
    }),
  );
});
await new Promise<void>((r) => server.listen(19091, "127.0.0.1", r));
try {
  const config = {
    version: 1 as const,
    providers: Object.fromEntries(
      (
        [
          "openai-completions",
          "openai-responses",
          "anthropic-messages",
        ] as const
      ).map((api) => [
        api,
        {
          api,
          baseURL: "http://127.0.0.1:19091/v1",
          headers: {
            "User-Agent": "llmapi-wire",
            "X-Custom": "wire",
            Authorization: "Bearer local-test",
            "x-api-key": "local-test",
          },
          models: [
            {
              id: "wire",
              contextWindow: 8192,
              maxTokens: 1024,
              input: ["text" as const],
            },
          ],
        },
      ]),
    ),
  };
  await client.rpc(HeadersRpc).save({ revision: original.revision, config });
  for (const api of Object.keys(config.providers))
    await assert.rejects(
      client.experimental.generate.text({
        model: { providerID: "llmapi-" + api, id: "wire" },
        prompt: "local wire test",
      }),
      (error) => {
        console.log(api, String(error));
        return true;
      },
    );
  for (const path of ["/v1/chat/completions", "/v1/responses", "/v1/messages"])
    assert.ok(seen.includes(path), `No request captured: ${path}`);
  console.log(
    "PASS: actual OpenCode requests captured for all three protocols",
    seen,
  );
} finally {
  const state = await client.rpc(HeadersRpc).read({});
  await client
    .rpc(HeadersRpc)
    .save({ revision: state.revision, config: original.config });
  server.closeAllConnections();
  server.close();
}
