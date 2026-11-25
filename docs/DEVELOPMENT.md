# 开发

共同分层、开发流程、文档职责与验证授权见 [统一工程规范](ENGINEERING.md)。项目专属规则见本文。

本文面向修改插件源码的开发者。使用者请先阅读 [安装](INSTALLATION.md) 和 [配置](CONFIGURATION.md)。

## 1. 环境

| 工具       | 要求                               |
| ---------- | ---------------------------------- |
| Node.js    | `>=22`                             |
| npm        | 使用仓库提交的 `package-lock.json` |
| OpenCode   | `2.4.1`，用于真实宿主检查          |
| Bun        | `>=1.3.14`，用于原生 TUI 渲染测试  |
| TypeScript | `5.9.3`（锁定）                    |

```sh
npm ci
```

Windows 上执行 `npm ci` 前应退出正在运行的 OpenCode TUI/服务，否则宿主加载的 `opentui.dll` 可能被锁定并报 `EPERM: unlink`。升级完成后可删除残留的 `node_modules\@opentui\.core-win32-x64-*` 临时目录。

SDK、主题和 OpenTUI 必须固定精确版本，不使用 `latest` 或兼容 shim。它们是开发依赖，运行时由宿主提供。

## 2. 脚本

| 命令                      | 作用                                            |
| ------------------------- | ----------------------------------------------- |
| `npm run format`          | Prettier 写入格式                               |
| `npm run format:check`    | 检查格式                                        |
| `npm run check`           | `tsc --noEmit` 严格类型检查                     |
| `npm test`                | Node.js 逻辑测试（`tsx --test test/*.test.ts`） |
| `npm run test:tui`        | Bun 原生编辑器渲染与键盘交互测试                |
| `npm run check:package`   | 版本、锁文件、导出和发布文件白名单              |
| `npm run verify`          | `format:check` + `check` + `test`               |
| `npm run verify:release`  | `verify` + `test:tui` + `check:package`         |
| `npm run test:host`       | 隔离宿主协议联调，**会调用模型生成接口**        |
| `npm run test:host:smoke` | 隔离宿主无模型烟雾检查（只读/写配置并检查注册） |

`npm pack` 通过 `prepack` 执行 `verify:release`。

## 3. Bun 与原生渲染测试

`@opentui/core` 的原生 FFI 需要特定运行时。Node 22/24 不能直接执行渲染测试，应使用 Bun：

```sh
bun --version
npm run test:tui
```

如果 `bun` 不在 `PATH`，可使用已验证的本地运行时：

```powershell
& ".\.validation\runtime\node_modules\bun\bin\bun.exe" test/editor.render.ts
```

`.validation/` 是本机验证目录，不随仓库或安装包发布。

渲染测试覆盖：

- 多行粘贴和换行。
- Tab 缩进。
- Ctrl+A 全选、Ctrl+S 保存。
- 校验失败时保留输入并显示错误。
- 小窗口自适应。
- 点击返回或关闭弹窗时取消并释放 resize 监听。

组件测试不能替代真实 OpenCode 终端测试；宿主上下文、主题和焦点行为仍可能不同。

## 4. 测试分层

```text
test/
  core.test.ts        配置、迁移、请求头、存储、发现
  catalog.test.ts     发现结果合并
  providers.test.ts   Provider / 集成注册
  tui.test.ts         菜单、向导、保存和同步流程（模拟宿主）
  dependency.test.ts  开发 glob 防护回归
  editor.render.ts    Bun 原生渲染与键盘交互
```

当前 `npm test` 为 22 项逻辑测试。新增可观察行为时必须补测试；仅改文档不需要。

测试原则：

- 逻辑测试不调用远端模型或真实生成接口。
- 发现测试只连接本机临时 HTTP 模拟端点。
- 宿主联调只使用隔离服务和测试密钥。
- 不使用日常配置、日常数据库或真实用户凭据做测试。

## 5. 宿主联调

### 5.1 无模型烟雾检查

`npm run test:host:smoke` 只执行：

1. 等待插件 RPC 可用。
2. 读取配置。
3. 保存一条测试路由。
4. 检查 Provider 和模型已注册。
5. 恢复原配置。

它不发送模型请求，不访问远端模型目录。要求：

```powershell
$env:OPENCODE_TEST_URL = 'http://127.0.0.1:19095'
$env:OPENCODE_TEST_ISOLATED = '1'
npm run test:host:smoke
```

服务必须使用隔离的 `XDG_*` 目录和独立端口，详见 [验证](VALIDATION.md)。

### 5.2 协议联调

`npm run test:host` 会保存三条测试路由，并调用 `experimental.generate.text`，因此属于**模型调用测试**。只能在以下条件下运行：

- 独立 OpenCode 服务。
- 独立数据目录。
- 测试密钥或本地模拟端点。
- 明确授权。

该脚本使用本机 19091 端口的模拟服务，期望收到 HTTP 400。400 只能证明请求路径和请求头到达，不证明真实模型响应。

## 6. 代码约束

- 保持公开 exports、插件/RPC ID、Provider 前缀和 storage key 稳定。
- `core` 不引入宿主依赖；需要宿主能力时放在 `server`。
- 配置新增字段必须定义默认值、校验和旧数据迁移。
- 不静默忽略未知字段；当前 schema 是严格的。
- 可观察行为变更必须更新测试和用户文档。
- 用户界面文案保持 `English / 中文`。
- 不执行模型调用、远端发现或真实密钥测试，除非任务明确授权。

## 7. 新增配置字段的步骤

1. 在 `src/core/config.ts` 增加字段、默认值和校验。
2. 判断是否需要迁移旧记录；不要用可选字段掩盖破坏性变更。
3. 更新 `rpc.ts` 的输出 schema（如果字段会跨 RPC）。
4. 更新 Provider 注册或请求钩子（如果字段影响宿主行为）。
5. 在 `test/core.test.ts`、`test/providers.test.ts` 或 `test/tui.test.ts` 覆盖。
6. 更新 `docs/CONFIGURATION.md`、`docs/ARCHITECTURE.md` 和 `CHANGELOG.md`。
7. 执行 `npm run verify:release`，再按需做隔离宿主检查。

## 8. 升级宿主 SDK

1. 修改 `package.json` 与 `package-lock.json` 中的 `@opencode/plugin` 和 `@opencode/theme` 精确版本。
2. 执行 `npm ci`。
3. 执行 `npm run verify`，修复类型或行为差异。
4. 检查 SDK 变更记录并确认没有新增必需钩子或字段。
5. 在隔离 OpenCode 服务上执行无模型烟雾检查。
6. 在真实终端确认菜单、JSON 编辑、输入类型、保存、返回和 `/connect` 关联。
7. 更新兼容矩阵、架构、验证和依赖审查文档。

不要使用 `npm audit fix --force` 改写宿主契约。依赖升级应单独提交并单独验证。

## 9. 调试

- 宿主日志：`opencode debug paths` 输出的 `log` 目录。
- 插件加载：搜索 `loading plugin` 和插件路径。
- RPC 未就绪：冷启动时插件异步注册，客户端应重试 `rpc.unavailable`。
- 保存冲突：先 `read` 最新 revision，再重做修改。
- 刷新失败：区分 `save` 的持久化结果和 `refresh` 的缓存重载结果。

日志和问题报告必须脱敏：不要包含 API key、完整 `Authorization`、内部地址、数据库或完整敏感请求头。
