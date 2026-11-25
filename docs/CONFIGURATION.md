# 配置

本文是插件配置的权威说明，对应配置 schema `1`。插件版本独立于 schema 版本；当前插件为 `0.1.0`。

## 1. 配置来源与优先级

配置有两层来源：

1. OpenCode `plugins` 条目中的 `options`，用于首次初始化。
2. 宿主 plugin storage 的 `configuration` 记录，用于日常持久化。

首次保存后，storage 记录优先于 `options`。日常操作应通过 `/llmapi-custom-headers` 完成，直接编辑数据库或 storage 文件不受支持。

`options` 示例见 [`examples/options.json`](../examples/options.json)。它是插件 options 对象，不是 OpenCode 顶层配置。正确形式：

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

## 2. 顶层结构

```json
{
  "version": 1,
  "providers": {
    "gateway": {
      "api": "openai-completions",
      "baseURL": "https://gateway.example/v1",
      "models": [],
      "headers": {}
    }
  }
}
```

| 字段        | 类型 | 必需 | 默认 | 说明                                   |
| ----------- | ---- | ---- | ---- | -------------------------------------- |
| `version`   | `1`  | 否   | `1`  | 配置 schema 版本，当前只接受字面量 `1` |
| `providers` | 对象 | 否   | `{}` | 路由 ID 到路由对象的映射               |

校验是严格的：未知字段会被拒绝，而不是静默忽略。路由 ID 必须匹配 `^[a-zA-Z0-9_-]+$`，并在同一配置中唯一。

## 3. 路由字段

| 字段      | 类型   | 必需 | 默认 | 说明                                                             |
| --------- | ------ | ---- | ---- | ---------------------------------------------------------------- |
| `api`     | 枚举   | 是   | —    | `openai-completions` / `openai-responses` / `anthropic-messages` |
| `baseURL` | 字符串 | 是   | —    | 绝对 `http` 或 `https` 地址                                      |
| `models`  | 数组   | 否   | `[]` | 模型对象列表                                                     |
| `headers` | 对象   | 否   | `{}` | HTTP 字段名到字符串值的映射                                      |

### `api`

| 值                   | 宿主 Provider 包                           | 自动鉴权头                    |
| -------------------- | ------------------------------------------ | ----------------------------- |
| `openai-completions` | `@opencode/ai/providers/openai-compatible` | `Authorization: Bearer <key>` |
| `openai-responses`   | `@opencode/ai/providers/openai`            | `Authorization: Bearer <key>` |
| `anthropic-messages` | `@opencode/ai/providers/anthropic`         | `x-api-key: <key>`            |

Provider ID 和集成 ID 都由路由 ID 派生，固定为 `llmapi-<路由 ID>`。不要在其他插件中复用该前缀。

### `baseURL`

- 必须是绝对 URL，协议只接受 `http:` 或 `https:`。
- OpenAI 兼容网关通常以 `/v1` 结尾；具体以服务商文档为准。
- 插件不会自动补全 `/v1`，也不会改写请求路径。
- 模型发现对 Anthropic 会单独规范化 `/v1`，但真实请求仍使用配置值。

### `headers`

- 值是字符串；数字、布尔值、数组和 `null` 都会被拒绝。
- 字段名由 Fetch 实现校验，非法名称和含换行的值会被拒绝。
- `Content-Length`、`Transfer-Encoding`、`Expect`、`Upgrade` 由 HTTP 层控制，不能配置。
- 合并按小写字段名进行，路由值优先于自动鉴权值；最终只发送一个字段。
- 获胜来源的拼写会被保留。例如配置 `User-Agent` 后，不会再发送宿主默认的 `user-agent`。

## 4. 模型字段

| 字段               | 类型           | 必需 | 默认       | 说明                                            |
| ------------------ | -------------- | ---- | ---------- | ----------------------------------------------- |
| `id`               | 字符串         | 是   | —          | 模型 ID，非空，同一路由内唯一                   |
| `contextWindow`    | 正整数         | 否   | `262144`   | 上下文窗口，应按真实模型修改                    |
| `maxTokens`        | 正整数         | 否   | `32768`    | 最大输出 token，应按真实模型修改                |
| `input`            | 枚举数组       | 否   | `["text"]` | 可取 `text`、`image`，至少一项                  |
| `reasoningEfforts` | 对象 / `false` | 否   | 未设置     | OpenAI 推理变体映射；Anthropic 路由不允许非空值 |

示例：

```json
{
  "id": "example-model",
  "contextWindow": 131072,
  "maxTokens": 8192,
  "input": ["text", "image"],
  "reasoningEfforts": {
    "low": "low",
    "medium": "medium",
    "high": "high"
  }
}
```

### `reasoningEfforts`

- 键是 OpenCode 中的 variant ID，值是发送给端点的协议值。
- `false` 表示不注册变体。
- 值为 `null` 时，该 variant 不额外覆盖请求体。
- `openai-responses` 生成 `{ "reasoning": { "effort": "<value>" } }`。
- 其他协议生成 `{ "reasoning_effort": "<value>" }`。
- `anthropic-messages` 需要 thinking budget，当前没有等价映射；非空映射会在保存时被拒绝。

### `input`

- `["text"]`：只声明文字输入。
- `["image"]`：只声明图片输入。
- `["text", "image"]`：两者都支持。
- 空数组会被拒绝。默认值不会自动推断；新建模型默认只声明 `text`。

## 5. 编辑界面

“编辑路由与模型”直接打开该路由的完整 JSON，字段顺序为：

```text
api → baseURL → models → headers
```

编辑器接受单个路由对象，不包含 `version` 和 `providers` 外层。保存时会再次执行 `routeSchema.parse`，因此未知字段、重复模型 ID 和非法请求头都会在写入前失败。

新增向导依次收集：

1. 路由 ID
2. 协议
3. Base URL
4. 模型 ID（每行一个或逗号分隔，可留空）
5. 每个模型的输入类型
6. 请求头 JSON

只有最后一步才提交整条路由。向导内返回会保留已确认字段和多行草稿；退出向导或取消 JSON 编辑会丢弃未保存内容。

## 6. 凭据

每条路由拥有独立集成：

```text
集成 ID：llmapi-<路由 ID>
显示名称：LLM API Custom Headers · <路由 ID>
方法：API key
```

通过 `/connect` 保存密钥：

1. 执行 `/connect`。
2. 搜索路由 ID。
3. 选择 `LLM API Custom Headers · <路由 ID>`。
4. 选择 **API key / API 密钥**，输入并保存。

规则：

- 插件只保存集成引用，不把密钥写入配置或 storage。
- 请求时读取该集成的活动连接并解析为 `key` 类型；其他凭据类型会报错。
- 没有活动连接时不添加自动鉴权头，但路由自定义请求头仍会生效。
- 删除路由不会删除已保存的凭据；需要时在 `/connect` 中单独清理。
- 旧共享集成的密钥不会自动复制到新集成，也不会被插件删除。

## 7. 请求头合并顺序

请求头在三个位置注入：

- `model.request`：模型请求构建阶段。
- `http.request`：最终 HTTP 请求阶段。
- `experimental.ws.handshake`：实验性 WebSocket 握手阶段。

合并规则：

1. 自动鉴权头先生成：Anthropic 使用 `x-api-key`，其余使用 `Authorization: Bearer`。
2. 路由 `headers` 后合并，因此可以覆盖自动鉴权值。
3. 已存在的请求头与路由头按小写字段名合并，路由值获胜。
4. 每个字段只保留一个拼写和值。

示例：

```json
{
  "User-Agent": "codex_cli_rs/0.169.0-alpha.11.1",
  "originator": "codex_cli_rs"
}
```

这是简化的客户端标识示例，不改变网关的鉴权或模型权限。不要把真实密钥写入请求头；如果网关要求固定密钥，应优先使用 `/connect`。

## 8. 模型发现

“发现模型”是显式远端操作。它不会在启动、保存或刷新时自动执行。

请求地址：

| 协议                 | 地址                                                 |
| -------------------- | ---------------------------------------------------- |
| `openai-completions` | `{baseURL}/models`                                   |
| `openai-responses`   | `{baseURL}/models`                                   |
| `anthropic-messages` | `{root}/v1/models?limit=1000`，`root` 去掉末尾 `/v1` |

请求规则：

- 方法为 `GET`，`redirect: "error"`，不跟随重定向。
- 超时 30 秒，响应体上限 4 MiB。
- 发送路由自定义请求头和解析后的 API key。
- 若路由未提供 `User-Agent`，使用插件标识 `opencode-llmapi-custom-headers`。
- Anthropic 额外发送 `anthropic-version: 2023-06-01`。
- 接受 OpenAI 风格的 `data` 数组，或网关风格的 `models` 对象。
- 没有可用 `id` 的条目会被跳过；重复 ID 只保留第一次出现。

发现结果按 ID 合并：

- 已存在的模型保留原有限额、输入能力和推理变体。
- 新模型使用返回的上下文/输出限制；缺失时使用 `262144` / `32768`。
- 新模型默认只声明 `["text"]` 输入。
- 发现不会删除远端未返回的模型。

## 9. 迁移与已移除字段

加载旧配置时会移除以下字段：

- 路由级 `displayName`
- 路由级 `credential`
- 模型级 `name`

新保存不接受这些字段。其他未知字段会直接导致校验失败，不会被静默忽略。旧默认 reasoning、`retryPolicy`、`streamIdleTimeoutMs`、图片大小/像素/压缩限制以及 Anthropic `reasoningEfforts` 没有等价映射，详见 [迁移](MIGRATION.md)。

## 10. 常见校验错误

| 错误信息                                               | 含义与处理                                   |
| ------------------------------------------------------ | -------------------------------------------- |
| `Invalid input: expected ...`                          | 字段类型或必填项不符合 schema                |
| `Duplicate model IDs`                                  | 同一路由内模型 ID 重复                       |
| `Anthropic reasoning efforts require thinking budgets` | Anthropic 路由配置了非空推理映射，移除该字段 |
| `... is owned by the HTTP layer`                       | 配置了由 Fetch 控制的请求头，移除对应字段    |
| `... is not valid for Fetch`                           | 字段名非法或值含换行/不可表示字符            |
| `Unrecognized key ...`                                 | 使用了未知或已移除字段，按本文和迁移文档修正 |
| 路由 ID 正则失败                                       | ID 只能包含字母、数字、下划线和连字符        |
