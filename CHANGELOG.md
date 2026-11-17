# Changelog

## [0.1.0] - 2026-11-17

首个统一发布基线，整合开发阶段已验证功能：

- OpenCode 2.3.0 Server、TUI 与类型化 RPC。
- 唯一 /llmapi-custom-headers 菜单入口，路由增删改、目录发现和刷新。
- 三种原生协议、自定义请求头、模型能力与 OpenAI 推理 variants。
- OpenCode API key 集成、共享凭据保留及 Provider 关联。
- 严格配置校验、revision 保存冲突检测、部分保存反馈与 TUI 缓存同步。
- core/server/tui 分层，统一格式、测试、CI、开发及发布文档。

此前 0.1.1–0.1.3 为本地开发阶段包号，统一归入 v0.1.0，不代表配置回滚。保留原 storage key、配置版本、路由及凭据引用。未完成的专项验收见 docs/VALIDATION.md。
