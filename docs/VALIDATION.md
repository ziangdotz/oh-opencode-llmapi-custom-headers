# 验证与兼容性

本轮目标为本地 OpenCode `2.4.2`，日期 **2026-11-26**。插件固定为 `v0.1.0`，配置 schema `1`。SDK/theme 精确使用 `2.4.2`，OpenTUI `0.9.9`。开发环境为 Windows、Node.js 24.22.1、Bun 1.4.3。

## 本轮验证

- `npm run verify:release` 通过：格式、TypeScript、22/22 逻辑测试、Bun 原生 TUI 与 37 文件发布包检查。
- 打包 v0.1.0 并以 `--omit=dev` 安装到隔离目录，生产安装包含插件与 zod，成功；npm 未放行 postinstall，因此本轮不声称验证了安装阶段开发 glob 补丁。
- OpenCode 2.4.2 加载上述实际安装包，独立端口 19126；`npm run test:host:smoke` 通过读取 revision 0、保存路由、Provider/model 注册及配置恢复。服务随后停止。
- 完整宿主终端人工交互未执行；原生编辑器与模拟 TUI 管理流程测试通过，不替代人工验收。
- 沙箱内首次逻辑回归有 1 项 localhost EACCES；相同测试经授权提升执行权限后 22/22 通过。包检查工具直接执行曾因缺少 npm 生命周期上下文拒绝运行，按正式 npm 脚本执行后通过。
- SDK 安装在沙箱内因 DNS ENOTFOUND 失败，联网安装后成功；OpenTUI 在 Node 24 安装有引擎警告，原生渲染使用符合要求的 Bun 1.4.3。

制品及隔离配置位于忽略目录 `.validation/headers-242/`，不提交。历史证据单列于下文，不能作为 2.4.2 的运行时结论。

## 验证范围与授权

- `npm run verify`：格式、严格类型与逻辑测试；目录 HTTP 测试仅连接本机模拟服务。
- `npm run test:tui`：原生编辑器组件渲染、键盘与关闭行为；不能替代完整宿主终端交互。
- `npm run check:package`：版本、锁文件、导出与文件白名单。
- 打包并安装到隔离目录，再用真实宿主运行 `npm run test:host:smoke`：RPC 读取、保存、Provider/model 注册、恢复配置。
- 宿主必须使用独立 XDG 配置/数据/缓存/状态目录、独立端口和测试密码，不加载日常配置、凭据或插件。

本轮不执行模型调用（包括 localhost 模拟生成）、真实远端模型发现、真实凭据测试。流式响应、图片输入、WebSocket、标题/压缩/重试、远程模式和跨进程写入均不在本轮验证范围。完整宿主终端菜单、JSON 编辑、/connect 和 /models 的人工验收若未执行会明确列出，不从组件测试推断通过。

## 后续终端验收

在隔离环境确认 `/llmapi-custom-headers` 菜单、路由新增/编辑/删除、Ctrl+S、Esc 逐层返回、校验错误保留草稿、保存/刷新失败分别提示，以及 `/connect` 和 `/models` 的关联。发现模型和生成调用需要另行明确授权。安装操作见 [安装与升级](INSTALLATION.md)，开发命令见 [开发](DEVELOPMENT.md)。

## 历史基线

- **2.4.0 阶段**：SDK/theme 升级到 2.4.0，OpenTUI 固定 0.9.4；完成类型检查、逻辑测试、原生渲染和包检查。
- **2.3.2 阶段**：曾执行隔离宿主三协议 HTTP 回归、终端编辑器交互和发布包加载检查。历史 HTTP 回归使用模拟端点返回预期 400，仅证明当时版本的路径和请求头，不证明 2.4.1 的通信行为。
- 历史修复包括主题嵌套颜色、直接使用 SDK renderer、逐级返回和保存后的同步失败反馈。

历史结果不代表当前宿主版本的模型行为。

## 证据模板

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

## 兼容性变更规则

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
