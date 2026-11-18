import { Plugin } from "@opencode/plugin";
import { HeadersRpc } from "../rpc.js";
import { ConfigStore } from "./storage.js";
import { registerProviders } from "./providers.js";
import { resolveKey } from "./credentials.js";
import { probeModels } from "../core/discovery.js";
import { mergeHeadersCaseInsensitive } from "../core/headers.js";
export default Plugin.define({
  id: "llmapi-custom-headers",
  async setup(ctx) {
    const store = new ConfigStore(ctx.storage);
    await store.load(ctx.options);
    const provider = await registerProviders(ctx, () => store.config);
    const integration = await ctx.integration.transform((editor) => {
      for (const id of Object.keys(store.config.providers)) {
        const integrationID = `llmapi-${id}`;
        editor.method.update({
          integrationID,
          method: { type: "key", label: "API key / API 密钥" },
        });
        editor.update(integrationID, (value) => {
          value.name = `LLM API Custom Headers · ${id}`;
        });
      }
    });
    const registrations = [provider, integration];
    const routeFor = (id: string) =>
      id.startsWith("llmapi-")
        ? store.config.providers[id.slice(7)]
        : undefined;
    const headersFor = async (id: string) => {
      const r = routeFor(id);
      if (!r) return undefined;
      const key = await resolveKey(ctx, id);
      return mergeHeadersCaseInsensitive(
        key
          ? r.api === "anthropic-messages"
            ? { "x-api-key": key }
            : { authorization: `Bearer ${key}` }
          : {},
        r.headers,
      );
    };
    registrations.push(
      await ctx.session.hook("model.request", async (input) => {
        const h = await headersFor(input.model.providerID);
        if (h) input.headers = mergeHeadersCaseInsensitive(input.headers, h);
      }),
    );
    registrations.push(
      await ctx.session.hook("http.request", async (input) => {
        const h = await headersFor(input.model.providerID);
        if (h) {
          const headers = new Headers(input.request.headers);
          for (const [k, v] of Object.entries(h)) headers.set(k, v);
          input.request = new Request(input.request, { headers });
        }
      }),
    );
    registrations.push(
      await ctx.session.hook("experimental.ws.handshake", async (input) => {
        const h = await headersFor(input.model.providerID);
        if (h) input.headers = mergeHeadersCaseInsensitive(input.headers, h);
      }),
    );
    registrations.push(
      await ctx.rpc.register(HeadersRpc, {
        read: async () => ({ revision: store.revision, config: store.config }),
        save: async (input) => {
          const revision = await store.save(input.revision, input.config);
          try {
            await ctx.integration.reload();
            await ctx.provider.reload();
            await ctx.model.reload();
            return { revision, saved: true, refreshed: true, message: "" };
          } catch {
            return {
              revision,
              saved: true,
              refreshed: false,
              message:
                "Saved; refresh failed. Retry refresh / 已保存，刷新失败，请重试刷新。",
            };
          }
        },
        refresh: async () => {
          await ctx.integration.reload();
          await ctx.provider.reload();
          await ctx.model.reload();
          return null;
        },
        discover: async (input, call) => {
          const r = store.config.providers[input.route];
          if (!r) throw new Error("Route not found");
          return probeModels({
            ...r,
            apiKey: await resolveKey(ctx, "llmapi-" + input.route),
            signal: call.signal,
          });
        },
      }),
    );
    return async () => {
      for (const r of registrations.reverse()) await r.dispose();
    };
  },
});
