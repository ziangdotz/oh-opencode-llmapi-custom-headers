# 架构

共同分层、开发流程、文档职责与验证授权见 [统一工程规范](ENGINEERING.md)。项目专属规则见本文。

本文描述插件 `0.1.0` 在 OpenCode `2.4.1` 上的设计边界、生命周期和失败模型。目标不是复刻宿主内部实现，而是说明本插件依赖的公开契约。

## 1. 设计目标

- **单一入口**：所有管理操作通过 `/llmapi-custom-headers` 完成。
- **宿主原生**：使用 OpenCode 的 Provider、集成、模型、storage 和 RPC 能力，不维护第二套配置中心。
- **协议透明**：只负责注册路由、注入请求头和声明模型能力；实际请求和流式处理由宿主完成。
- **显式网络**：只有“发现模型”会访问用户配置的远端目录。
- **可回滚**：配置 schema 保持 `1`，插件 ID、RPC ID、Provider 前缀和 storage key 稳定。
- **失败可解释**：保存冲突、持久化失败、刷新失败和终端同步失败分别反馈。

非目标：

- 不代理、重试或转换模型响应。
- 不提供跨进程事务、分布式锁或共享配置服务。
- 不提供网络隔离、SSRF 防护或凭据托管。
- 不替代真实宿主验收、外部安全审计或 SLA。

## 2. 宿主契约

| 契约       | 值                                                     |
| ---------- | ------------------------------------------------------ |
| 宿主基线   | OpenCode `2.4.1`                                       |
| Server SDK | `@opencode/plugin` `2.4.1`（开发依赖，宿主提供运行时） |
| TUI SDK    | `@opencode/plugin/tui`                                 |
| RPC SDK    | `@opencode/plugin/rpc`                                 |
| 主题类型   | `@opencode/theme/tui`                                  |
| TUI 渲染   | `@opentui/core` / `@opentui/solid` `0.9.4`（宿主提供） |
| 包导出     | `.`、`./tui`、`./rpc`、`./package.json`                |

OpenCode 的插件运行时会把 `effect`、`@opencode/plugin` 各入口和 OpenTUI 模块映射到宿主实例，避免同一进程出现多份运行时。插件源码由宿主直接加载，没有打包产物。

升级宿主时必须重新执行 TypeScript 检查、真实宿主加载检查和 [验证清单](VALIDATION.md)。仅更新开发依赖版本不等于完成适配。

## 3. 包边界

```text
src/
  index.ts                 Server 入口，导出默认插件
  tui.ts                   TUI 入口，导出默认插件
  rpc.ts                   Server/TUI 共享的 RPC 契约
  core/
    config.ts              配置 schema、默认值和加载迁移
    headers.ts             请求头校验与大小写无关合并
    discovery.ts           远端模型目录解析与有界 HTTP 探测
    catalog.ts             发现结果与既有模型目录的合并
  server/
    plugin.ts              服务端生命周期、钩子、RPC 实现
    providers.ts           Provider / 模型 / 推理变体注册
    credentials.ts         集成连接与 API key 解析
    storage.ts             宿主持久化、revision 和写入串行化
  tui/
    management.ts          命令、菜单、向导和路由操作
    multiline-editor.ts    基于 OpenTUI 的多行编辑器
    editor-options.ts      编辑器参数类型
```

依赖方向：

```text
core        → 无宿主依赖
server      → core + @opencode/plugin
tui         → core + rpc + @opencode/plugin/tui
rpc         → core + @opencode/plugin/rpc
index       → server
tui entry   → tui
```

`core` 不导入 OpenCode，保证配置、请求头合并和发现解析可以用普通 Node.js 测试。`tui` 不直接读写 storage，所有持久化通过 RPC 进入服务端。

## 4. 服务端生命周期

`src/server/plugin.ts` 的 `setup` 顺序固定：

1. 创建 `ConfigStore`，读取宿主 storage 的 `configuration`；没有记录时使用插件 `options`。
2. 加载并迁移配置，执行严格 schema 校验。
3. 注册 Provider 变换：把每条路由转换为原生 Provider 和模型。
4. 注册集成变换：为每条路由声明 `key` 类型方法，并设置显示名称。
5. 注册三个请求钩子：
   - `model.request`
   - `http.request`
   - `experimental.ws.handshake`
6. 注册 RPC：`read`、`save`、`refresh`、`discover`。
7. 返回 cleanup，按注册的逆序释放资源。

任何一步抛出错误都会阻止插件完成初始化。当前 cleanup 仅在 setup 完成后返回；初始化中途失败时，代码没有显式回收已创建的注册，不能据此保证不存在半注册状态。Provider 冲突会明确抛错，而不是静默覆盖其他插件的 Provider。

### Provider 注册

`registerProviders` 对每条路由执行：

- Provider ID：`llmapi-<路由 ID>`。
- 集成 ID：`llmapi-<路由 ID>`。
- 名称：路由 ID。
- 激活状态：`enabled`。
- 协议包：按 `api` 选择 OpenAI 兼容、OpenAI Responses 或 Anthropic。
- `settings.baseURL`：路由的 `baseURL`。
- `headers`：路由自定义请求头。
- 模型：ID、名称、输入能力、上下文/输出限制。
- 推理变体：`reasoningEfforts` 映射为 variant；`null` 生成空请求体覆盖。

模型 ID、Provider ID 和 variant ID 都使用宿主提供的构造器，避免字符串类型漂移。

### 集成注册

每条路由声明一个独立的 `key` 方法：

```text
integrationID: llmapi-<路由 ID>
name:          LLM API Custom Headers · <路由 ID>
type:          key
label:         API key / API 密钥
```

`/connect` 由宿主渲染。插件只持有集成 ID，不持久化密钥。

### 请求钩子

三个钩子共用同一套查找逻辑：

1. 从 `providerID` 去掉 `llmapi-` 前缀得到路由 ID。
2. 在内存配置中查找路由；不存在则不处理。
3. 通过 `integration.connection.active` 和 `resolve` 读取活动密钥。
4. 生成自动鉴权头：Anthropic 使用 `x-api-key`，其余使用 `Authorization: Bearer`。
5. 与路由自定义请求头做大小写无关合并，路由值优先。
6. 写回钩子输入：
   - `model.request` 和 `experimental.ws.handshake` 直接替换 `input.headers`。
   - `http.request` 构造新的 `Request`，保留原请求体和其余属性。

没有路由时，钩子不修改输入；没有密钥时仍合并路由自定义请求头，不生成自动鉴权头。

## 5. RPC 契约

`src/rpc.ts` 定义 `HeadersRpc`，ID 为 `llmapi-custom-headers`。

| 方法       | 输入                   | 输出                                      | 作用                       |
| ---------- | ---------------------- | ----------------------------------------- | -------------------------- |
| `read`     | `{}`                   | `{ revision, config }`                    | 读取当前配置和版本         |
| `save`     | `{ revision, config }` | `{ revision, saved, refreshed, message }` | 校验、持久化并刷新宿主缓存 |
| `refresh`  | `{}`                   | `null`                                    | 重载集成、Provider、模型   |
| `discover` | `{ route }`            | `{ id, contextWindow?, maxTokens? }[]`    | 显式读取远端模型目录       |

### `save`

1. 检查调用方 revision 是否等于当前 revision；不等则抛出 `SAVE_CONFLICT`。
2. 执行完整 `configSchema.parse`。
3. 写入宿主 storage，成功后才推进内存 revision。
4. 调用 `integration.reload`、`provider.reload`、`model.reload`。
5. 刷新失败时返回 `saved: true, refreshed: false`，并附带可读消息。

写入使用 Promise 队列串行化。并发保存中只有 revision 匹配的那一次成功；其余在队列内被拒绝。队列和 revision 只覆盖**单个插件实例**，不提供跨进程事务或分布式锁。

### `refresh`

只重载宿主目录缓存，不访问远端模型目录，不修改配置。

### `discover`

1. 按路由 ID 读取内存配置。
2. 通过集成解析 API key。
3. 调用 `probeModels`，带上路由请求头、密钥、调用方 `AbortSignal` 和默认 30 秒超时。
4. 返回解析后的模型列表；不在服务端自动保存。

TUI 在用户确认后调用 `save` 合并结果。

## 6. TUI 数据流

```text
用户操作
  → TUI 读取当前 location 的配置（RPC read）
  → 本地交互和 schema 校验
  → RPC save（携带 revision）
  → 服务端校验 revision 和完整配置
  → 宿主 storage 持久化
  → 集成 / Provider / 模型重载
  → TUI 同步当前 location 的集成、Provider、模型缓存
```

关键细节：

- TUI 每次 RPC 都携带 `ctx.location ?? ctx.data.location.default()`。
- 冷启动时先调用 `client.plugin.list` 物化服务端 location，再调用插件 RPC。
- 保存成功后调用 `ctx.data.location.integration/provider/model.sync`；同步失败与保存失败分开提示。
- 新增向导在提交前重新读取配置，检查路由 ID 是否被并发占用。
- 管理流程有重入保护，避免同时打开多个菜单实例。
- 多行编辑器直接使用宿主 renderer 创建 OpenTUI 组件，不依赖 Solid `RendererContext`；关闭时释放 resize 监听。

## 7. 持久化模型

storage key 固定为 `configuration`，记录结构：

```json
{
  "revision": 1,
  "config": {
    "version": 1,
    "providers": {}
  }
}
```

规则：

- `revision` 是非负安全整数。
- 记录使用严格 schema 校验；损坏的 revision 或结构会拒绝加载，不会用空配置覆盖。
- 加载时执行迁移：移除已废弃的显示名称、共享集成引用和模型名称。
- 新保存使用严格 schema，不再接受已移除字段。
- 配置版本与插件版本独立；当前都为 `1` 和 `0.1.0` 只是巧合，不应绑定升级。

## 8. 失败模型

| 阶段          | 失败表现                            | 状态是否已改变               |
| ------------- | ----------------------------------- | ---------------------------- |
| 配置加载      | 插件初始化失败或保留原记录          | 否                           |
| schema 校验   | RPC 返回校验错误                    | 否                           |
| revision 冲突 | `SAVE_CONFLICT`                     | 否                           |
| storage 写入  | RPC 抛错                            | 否，内存 revision 不推进     |
| 目录重载      | `saved: true, refreshed: false`     | 是，配置已持久化             |
| TUI 缓存同步  | 提示“已保存，终端同步失败”          | 是，配置和宿主缓存可能已更新 |
| 模型发现      | 返回 `DISCOVERY_FAILED` / `ABORTED` | 否，除非用户随后保存         |

原则：持久化成功和目录刷新成功是两个独立事实，不能把刷新失败误报为保存失败，也不能在写入失败后推进 revision。

## 9. 模型发现边界

`discovery.ts` 是一个有界 HTTP 客户端，不依赖宿主：

- 只接受绝对 `http`/`https` 地址。
- 拒绝重定向。
- 30 秒超时，调用方信号可提前取消。
- 响应体上限 4 MiB；先检查 `Content-Length`，再累计实际字节。
- 支持 `data` 数组和 `models` 对象两种目录形状。
- 解析上下文窗口和输出限制的多种常见字段名。
- 跳过无 ID 条目和重复 ID。
- 不执行模型生成请求。

发现结果通过 `catalog.ts` 合并：已有模型完全保留，新模型补齐默认值。这个顺序保证发现操作不会意外清空手工配置。

## 10. 稳定标识

| 标识          | 值                               |
| ------------- | -------------------------------- |
| npm 包名      | `opencode-llmapi-custom-headers` |
| 插件 ID       | `llmapi-custom-headers`          |
| RPC ID        | `llmapi-custom-headers`          |
| storage key   | `configuration`                  |
| Provider 前缀 | `llmapi-`                        |
| 集成前缀      | `llmapi-`                        |
| 配置 schema   | `1`                              |

这些标识是兼容契约。修改它们必须同时提供迁移方案、回滚说明和真实宿主回归，不能只改代码。

## 11. 已知限制

- 写入串行化和 revision 检测限于单个插件实例。
- 没有后台轮询、遥测上传或自动远端同步。
- 没有跨进程锁；多实例同时写同一 storage 时的行为由宿主决定。
- WebSocket 只注册握手头钩子；真实 WebSocket 会话未在本次交付中验证。
- Anthropic reasoning budget 没有等价映射。
- 模型请求、流式响应、图片输入和辅助调用（标题/压缩/重试）未在本次交付中验收。
- 没有独立安全审计、SLA 或生产认证。
