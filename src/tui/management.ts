import type { Plugin } from "@opencode/plugin/tui";
import { HeadersRpc } from "../rpc.js";
import {
  configSchema,
  protocol,
  routeSchema,
  type Config,
} from "../core/config.js";
import { mergeDiscoveredModels } from "../core/catalog.js";

export function setup(ctx: Plugin.Context) {
  const location = () => ctx.location ?? ctx.data.location.default();
  const rpc = () => {
    const client = ctx.client.rpc(HeadersRpc);
    return {
      read: (input: Parameters<typeof client.read>[0]) =>
        client.read(input, { location: location() }),
      save: (input: Parameters<typeof client.save>[0]) =>
        client.save(input, { location: location() }),
      discover: (input: Parameters<typeof client.discover>[0]) =>
        client.discover(input, { location: location() }),
      refresh: (input: Parameters<typeof client.refresh>[0]) =>
        client.refresh(input, { location: location() }),
    };
  };
  const sync = async () => {
    await Promise.all([
      ctx.data.location.integration.sync(location()),
      ctx.data.location.provider.sync(location()),
      ctx.data.location.model.sync(location()),
    ]);
  };
  const alert = (message: string) =>
    ctx.ui.dialog.alert({
      title: "LLM API Custom Headers / 自定义请求头",
      message,
    });
  const report = async (work: () => Promise<void>) => {
    try {
      // Materialize the server location before calling its plugin RPC on a cold start.
      await ctx.client.plugin.list({ location: location() });
      await work();
    } catch (e) {
      await alert(
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String(e.message)
            : String(e),
      );
    }
  };
  const chooseRoute = async (config: Config) => {
    const ids = Object.keys(config.providers);
    if (!ids.length) {
      await alert(
        "No routes. Use /llmapi-custom-headers to add one. / 暂无路由，请用 /llmapi-custom-headers 新增。",
      );
      return undefined;
    }
    return ctx.ui.dialog.select({
      title: "Select route / 选择路由",
      options: ids.map((value) => ({
        value,
        title: config.providers[value].displayName ?? value,
        description: `${value} · ${config.providers[value].api} · ${config.providers[value].models.length} models`,
      })),
    });
  };
  const save = async (revision: number, config: Config) => {
    const result = await rpc().save({ revision, config });
    await sync();
    await alert(result.message || "Saved and refreshed / 已保存并刷新");
  };
  const discover = async () => {
    const state = await rpc().read({}),
      id = await chooseRoute(state.config);
    if (!id) return;
    const models = await rpc().discover({ route: id });
    if (!models.length) {
      await alert(
        "No models discovered; catalog unchanged. / 未发现模型，目录保持原样。",
      );
      return;
    }
    if (
      !(await ctx.ui.dialog.confirm({
        title: "Discover models / 发现模型",
        message:
          models.map((m) => m.id).join("\n") +
          "\nMerge and save? Existing model settings are retained. / 合并并保存？保留已有模型设置。",
      }))
    )
      return;
    state.config.providers[id].models = mergeDiscoveredModels(
      state.config.providers[id].models,
      models,
    );
    await save(state.revision, state.config);
  };
  const edit = async () => {
    const state = await rpc().read({}),
      id = await chooseRoute(state.config);
    if (!id) return;
    let draft = JSON.stringify(state.config.providers[id]);
    for (;;) {
      const input = await ctx.ui.dialog.prompt({
        title: `Edit / 编辑 ${id}`,
        description:
          "Route JSON: baseURL, headers, models, credential. Leave credential unchanged to retain the key. / 路由 JSON，保留 credential 即保留密钥。",
        value: draft,
      });
      if (input === undefined) return;
      draft = input;
      try {
        state.config.providers[id] = routeSchema.parse(JSON.parse(input));
        break;
      } catch (e) {
        await alert(String(e));
      }
    }
    await save(state.revision, state.config);
  };
  const add = async () => {
    const state = await rpc().read({});
    const id = (
      await ctx.ui.dialog.prompt({
        title: "New route ID / 新路由 ID",
        description:
          "Letters, digits, underscore and hyphen / 字母、数字、下划线和连字符",
      })
    )?.trim();
    if (id === undefined) return;
    if (
      !/^[a-zA-Z0-9_-]+$/.test(id) ||
      Object.hasOwn(state.config.providers, id)
    )
      throw new Error("Invalid or duplicate route ID / 路由 ID 无效或已存在");
    const api = await ctx.ui.dialog.select({
      title: "Protocol / 协议",
      options: protocol.options.map((value) => ({ value, title: value })),
    });
    if (!api) return;
    const baseURL = await ctx.ui.dialog.prompt({
      title: "Base URL",
      placeholder: "https://gateway.example/v1",
    });
    if (baseURL === undefined) return;
    const ids = await ctx.ui.dialog.prompt({
      title: "Model IDs / 模型 ID",
      description:
        "Comma-separated; leave blank to discover later. / 逗号分隔，可留空后续发现。",
    });
    if (ids === undefined) return;
    const headers = await ctx.ui.dialog.prompt({
      title: "Custom headers JSON / 自定义请求头",
      value: "{}",
    });
    if (headers === undefined) return;
    state.config.providers[id] = routeSchema.parse({
      api,
      baseURL,
      headers: JSON.parse(headers),
      models: ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => ({ id })),
    });
    configSchema.parse(state.config);
    await save(state.revision, state.config);
    await alert(
      `Provider: llmapi-${id}\nUse OpenCode /connect to save the API key for this integration. It is used automatically. / 在 OpenCode /connect 保存对应集成的密钥，路由会自动使用。`,
    );
  };
  const remove = async () => {
    const state = await rpc().read({}),
      id = await chooseRoute(state.config);
    if (!id) return;
    if (
      !(await ctx.ui.dialog.confirm({
        title: "Delete route / 删除路由",
        message: `${id}\nCredentials will be retained for other routes. / 凭据将保留，避免影响其他路由。`,
      }))
    )
      return;
    delete state.config.providers[id];
    await save(state.revision, state.config);
  };
  const refresh = async () => {
    await rpc().refresh({});
    await sync();
    await alert("Refreshed / 已刷新");
  };
  const manage = async () => {
    const action = await ctx.ui.dialog.select({
      title: "LLM API Custom Headers / LLM API 自定义请求头",
      options: [
        { value: "add", title: "Add route / 新增路由" },
        { value: "edit", title: "Edit route / 编辑路由与模型" },
        { value: "discover", title: "Discover models / 发现模型" },
        { value: "delete", title: "Delete route / 删除路由" },
        { value: "refresh", title: "Refresh / 刷新" },
        { value: "credentials", title: "API keys / 密钥管理" },
      ],
    });
    if (action === "add") await add();
    else if (action === "edit") await edit();
    else if (action === "discover") await discover();
    else if (action === "delete") await remove();
    else if (action === "refresh") await refresh();
    else if (action === "credentials")
      await alert(
        "Use OpenCode /connect for API keys. Route credential is the integration ID, not the secret. Removing a route never deletes shared keys. / 使用 OpenCode /connect 管理密钥；路由 credential 填集成 ID，勿填密钥。删除路由不会删除共享密钥。",
      );
  };
  ctx.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "llmapi-manage",
        title: "LLM API Custom Headers / LLM API 自定义请求头",
        palette: true,
        slash: { name: "llmapi-custom-headers" },
        run: () => report(manage),
      },
    ],
  }));
}
