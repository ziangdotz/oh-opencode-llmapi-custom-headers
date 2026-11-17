# 配置

初始 options 示例见 ../examples/options.json。它是插件 options 对象，不能直接作为 OpenCode 顶层配置。使用方式：

```json
{
  "plugins": [
    {
      "package": "/absolute/path/opencode-llmapi-custom-headers",
      "options": { "version": 1, "providers": {} }
    }
  ]
}
```

首次保存后，宿主 plugin storage 中的配置优先于 options。日常操作建议使用 TUI。

## 路由字段

| 字段        | 说明                                                       |
| ----------- | ---------------------------------------------------------- |
| 路由 ID     | 字母、数字、下划线或连字符；同配置中唯一                   |
| displayName | 可选显示名称                                               |
| api         | openai-completions / openai-responses / anthropic-messages |
| baseURL     | HTTP(S) 地址；OpenAI 通常含 /v1；以服务商文档为准          |
| headers     | 字符串到字符串的 JSON 对象，大小写不敏感覆盖               |
| credential  | 可选共享集成 ID；省略时使用 llmapi-路由ID 的活动密钥       |
| models      | 模型列表，可通过发现功能补充                               |

模型字段：id 必填，name 可选；contextWindow 默认 262144，maxTokens 默认 32768；两者应按实际模型修改。input 默认 text，可声明 text 和 image。reasoningEfforts 为 OpenAI variant 名称到协议值的映射，或 false；null 表示不额外覆盖请求体，不能理解为强制关闭推理。

编辑界面仅接收单条路由对象，不包含 version/providers 外层。完整配置结构严格校验，未知字段拒绝。配置版本与 npm 包版本独立。

## 密钥和请求头

通过 `/connect` 保存密钥，选择 `LLM API Custom Headers · 路由名称`，方法为 API key。删除路由保留凭据。不要将密钥填入 credential 字段或提交到示例。

Codex 风格示例（固定值只用于演示，不自动追踪 Codex 版本）：

```json
{
  "User-Agent": "codex_cli_rs/0.169.0-alpha.11.1",
  "originator": "codex_cli_rs"
}
```

这是简化客户端标识，不改变网关的鉴权或模型权限。Content-Length、Transfer-Encoding、Expect、Upgrade 由 HTTP 层控制，不能在此配置；换行或非法 Fetch 字段会被拒绝。

## DSH 迁移

保留协议、Base URL、headers 和模型基本字段；apiKeyEnv 改为 OpenCode 凭据集成引用。旧默认 reasoning、retryPolicy、streamIdleTimeoutMs、图片大小/像素/压缩限制、Anthropic reasoningEfforts 明确拒绝，不静默导入。重试和媒体处理使用宿主能力，尚不提供旧语义的等价承诺。
