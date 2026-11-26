# opencode-llmapi-custom-headers

**OpenCode V2 插件 · v0.1.0 · 宿主基线 2.4.2**

在 OpenCode 终端中管理自定义 LLM 路由、请求头和模型目录。一个包同时提供 Server 插件、TUI 管理界面和类型化 RPC 契约，统一入口为 `/llmapi-custom-headers`。

支持的线上协议：

- OpenAI Chat Completions（`openai-completions`）
- OpenAI Responses（`openai-responses`）
- Anthropic Messages（`anthropic-messages`）

> **交付状态**：本版本完成对本地 OpenCode 2.4.2 的适配和工程验证，**未执行任何模型生成调用或远端模型发现**。真实密钥、完整流式响应、图片输入和 WebSocket 实连需由使用者在自己的环境中验收，详见 [验证与兼容性](docs/VALIDATION.md)。

## 兼容性

| 项目                     | 版本 / 要求              |
| ------------------------ | ------------------------ |
| 插件版本                 | `0.1.0`（对外 `v0.1.0`） |
| 配置 schema              | `1`                      |
| 本地 OpenCode            | `2.4.2`                  |
| `@opencode/plugin` (dev) | `2.4.2`                  |
| `@opencode/theme` (dev)  | `2.4.2`                  |
| OpenTUI (dev)            | `0.9.9`                  |
| Node.js（开发/检查）     | `>=22`                   |
| Bun（原生 TUI 渲染测试） | `1.4.3`（最低 `1.3.14`） |

SDK、主题与 OpenTUI 由 OpenCode 宿主在运行时提供；开发依赖只用于类型检查和本地测试。插件版本与配置 schema 版本相互独立，宿主升级不等于插件版本升级。

## 功能

- **原生路由注册**：按协议注册 OpenCode Provider、模型、集成和推理变体。
- **请求头注入**：在模型请求、最终 HTTP 请求和实验性 WebSocket 握手处合并自定义请求头。
- **大小写无关合并**：`User-Agent`、`user-agent` 和 `USER-AGENT` 视为同一字段，只向线上发送一个值；路由配置优先于自动鉴权头。
- **模型目录**：配置上下文窗口、最大输出、`text` / `image` 输入能力和 OpenAI reasoning variants。
- **模型发现**：显式读取端点模型列表并按 ID 合并，保留已有模型的能力、限额和推理配置。
- **凭据隔离**：每条路由拥有独立集成 `llmapi-<路由 ID>`，通过 `/connect` 保存 API key。
- **可靠保存**：严格 schema 校验、revision 冲突检测、串行写入，以及“已保存但刷新失败”的独立反馈。
- **终端管理**：路由增删改、模型发现、刷新、完整 JSON 编辑和多行输入编辑器。

插件不发起后台轮询，不上传遥测；只有用户显式执行“发现模型”时才会访问配置的模型目录端点。

## 安装

### 前置条件

1. 已安装 OpenCode 2.4.2，并能执行 `opencode --version`。
2. 本地开发需要 Node.js 22+ 和 npm。
3. 原生 TUI 渲染检查需要 Bun 1.3.14+；本项目在 Bun 1.4.3 上验证。

### 从源码安装

```sh
cd /path/to/opencode-llmapi-custom-headers
npm ci
```

在 `opencode debug paths` 显示的配置目录中编辑 `opencode.json`，将本项目的**实际绝对路径**加入 `plugins`，并保留已有插件条目：

```json
{
  "plugins": ["C:/plugins/opencode-llmapi-custom-headers"]
}
```

Windows 路径使用正斜杠。若本机通过 `cli.json` 显式加载 TUI，请在**同一配置目录**的 `cli.json` 中加入相同条目：

```json
{
  "plugins": ["C:/plugins/opencode-llmapi-custom-headers"]
}
```

保存后退出并重新启动 OpenCode。源码由宿主直接加载，没有前端构建步骤。可用以下命令核对插件是否出现在列表中：

```sh
opencode plugin list
```

安装发布包时，先将 `.tgz` 安装到持久目录，再让上述配置指向该目录。本项目尚未声明已发布到 npm 公共仓库。

远程模式下，Server 插件必须安装在被连接的服务端，TUI 插件安装在终端侧，两端使用同一个插件版本；只安装终端侧无法提供 RPC。

## 快速开始

1. 输入 `/llmapi-custom-headers`，选择 **新增路由 / Add route**。
2. 依次填写：路由 ID → 协议 → Base URL → 模型 ID（每行一个或逗号分隔，可留空）→ 每个模型的输入类型 → 请求头 JSON。
3. 保存后输入 `/connect`，搜索路由 ID，选择 `LLM API Custom Headers · <路由 ID>`，方法为 **API key / API 密钥**。
4. 输入并保存 API key。插件会在请求时读取该集成的活动密钥。
5. 输入 `/models`，选择该路由下的模型。

请求头示例：

```json
{
  "User-Agent": "my-opencode-client",
  "X-Application": "my-team"
}
```

模型调用验收由使用者按需执行。本版本未验证真实生成接口。

## 日常操作

主菜单提供：

- **刷新 / Refresh**：重载宿主集成、Provider 和模型缓存，不访问远端。
- **发现模型 / Discover models**：显式访问路由的模型目录端点，确认后按 ID 合并保存。
- **编辑路由与模型 / Edit route and models**：直接编辑该路由的完整 JSON，字段顺序为 `api` → `baseURL` → `models` → `headers`。
- **新增路由 / Add route**：分步向导，最后一步才提交整条路由。
- **删除路由 / Delete route**：确认后删除配置，已保存的 API key 保留。
- **API keys / 密钥管理**：显示 `/connect` 操作提示。

编辑器快捷键：`Enter` 换行，`Tab` 缩进，`Ctrl+A` 全选，`Ctrl+S` 保存，`Esc` 返回。导航按“编辑器 → 路由列表 → 主菜单 → 关闭”逐级返回；向导内返回会保留已确认字段和多行草稿。

## 配置模型

编辑界面接受单条路由对象，例如：

```json
{
  "api": "openai-completions",
  "baseURL": "https://gateway.example/v1",
  "models": [
    {
      "id": "example-model",
      "contextWindow": 262144,
      "maxTokens": 32768,
      "input": ["text", "image"],
      "reasoningEfforts": { "low": "low", "high": "high" }
    }
  ],
  "headers": {
    "User-Agent": "codex_cli_rs/0.169.0-alpha.11.1",
    "originator": "codex_cli_rs"
  }
}
```

- `contextWindow` 默认 `262144`，`maxTokens` 默认 `32768`，**应按真实模型修改**。
- `input` 可取 `["text"]`、`["image"]` 或 `["text", "image"]`，不能为空。
- `reasoningEfforts` 是 OpenAI variant 名称到协议值的映射；`null` 表示不额外覆盖请求体。
- `Content-Length`、`Transfer-Encoding`、`Expect`、`Upgrade` 由 HTTP 层控制，不能配置。

完整字段和校验规则见 [配置](docs/CONFIGURATION.md)。

## 安全

- API key 由 OpenCode 凭据系统保存，插件只持有集成引用并在请求时解析。
- 请求头本身可能包含秘密；配置导出、日志和问题报告都应脱敏。
- 模型发现拒绝重定向，限制 30 秒超时和 4 MiB 响应体。
- 端点可以指向本机或内网，插件不提供网络隔离或 SSRF 防护边界；只应配置可信端点。
- 本仓库尚未通过第三方安全审计，也不提供 SLA 或生产认证。

详见 [安全说明](SECURITY.md) 和 [安全模型](docs/SECURITY.md)。

## 故障排查

| 症状                            | 处理                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| 找不到 `/llmapi-custom-headers` | 检查 `opencode.json` / `cli.json` 的绝对路径，重启 OpenCode            |
| `/connect` 找不到路由           | 在主菜单执行刷新，搜索路由 ID；仍不出现时重启宿主                      |
| 模型列表为空                    | 确认已保存模型，或执行“发现模型”；远端目录可能需要先配置密钥           |
| `401` / `403`                   | 检查 `/connect` 中的活动密钥、Base URL，以及请求头是否覆盖自动鉴权字段 |
| `SAVE_CONFLICT`                 | 重新读取配置后再提交，不要强制覆盖其他编辑                             |
| 已保存但刷新失败                | 配置已持久化，使用“刷新”；不要重复新增                                 |
| 配置校验失败                    | 按错误信息修复字段；不要删除宿主数据库规避错误                         |

更多诊断步骤见 [故障排查](docs/TROUBLESHOOTING.md)。

## 开发与验证

```sh
npm ci
npm run format
npm run verify          # 格式检查 + TypeScript 严格检查 + 逻辑测试
npm run test:tui        # 需要 Bun：原生编辑器渲染与键盘交互
npm run check:package   # 版本、锁文件、导出和发布文件白名单
npm run verify:release  # 上述发布门禁的完整组合
```

`npm pack` 通过 `prepack` 自动执行 `verify:release`。宿主联调脚本 `npm run test:host` 会调用模型生成接口，**不属于本次适配的默认验证**，只能在隔离服务和明确授权下运行。

本次已完成的验证范围、未覆盖项目和验收记录模板见 [验证与兼容性](docs/VALIDATION.md)。

## 文档

| 文档                                  | 内容                                 |
| ------------------------------------- | ------------------------------------ |
| [文档索引](docs/README.md)            | 全部文档的阅读路径                   |
| [安装与升级](docs/INSTALLATION.md)    | 首次安装、发布包安装、升级、回滚     |
| [配置](docs/CONFIGURATION.md)         | schema、路由字段、请求头、凭据、发现 |
| [架构](docs/ARCHITECTURE.md)          | 模块边界、生命周期、数据流、失败模型 |
| [开发](docs/DEVELOPMENT.md)           | 环境、脚本、代码约束、测试策略       |
| [运行手册](docs/OPERATIONS.md)        | 发布门禁、备份、恢复、支持边界       |
| [故障排查](docs/TROUBLESHOOTING.md)   | 症状、诊断、处置                     |
| [验证与兼容性](docs/VALIDATION.md)    | 兼容矩阵、已验证范围、验收清单       |
| [发布流程](docs/RELEASING.md)         | 版本策略、产物、检查清单             |
| [依赖审查](docs/DEPENDENCY-REVIEW.md) | 依赖策略、审计结果、本地防护         |
| [迁移](docs/MIGRATION.md)             | 旧 DSH 配置、已移除字段、迁移边界    |
| [安全模型](docs/SECURITY.md)          | 信任边界、威胁模型、报告方式         |
| [版本记录](CHANGELOG.md)              | 按日期的同版本变更                   |
| [贡献规范](CONTRIBUTING.md)           | 提交、评审与兼容性要求               |

## 许可证

[MIT](LICENSE)
