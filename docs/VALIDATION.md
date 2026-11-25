# 验证与兼容性

本文记录插件 `0.1.0` 在 OpenCode `2.4.1` 上的兼容基线、已执行验证和未覆盖范围。验证日期为 **2026-11-24**。

## 1. 兼容矩阵

| 项目                     | 当前值  | 说明                               |
| ------------------------ | ------- | ---------------------------------- |
| 插件版本                 | `0.1.0` | 严格固定，未经授权不升级           |
| 配置 schema              | `1`     | 与插件版本独立                     |
| 本地 OpenCode            | `2.4.1` | 本次适配目标                       |
| `@opencode/plugin` (dev) | `2.4.1` | 宿主运行时提供                     |
| `@opencode/theme` (dev)  | `2.4.1` | 宿主运行时提供                     |
| OpenTUI (dev)            | `0.9.4` | 宿主运行时提供，用于类型和渲染测试 |
| Node.js                  | `>=22`  | 开发、类型检查和逻辑测试           |
| Bun                      | `1.4.3` | 原生 TUI 渲染测试                  |

不声明对更高宿主版本的兼容保证。宿主升级后必须重新执行本文第 3 节和真实终端验收。

## 2. 本次已执行

| 检查                    | 命令 / 方式                       | 结果                                           |
| ----------------------- | --------------------------------- | ---------------------------------------------- |
| 格式检查                | `npm run format:check`            | 通过                                           |
| TypeScript 严格检查     | `npm run check`                   | 通过                                           |
| 逻辑测试                | `npm test`                        | 22 项通过                                      |
| 原生编辑器渲染          | Bun 1.4.3 `test/editor.render.ts` | 通过                                           |
| 发布包检查              | `npm run check:package`           | 通过                                           |
| 隔离宿主 RPC 只读       | 隔离 OpenCode 2.4.1 服务          | 返回 revision 和空配置                         |
| 隔离宿主无模型保存/注册 | `npm run test:host:smoke`         | 保存测试路由并确认 Provider/模型注册，随后恢复 |
| 发布会话                | `npm run verify:release`          | 见本次交付记录                                 |

验证细节：

- 逻辑测试使用夹具和本机临时 HTTP 模拟端点，不调用模型生成接口。
- 隔离宿主使用独立 `XDG_*` 目录、独立端口和测试密码，未复制日常密钥或修改日常路由。
- 无模型烟雾检查只执行 `read`、`save`、`provider.list` 和 `model.list`，不发送推理请求，不访问远端模型目录。
- 冷启动时插件异步注册，RPC 检查会重试 `rpc.unavailable`。

## 3. 本次明确未执行

以下项目**没有**在本次交付中执行，不能从静态检查推断通过：

- 真实模型生成调用。
- 三协议完整流式响应。
- 真实 API key 和真实网关鉴权。
- 图片输入和多模态响应。
- WebSocket 实连、发送和接收。
- 标题、压缩、重试等辅助模型请求。
- 远端模型发现（真实端点）。
- 真实 OpenCode 终端中的完整交互验收。
- 远程模式和跨进程共同写入。
- 远端 CI。
- 第三方安全审计、性能压测和长期稳定性测试。

用户明确要求本次只做适配，不执行模型访问测试；上述项目应由使用者在自己的环境中按需验收。

## 4. 验收层次

| 层次     | 命令 / 操作               | 验证范围                                       |
| -------- | ------------------------- | ---------------------------------------------- |
| 静态检查 | `npm run check`           | 源码符合目标 SDK 的 TypeScript 契约            |
| 逻辑回归 | `npm test`                | 配置、迁移、存储、目录解析、TUI 管理和合并逻辑 |
| 原生组件 | `npm run test:tui`        | 无头编辑器渲染、粘贴、快捷键、校验和 resize    |
| 安装包   | `npm run check:package`   | 版本、锁文件、导出入口、文件白名单             |
| 宿主烟雾 | `npm run test:host:smoke` | 插件加载、RPC、Provider/模型注册，不调用模型   |
| 协议联调 | `npm run test:host`       | 三协议请求路径和请求头；**属于模型调用测试**   |
| 真实终端 | 手工                      | 菜单、编辑器、/connect、/models、保存和返回    |

## 5. 真实终端验收清单

在隔离或受控环境中逐项确认：

- [ ] `opencode --version` 为 `2.4.1`。
- [ ] `opencode plugin list` 包含本项目路径。
- [ ] `/llmapi-custom-headers` 主菜单可打开和关闭。
- [ ] 新增路由：ID、协议、Base URL、模型、输入类型、请求头可保存。
- [ ] 编辑路由：完整 JSON 可打开，字段顺序正确，Ctrl+S 保存。
- [ ] 校验失败时保留草稿并显示错误。
- [ ] Esc 按“编辑器 → 路由列表 → 主菜单 → 关闭”返回。
- [ ] `/connect` 出现 `LLM API Custom Headers · <路由 ID>`。
- [ ] 保存 API key 后，`/models` 出现该路由的模型。
- [ ] 刷新不会访问远端目录。
- [ ] 发现模型在确认后合并，保留已有模型设置。
- [ ] 删除路由后配置移除，凭据保留。
- [ ] 保存冲突和刷新失败提示可理解。
- [ ] 真实调用、流式响应、图片和 WebSocket 按需单独验收。

## 6. 历史基线

- **2.4.0 阶段**：SDK/theme 升级到 2.4.0，OpenTUI 固定 0.9.4；完成类型检查、逻辑测试、原生渲染和包检查。
- **2.3.2 阶段**：曾执行隔离宿主三协议 HTTP 回归、终端编辑器交互和发布包加载检查。历史 HTTP 回归使用模拟端点返回预期 400，仅证明当时版本的路径和请求头，不证明 2.4.1 的通信行为。
- 历史修复包括主题嵌套颜色、直接使用 SDK renderer、逐级返回和保存后的同步失败反馈。

历史结果不代表当前宿主版本的模型行为。

## 7. 证据模板

```text
日期：
插件版本：0.1.0
配置 schema：1
OpenCode：
Node / npm / Bun：
提交 ID：
安装包 SHA-256：

npm run verify:release：通过 / 失败
npm run test:host:smoke：通过 / 失败（隔离服务地址：）
真实终端验收：通过 / 部分 / 未执行
未执行项目及原因：
已知问题：
验收人：
```

证据中不得包含 API key、完整认证头、内部地址、数据库或完整敏感配置。

## 8. 兼容性变更规则

- 宿主升级必须重新执行静态检查、无模型烟雾检查和真实终端验收。
- SDK 升级必须单独提交，附带差异说明和回归结果。
- 配置 schema 变更必须提供迁移、回滚和旧数据测试。
- 公开 exports、插件 ID、RPC ID、Provider 前缀和 storage key 变更必须提供迁移方案。
- 不把“本地通过”表述为“生产认证”或“全协议验收通过”。

## 2026-11-25 工程规范对齐验证

环境：Windows、Node.js 24.22.1、Bun 1.4.3、OpenCode 2.4.1。只在隔离目录中验证；未执行模型生成（包括模拟生成）、真实远端发现、真实凭据或人工终端交互验收。

- `npm run verify:release` 通过：格式、类型、22/22 逻辑测试、原生 TUI 与包检查。
- `npm pack --ignore-scripts --pack-destination .validation/headers-review/artifacts --json` 生成 v0.1.0 制品；打包前已完成发布门禁。
- `npm install --offline --omit=dev --no-audit --no-fund --prefix .validation/headers-review/install ./.validation/headers-review/artifacts/opencode-llmapi-custom-headers-0.1.0.tgz` 通过。npm 未放行 postinstall；生产安装无开发依赖，本轮未验证开发 glob 补丁在安装阶段的执行。
- 真实宿主加载该隔离安装包，`npm run test:host:smoke` 通过 RPC 读取、保存、Provider/model 注册及配置恢复；服务已停止。
- 初次沙箱 localhost 连接出现 EACCES，离线缓存出现 ENOTCACHED；自动审批后的同项复验通过，无需产品代码修复。

制品和本机日志在被忽略的 `.validation/headers-review/` 中，不作为仓库提交内容。公共规范见 [统一工程规范](ENGINEERING.md)。
