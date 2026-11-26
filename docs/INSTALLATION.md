# 安装与升级

本文覆盖首次安装、发布包安装、升级、回滚和卸载。目标宿主为 **OpenCode 2.4.2**；插件版本固定为 **0.1.0**，配置 schema 为 **1**。

## 1. 环境确认

```sh
opencode --version
opencode debug paths
```

记录以下信息，后续备份和故障排查都需要：

- OpenCode 版本（应为 `2.4.2`）。
- 配置目录（`config`）。
- 数据目录（`data`）和数据库路径（`db`）。
- 日志目录（`log`）。

本地开发还需要：

- Node.js `>=22` 和 npm。
- Bun `>=1.3.14`，仅用于原生 TUI 渲染测试；本项目在 `1.4.3` 上验证。

SDK、主题和 OpenTUI 由宿主在运行时提供。项目中的 `@opencode/plugin`、`@opencode/theme`、`@opentui/*` 是**开发依赖**，用于类型检查和测试，不应作为生产依赖另行安装。

## 2. 从源码安装

在项目目录执行：

```sh
npm ci
```

编辑配置目录中的 `opencode.json`。将项目的**实际绝对路径**加入 `plugins`，并保留其他插件和配置：

```json
{
  "plugins": ["C:/plugins/opencode-llmapi-custom-headers"]
}
```

如果本机通过 `cli.json` 显式加载 TUI，请在**同一配置目录**的 `cli.json` 中加入相同条目：

```json
{
  "plugins": ["C:/plugins/opencode-llmapi-custom-headers"]
}
```

要求：

- 每个配置文件内只保留一条本插件记录，避免重复注册。
- Windows 路径使用正斜杠，或使用正确转义的 JSON 反斜杠。
- 不要覆盖同一文件中其他插件的 `options`。
- 不要同时保留旧路径和新路径。

也可以使用对象形式传入初始 options：

```json
{
  "plugins": [
    {
      "package": "C:/plugins/opencode-llmapi-custom-headers",
      "options": {
        "version": 1,
        "providers": {}
      }
    }
  ]
}
```

首次保存后，宿主 plugin storage 中的 `configuration` 记录优先于 options。日常配置应通过 TUI 修改。

保存后退出并重新启动 OpenCode。宿主直接加载 TypeScript 源码，没有 `dist` 生成步骤。

## 3. 从发布包安装

先把 `.tgz` 安装到持久目录，而不是临时解压目录：

```sh
mkdir -p /opt/opencode-plugins
npm install --prefix /opt/opencode-plugins ./opencode-llmapi-custom-headers-0.1.0.tgz
```

Windows 示例：

```powershell
New-Item -ItemType Directory -Force C:\opencode-plugins | Out-Null
npm install --prefix C:\opencode-plugins .\opencode-llmapi-custom-headers-0.1.0.tgz
```

实际包目录为：

```text
/opt/opencode-plugins/node_modules/opencode-llmapi-custom-headers
C:\opencode-plugins\node_modules\opencode-llmapi-custom-headers
```

将上述目录加入 `opencode.json` 和需要时的 `cli.json`，然后重启。发布包只包含运行源码、用户文档、示例、许可证和版本记录，不包含测试、CI、开发工具或 `node_modules`。宿主负责提供 SDK、主题和 OpenTUI。

本项目尚未声明已发布到 npm 公共仓库；不要把安装命令写成公开 npm 包名。

## 4. 远程模式

远程连接时分两层：

| 位置   | 需要安装     | 作用                           |
| ------ | ------------ | ------------------------------ |
| 服务端 | Server 插件  | Provider 注册、请求头注入、RPC |
| 终端侧 | TUI 插件     | `/llmapi-custom-headers` 菜单  |
| 两端   | 相同插件版本 | 保证 RPC 契约一致              |

只安装终端侧无法提供 RPC；只安装服务端则没有管理菜单。两端都应使用 `0.1.0`。

## 5. 首次启动检查

不调用模型即可完成以下检查：

1. 执行 `opencode plugin list`，确认列表中包含本项目路径。
2. 打开 `/llmapi-custom-headers`，确认主菜单可见。
3. 新增一条测试路由并保存，确认没有 schema 错误。
4. 执行“刷新”，确认集成、Provider 和模型缓存同步成功。
5. 执行 `/connect`，确认出现 `LLM API Custom Headers · <路由 ID>`。
6. 执行 `/models`，确认能看到 `llmapi-<路由 ID>` 下的模型。

“发现模型”会访问远端目录，应在允许联网时手动执行。真实生成调用、流式响应、图片输入和 WebSocket 实连不在安装检查范围内。

### 自动化无模型检查

开发者可在独立 PowerShell 会话启动隔离宿主，不复制日常配置。以下示例在仓库目录执行；端口须空闲，测试密码只用于本次隔离服务：

```powershell
$root = Join-Path (Get-Location) '.validation/host-check'
$env:XDG_CONFIG_HOME = "$root/config"
$env:XDG_DATA_HOME = "$root/data"
$env:XDG_CACHE_HOME = "$root/cache"
$env:XDG_STATE_HOME = "$root/state"
$env:OPENCODE_SERVER_PASSWORD = 'isolated-test-only'
New-Item -ItemType Directory -Force "$root/config/opencode", "$root/work" | Out-Null
$plugin = (Get-Location).Path.Replace('\', '/')
@{ plugins = @($plugin) } | ConvertTo-Json | Set-Content "$root/config/opencode/opencode.json"
Set-Location "$root/work"
opencode serve --hostname 127.0.0.1 --port 19095
```

在另一 PowerShell 会话回到仓库目录，执行：

```powershell
$env:OPENCODE_TEST_URL = 'http://127.0.0.1:19095'
$env:OPENCODE_TEST_ISOLATED = '1'
$env:OPENCODE_SERVER_PASSWORD = 'isolated-test-only'
npm run test:host:smoke
```

结束后在服务会话按 Ctrl+C 停止，并关闭两个会话以撤销临时环境变量。该命令只读取/保存/恢复配置并检查注册；`npm run test:host` 会调用生成接口，不能用于此无模型流程。完整终端交互仍按上节逐项确认。发布包验证时将 `$plugin` 改为隔离安装后的包目录。

## 6. 升级

升级前：

1. 停止相关 OpenCode 服务和终端。
2. 备份插件目录、配置文件和宿主数据目录。
3. 记录当前插件版本、宿主版本、提交 ID 和安装包 SHA-256。

升级步骤：

1. 替换源码或安装新的 `.tgz`。
2. 在项目目录执行 `npm ci`（源码安装时）。**Windows 上必须先退出正在运行的 OpenCode TUI/服务**：TUI 会从插件目录加载 `opentui.dll`，进程未退出时 `npm ci` 可能报 `EPERM: unlink ... opentui.dll`。
3. 保持 `plugins` 路径不变，配置 schema 仍为 `1`。
4. 重启宿主，重复“首次启动检查”。
5. 如需回滚，恢复插件目录和匹配的数据快照。

宿主升级（例如 2.4.2 → 更高版本）属于单独变更：必须重新执行类型检查、真实宿主加载检查和本文件第 5 节的检查，不能仅凭 `npm run verify` 推断兼容。

## 7. 回滚

1. 停止宿主进程。
2. 恢复旧插件目录或重新安装旧 `.tgz`。
3. 恢复匹配的配置和数据备份。
4. 重启宿主并核对菜单、路由、模型和 `/connect`。
5. 如果新版本曾写入不兼容字段，使用备份恢复，不要手工删除数据库。

配置 schema 仍为 `1`，正常情况下无需降级迁移。任何 schema 变更都必须提供显式迁移方案和回滚说明。

## 8. 卸载

1. 从 `opencode.json` 和 `cli.json` 删除本插件条目。
2. 重启 OpenCode。
3. 按需删除插件目录和安装包。
4. 宿主 plugin storage 中的 `configuration` 记录可能保留；如确认不再使用，再按宿主文档清理数据目录。

卸载不会自动删除 `/connect` 中已保存的凭据，也不会自动清理模型配置。清理前先备份并确认影响范围。

## 9. Windows 启动环境

若宿主提示找不到 Node.js：

```powershell
where.exe node
where.exe opencode
node --version
```

版本管理器 shim 可能没有指向已安装的运行时。可以只在当前 PowerShell 会话把实际 Node 目录放到 `PATH` 首位，不要修改插件来绕过运行时问题。

如果 `npm ci` 或依赖升级报：

```text
EPERM: operation not permitted, unlink ...\@opentui\core-win32-x64\opentui.dll
```

说明有 OpenCode/TUI 进程正在使用该原生模块。退出相关进程后重试；不要删除正在使用的 DLL，也不要强制结束不属于本项目的进程。升级完成后如残留 `node_modules\@opentui\.core-win32-x64-*` 临时目录，可在宿主退出后删除。

权限受限导致宿主无法写日志时，可以临时隔离 XDG 目录做诊断：

```powershell
$env:XDG_CONFIG_HOME = "$env:TEMP\opencode-check\config"
$env:XDG_DATA_HOME = "$env:TEMP\opencode-check\data"
$env:XDG_CACHE_HOME = "$env:TEMP\opencode-check\cache"
$env:XDG_STATE_HOME = "$env:TEMP\opencode-check\state"
```

隔离目录只用于测试，不要复制日常凭据或连接日常服务。

## 10. 常见安装错误

| 错误                       | 原因与处理                                            |
| -------------------------- | ----------------------------------------------------- |
| 启动后没有菜单             | 路径不在 `plugins`、路径错误，或未重启宿主            |
| `Cannot find package ...`  | 源码安装未执行 `npm ci`，或使用发布包但未安装运行依赖 |
| 重复注册 / Provider 冲突   | 同一配置文件出现两条记录，或路径大小写不同导致重复    |
| TUI 加载失败但 Server 正常 | `cli.json` 未配置 TUI 条目，或宿主未加载 TUI 插件     |
| `Node.js v>=22` 提示       | Node 不在 `PATH` 或 shim 指向错误；按第 9 节诊断      |
| 远程模式没有 RPC           | Server 插件未安装在所连接的服务端                     |
