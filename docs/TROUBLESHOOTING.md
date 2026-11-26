# 故障排查

本文按“症状 → 诊断 → 处置”组织。先确认插件版本 `0.1.0`、配置 schema `1`、宿主 OpenCode `2.4.2`。

## 1. 快速检查

```sh
opencode --version
opencode debug paths
opencode plugin list
```

检查配置目录中的 `opencode.json` 和 `cli.json`：

- 插件路径是实际绝对路径。
- Windows 使用正斜杠或正确转义的反斜杠。
- 同一文件只保留一条本插件记录。
- 没有覆盖其他插件的 `options`。

修改后退出并重新启动 OpenCode。源码改动需要重启宿主，刷新菜单不能替代重启。

## 2. 症状与处置

| 症状                                       | 可能原因                                     | 处置                                                                   |
| ------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------- |
| 找不到 `/llmapi-custom-headers`            | 路径错误、未加载 TUI、未重启                 | 检查两个配置文件；重启；`opencode plugin list` 确认                    |
| 主菜单出现但操作无响应                     | 服务端插件未加载、RPC 未就绪                 | 查看宿主日志；冷启动等待注册；确认 Server 插件已加载                   |
| `/connect` 找不到路由                      | 集成未注册、配置未保存、缓存未同步           | 主菜单刷新；搜索路由 ID；仍不出现时重启                                |
| 模型列表为空                               | 未保存模型、发现失败、Provider 未注册        | 保存模型或执行发现；检查 `/models` 中 `llmapi-<ID>`                    |
| `401` / `403`                              | 密钥无效、Base URL 错误、请求头覆盖鉴权      | 检查 `/connect` 活动密钥；检查是否配置了 `Authorization` / `x-api-key` |
| `404`                                      | Base URL 路径错误、网关未实现对应协议        | 核对服务商文档；OpenAI 通常含 `/v1`                                    |
| `SAVE_CONFLICT`                            | 读取后配置被其他操作修改                     | 重新打开配置，基于最新 revision 修改                                   |
| 已保存但刷新失败                           | 配置已持久化，宿主目录重载失败               | 使用“刷新”；不要重复新增；查看宿主日志                                 |
| 已保存但终端同步失败                       | TUI 缓存同步失败                             | 使用“刷新”；确认 TUI 与服务端连接正常                                  |
| 配置校验失败                               | 未知字段、重复模型 ID、非法请求头            | 按错误信息修复；参考 [配置](CONFIGURATION.md)                          |
| 插件重复注册 / Provider 冲突               | 同一配置出现两条记录，或路径大小写不同       | 只保留一条；重启                                                       |
| 编辑器崩溃 / `No renderer found`           | 宿主版本或 OpenTUI 运行时不一致              | 确认宿主 2.4.2；记录日志和复现步骤                                     |
| `npm ci` 报 `EPERM: unlink ...opentui.dll` | Windows 上 OpenCode TUI/服务仍在使用原生模块 | 退出相关进程后重试；重启后删除残留 `.core-win32-x64-*` 临时目录        |
| 远程模式 RPC 不可用                        | 服务端未安装 Server 插件，或两端版本不一致   | 在服务端安装同版本插件                                                 |

## 3. 鉴权问题

### 检查顺序

1. `/connect` 中是否存在 `LLM API Custom Headers · <路由 ID>`。
2. 该集成是否处于活动状态。
3. 方法是否为 **API key**；其他类型会被拒绝。
4. 路由的自定义请求头是否覆盖了自动鉴权字段。
5. Base URL 是否指向正确的网关和路径。

### 自动鉴权规则

| 协议                 | 自动请求头                    |
| -------------------- | ----------------------------- |
| `anthropic-messages` | `x-api-key: <key>`            |
| `openai-completions` | `Authorization: Bearer <key>` |
| `openai-responses`   | `Authorization: Bearer <key>` |

如果路由 `headers` 中显式配置了同名（大小写无关）字段，路由值会覆盖自动值。这通常用于网关要求固定测试密钥的场景，但生产环境应优先使用 `/connect`。

### 发现模型返回 401/403

发现请求会带上路由请求头和解析后的密钥。检查：

- 密钥是否属于该路由的集成。
- 网关是否允许 `GET {baseURL}/models`。
- Anthropic 网关是否需要额外的 `anthropic-version`（插件已发送 `2023-06-01`）。
- 是否有代理或 WAF 拦截了 `User-Agent`。

## 4. 保存与刷新

### `SAVE_CONFLICT`

配置带 revision 保存。出现冲突说明读取后配置已被修改：

1. 返回路由列表重新打开。
2. 重新读取最新配置。
3. 重做修改后提交。
4. 不要绕过冲突强制写入。

### 已保存但刷新失败

`save` 返回 `saved: true, refreshed: false` 表示：

- 配置已经写入 storage。
- 集成/Provider/模型目录重载失败。

处置：

1. 不要重复新增或覆盖。
2. 执行主菜单“刷新”。
3. 查看宿主日志中的 reload 错误。
4. 如果刷新持续失败，重启宿主。

### 已保存但终端同步失败

服务端保存成功，但 TUI 的集成/Provider/模型缓存没有同步。执行“刷新”；不影响已保存配置。

## 5. 模型发现

发现是显式远端操作，失败不会修改配置。

| 错误                                           | 含义                                       |
| ---------------------------------------------- | ------------------------------------------ |
| `DISCOVERY_FAILED`                             | 端点不可达、拒绝、非 JSON 或目录形状不支持 |
| `ABORTED`                                      | 调用方取消                                 |
| `model discovery timed out`                    | 超过 30 秒                                 |
| `answered with more than ... bytes`            | 响应超过 4 MiB                             |
| `did not answer with JSON`                     | 返回内容不是 JSON                          |
| `neither a "data" array nor a "models" object` | 目录结构不支持，请手工录入模型             |

处置：

- 确认端点允许 `GET` 模型列表。
- 检查是否需要密钥或额外请求头。
- 检查是否返回重定向；插件不跟随重定向。
- 如果网关目录结构特殊，手工添加模型 ID，不要反复发现。

## 6. 日志

```sh
opencode debug paths
```

查看输出中的 `log` 目录。关注：

- `loading plugin`：插件入口路径。
- `rpc handler failed`：RPC 方法名和错误。
- `provider.updated` / `model.updated`：目录刷新事件。
- `plugin reconciliation`：插件安装/更新状态。

报告问题时附：

- 插件版本、宿主版本、操作系统和终端。
- 复现步骤。
- 脱敏错误信息。
- 是否使用远程模式。
- 是否执行过发现或模型调用。

不要附：API key、完整 `Authorization`、数据库、内部地址或完整敏感配置。

## 7. 诊断隔离环境

需要判断是宿主环境还是插件问题时，使用隔离目录：

```powershell
$root = "$env:TEMP\opencode-llmapi-check"
$env:XDG_CONFIG_HOME = "$root\config"
$env:XDG_DATA_HOME = "$root\data"
$env:XDG_CACHE_HOME = "$root\cache"
$env:XDG_STATE_HOME = "$root\state"
```

在隔离目录写入最小配置并启动独立服务。不要复制日常凭据或连接日常服务。验证完成后关闭进程并删除隔离目录。

无模型宿主烟雾检查见 [开发](DEVELOPMENT.md) 的 `npm run test:host:smoke`。

## 8. 仍然无法解决

收集以下信息后提交问题：

1. 最小复现配置（脱敏）。
2. 宿主日志相关片段。
3. `opencode plugin list` 输出。
4. 插件和宿主版本。
5. 已尝试的处置步骤。

如果问题涉及安全漏洞，不要公开可利用细节；按 [安全说明](../SECURITY.md) 的渠道报告。
