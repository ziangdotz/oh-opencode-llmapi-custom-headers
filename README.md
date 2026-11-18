# opencode-llmapi-custom-headers

**v0.1.1** · OpenCode **2.3.2** · Server + TUI + typed RPC

在 OpenCode 终端中管理自定义 LLM 路由、请求头和模型目录。支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages。唯一入口：`/llmapi-custom-headers`。

## 安装

需要 OpenCode 2.3.2；本地开发需要 Node.js 22+。SDK 固定为 2.3.2，升级宿主前应重新验证兼容性。

```sh
npm ci
```

在 `opencode debug paths` 显示的配置目录中，将本项目的**实际绝对路径**加入 `opencode.json` 的 `plugins`，与已有配置合并：

```json
{ "plugins": ["/absolute/path/opencode-llmapi-custom-headers"] }
```

Windows 路径使用正斜杠，如 `C:/plugins/opencode-llmapi-custom-headers`。本机使用显式 TUI 加载配置：在同目录的 `cli.json` 添加相同配置。保存后退出并重新启动 OpenCode。源代码由宿主直接加载，无前端构建步骤。

安装发布包时先将 `.tgz` 安装到持久目录，再在上述两个配置中指向该包目录。本项目尚未声明已发布到 npm 公共仓库。

## 快速开始

1. 输入 `/llmapi-custom-headers` → **新增路由**。
2. 填写路由 ID、协议、Base URL、模型 ID（每行一个或逗号分隔，可留空），逐个选择 text、image 或 text+image，最后填写请求头 JSON。
3. 保存后输入 `/connect`，搜索路由 ID，选择 `LLM API Custom Headers · <路由 ID>` → **API key / API 密钥**。
4. 输入并保存 API key。路由会自动读取该集成的当前密钥。
5. 输入 `/models`，选择该路由下的模型并发送测试消息。

请求头示例：

```json
{ "User-Agent": "my-opencode-client", "X-Application": "my-team" }
```

菜单还提供编辑路由与模型、模型发现、删除路由、刷新及密钥说明。模型发现采用合并方式，保留既有图片能力、推理档位、限额及手动添加的模型；新模型默认只声明 text 输入。

编辑路由与模型：选择路由后直接打开完整 JSON，顺序固定为 api → baseURL → models → headers。模型 input 可设为 ["text"]、["image"] 或 ["text", "image"]。Enter 换行、Tab 缩进、Ctrl+A 全选、Ctrl+S 保存、Esc 返回路由列表。保存后也返回路由列表。

导航：编辑器 → 路由列表 → 主菜单，每次 Esc 返回一级；主菜单 Esc 关闭。新增顺序为路由 ID → 协议 → Base URL → 模型列表 → 每模型输入类型 → 请求头，最后一步 Ctrl+S 提交整条路由。向导内返回保留已确认字段与多行草稿；退出新增或 JSON 编辑时丢弃未保存内容。

使用 /connect → LLM API Custom Headers · 路由 ID 设置 API key。每条路由仅关联 llmapi-路由ID；删除路由保留已存密钥。旧显示名称、模型名称和共享集成字段在加载时移除；原来使用共享集成的路由需要在其独立集成重新设置密钥。

## 功能范围

- 请求头按大小写不敏感合并，路由自定义值优先。
- Provider、模型、集成注册及保存后的终端缓存同步。
- 配置严格校验、保存冲突检测、持久化成功与刷新失败分开反馈。
- 模型 ID、上下文/输出限制、text/image 能力、OpenAI reasoning variants。
- HTTP 最终请求、模型请求及实验性 WebSocket 握手钩子。

旧 DSH 的默认 reasoning、retryPolicy、streamIdleTimeoutMs、图片压缩/像素限制及 Anthropic reasoningEfforts 没有等价映射，导入时明确拒绝。WebSocket 实连、标题/压缩/重试专项测试仍未完成。写锁限于单个服务端插件实例。详见配置及验证文档。

## 项目文档

- [运行与交付规范](docs/OPERATIONS.md)
- [架构](docs/ARCHITECTURE.md)
- [配置与迁移](docs/CONFIGURATION.md)
- [开发及测试](docs/DEVELOPMENT.md)
- [故障排查](docs/TROUBLESHOOTING.md)
- [发布流程](docs/RELEASING.md)
- [验证范围](docs/VALIDATION.md)
- [版本记录](CHANGELOG.md) · [贡献规范](CONTRIBUTING.md) · [安全说明](SECURITY.md)

```sh
npm run verify
npm pack
```

插件包只发布运行源码、用户文档、示例、许可证及版本记录。测试工具、CI、本机配置和开发依赖不随插件发布。
