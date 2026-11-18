import type { Plugin } from "@opencode/plugin/tui";
import { HeadersRpc } from "../rpc.js";
import {
  configSchema,
  protocol,
  routeSchema,
  type Config,
} from "../core/config.js";
import { mergeDiscoveredModels } from "../core/catalog.js";
import type { EditorOptions } from "./editor-options.js";

export function setup(
  ctx: Plugin.Context,
  editText: (options: EditorOptions) => Promise<string | undefined>,
) {
  const modelIDs = (text: string) =>
    text
      .split(/[,\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  const headersFrom = (text: string) =>
    routeSchema.shape.headers.parse(JSON.parse(text));
  const validateHeaders = (text: string) => {
    routeSchema.parse({
      api: "openai-completions",
      baseURL: "https://example.com",
      headers: headersFrom(text),
    });
  };
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
  const chooseRoute = async (config: Config, current?: string) => {
    const ids = Object.keys(config.providers);
    if (!ids.length) {
      await alert(
        "No routes. Use /llmapi-custom-headers to add one. / 暂无路由，请用 /llmapi-custom-headers 新增。",
      );
      return undefined;
    }
    return ctx.ui.dialog.select({
      title: "Routes / 路由列表 · Esc Back / 返回",
      current: current && ids.includes(current) ? current : ids[0],
      options: [
        { value: "", title: "Back / 返回" },
        ...ids.map((value) => ({
          value,
          title: value,
          description: `${value} · ${config.providers[value].api} · ${config.providers[value].models.length} models / 模型`,
        })),
      ],
    });
  };
  const save = async (revision: number, config: Config) => {
    const result = await rpc().save({ revision, config });
    try {
      await sync();
    } catch {
      await alert(
        "Saved; terminal sync failed. Use Refresh / 已保存，终端同步失败，请使用刷新。",
      );
      return;
    }
    await alert(result.message || "Saved and refreshed / 已保存并刷新");
  };
  const discover = async (id: string) => {
    const state = await rpc().read({});
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
  const orderedRoute = (route: Config["providers"][string]) => ({
    api: route.api,
    baseURL: route.baseURL,
    models: route.models,
    headers: route.headers,
  });
  const edit = async (id: string) => {
    const state = await rpc().read({});
    const route = state.config.providers[id];
    if (!route) {
      await alert("Route no longer exists / 路由已被删除");
      return;
    }
    const value = await editText({
      title: `Edit route and models / 编辑路由与模型 · ${id}`,
      description: "Route JSON: models → headers / 路由 JSON：模型 → 请求头",
      value: JSON.stringify(orderedRoute(route), null, 2),
      rows: 24,
      validate: (text) => {
        routeSchema.parse(JSON.parse(text));
      },
    });
    if (value === undefined) return;
    state.config.providers[id] = routeSchema.parse(JSON.parse(value));
    await save(state.revision, state.config);
  };
  const add = async () => {
    const draft = {
      id: "",
      api: protocol.options[0],
      baseURL: "",
      models: "",
      headers: "{}",
      inputs: Object.create(null) as Record<string, ("text" | "image")[]>,
    };
    let step = 0;
    while (step >= 0) {
      const title = (label: string) =>
        `Add route / 新增路由 · ${step + 1}/6 · ${label}`;
      if (step === 0) {
        const value = await ctx.ui.dialog.prompt({
          title: title("Route ID / 路由 ID"),
          value: draft.id,
          description:
            "Letters, digits, underscore and hyphen / 字母、数字、下划线和连字符",
        });
        if (value === undefined) return;
        draft.id = value.trim();
        if (
          !/^[a-zA-Z0-9_-]+$/.test(draft.id) ||
          Object.hasOwn((await rpc().read({})).config.providers, draft.id)
        ) {
          await alert("Invalid or duplicate route ID / 路由 ID 无效或已存在");
          continue;
        }
      } else if (step === 1) {
        const value = await ctx.ui.dialog.select({
          title: title("Protocol / 协议"),
          current: draft.api,
          options: [
            { value: "", title: "Back / 返回" },
            ...protocol.options.map((value) => ({ value, title: value })),
          ],
        });
        if (!value) {
          step--;
          continue;
        }
        draft.api = protocol.parse(value);
      } else if (step === 2) {
        const value = await ctx.ui.dialog.prompt({
          title: title("Base URL / 接口地址"),
          value: draft.baseURL,
          placeholder: "https://gateway.example/v1",
        });
        if (value === undefined) {
          step--;
          continue;
        }
        draft.baseURL = value.trim();
        try {
          routeSchema.shape.baseURL.parse(draft.baseURL);
        } catch (e) {
          await alert(String(e));
          continue;
        }
      } else if (step === 3) {
        const value = await editText({
          title: title("Model IDs / 模型 ID"),
          description:
            "One per line or comma-separated; blank to discover later / 每行一个或逗号分隔，可留空后续发现。",
          value: draft.models,
          rows: 8,
          onDraft: (text) => {
            draft.models = text;
          },
          validate: (text) => {
            routeSchema.parse({
              api: draft.api,
              baseURL: draft.baseURL,
              models: modelIDs(text).map((id) => ({ id })),
            });
          },
        });
        if (value === undefined) {
          step--;
          continue;
        }
        draft.models = value;
      } else if (step === 4) {
        const ids = modelIDs(draft.models);
        let index = 0;
        while (index < ids.length) {
          const id = ids[index];
          const value = await ctx.ui.dialog.select({
            title: `Input types / 输入类型 · ${id} · Esc Back / 返回`,
            current: (draft.inputs[id] ?? ["text"]).join("+"),
            options: [
              { value: "text", title: "text / 文字" },
              { value: "text+image", title: "text + image / 文字和图片" },
              { value: "image", title: "image / 图片" },
            ],
          });
          if (value === undefined) {
            if (index === 0) break;
            index--;
            continue;
          }
          draft.inputs[id] = value.split("+") as ("text" | "image")[];
          index++;
        }
        if (index < ids.length) {
          step--;
          continue;
        }
      } else {
        const value = await editText({
          title: title("Headers JSON / 请求头 JSON"),
          value: draft.headers,
          rows: 12,
          onDraft: (text) => {
            draft.headers = text;
          },
          validate: validateHeaders,
        });
        if (value === undefined) {
          step = modelIDs(draft.models).length ? 4 : 3;
          continue;
        }
        draft.headers = value;
        // Re-read after a long wizard so unrelated edits are not overwritten.
        const state = await rpc().read({});
        if (Object.hasOwn(state.config.providers, draft.id)) {
          await alert(
            "Route ID now exists. Choose another / 路由 ID 已被占用，请更换。",
          );
          step = 0;
          continue;
        }
        const config = configSchema.parse({
          ...state.config,
          providers: {
            ...state.config.providers,
            [draft.id]: routeSchema.parse({
              api: draft.api,
              baseURL: draft.baseURL,
              models: modelIDs(draft.models).map((id) => ({
                id,
                input: draft.inputs[id] ?? ["text"],
              })),
              headers: headersFrom(draft.headers),
            }),
          },
        });
        try {
          await save(state.revision, config);
        } catch (e) {
          await alert(String(e));
          continue;
        }
        await alert(
          `Provider: llmapi-${draft.id}\nSet API key via /connect / 使用 /connect 设置密钥。`,
        );
        return;
      }
      step++;
    }
  };
  const remove = async (id: string) => {
    const state = await rpc().read({});
    if (
      !(await ctx.ui.dialog.confirm({
        title: "Delete route / 删除路由",
        message: `${id}\nSaved API keys are retained / 已保存的密钥会保留。`,
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
  const withRoutes = async (work: (id: string) => Promise<void>) => {
    let current: string | undefined;
    for (;;) {
      const state = await rpc().read({});
      const id = await chooseRoute(state.config, current);
      if (!id) return;
      current = id;
      await report(() => work(id));
    }
  };
  const manage = async () => {
    let current = "edit";
    for (;;) {
      const action = await ctx.ui.dialog.select({
        title: "LLM API Custom Headers / LLM API 自定义请求头",
        current,
        options: [
          { value: "", title: "Close / 关闭" },
          { value: "refresh", title: "Refresh / 刷新" },
          { value: "discover", title: "Discover models / 发现模型" },
          { value: "edit", title: "Edit route and models / 编辑路由与模型" },
          { value: "add", title: "Add route / 新增路由" },
          { value: "delete", title: "Delete route / 删除路由" },
          { value: "credentials", title: "API keys / 密钥管理" },
        ],
      });
      if (!action) return;
      current = action;
      await report(async () => {
        if (action === "add") await add();
        else if (action === "edit") await withRoutes(edit);
        else if (action === "discover") await withRoutes(discover);
        else if (action === "delete") await withRoutes(remove);
        else if (action === "refresh") await refresh();
        else if (action === "credentials")
          await alert(
            "/connect → LLM API Custom Headers · <ID>: set API key / 设置密钥",
          );
      });
    }
  };
  let managing = false;
  ctx.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "llmapi-manage",
        title: "LLM API Custom Headers / LLM API 自定义请求头",
        palette: true,
        slash: { name: "llmapi-custom-headers" },
        run: async () => {
          if (managing) return;
          managing = true;
          try {
            await report(manage);
          } finally {
            managing = false;
          }
        },
      },
    ],
  }));
}
