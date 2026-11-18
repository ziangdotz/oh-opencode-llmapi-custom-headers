# 架构

## 包边界

```text
src/
  index.ts                 服务端稳定导出
  tui.ts                   终端稳定导出
  rpc.ts                   类型化通信契约
  core/
    config.ts              配置版本、结构及严格校验
    headers.ts             请求头校验与大小写无关合并
    discovery.ts           远端目录解析和有界 HTTP 探测
    catalog.ts             模型目录增量合并
  server/
    plugin.ts              OpenCode 生命周期、钩子与 RPC 实现
    providers.ts           原生 Provider/Model 注册
    credentials.ts         OpenCode 凭据解析
    storage.ts             宿主持久化和写入串行化
  tui/
    management.ts          单一命令、向导和菜单交互
```

`core` 不依赖 OpenCode。`server` 依赖正式 SDK，将配置转为原生注册和请求钩子；`tui` 通过 `rpc` 调用服务端，并同步当前目录的集成/模型缓存。没有跨宿主共享包、GUI、独立管理服务或运行时兼容 shim。

## 数据流

TUI 读取当前目录配置 → 在本地校验输入 → RPC 携带 revision 保存 → plugin storage 持久化 → 集成/Provider/Model 刷新 → TUI 同步缓存。

凭据由 OpenCode 管理。每条路由的 Provider ID 和集成 ID 均为 llmapi-<id>，不支持共享集成引用。路由与模型仅使用 ID 展示。

请求头在模型请求、最终 HTTP 请求、WebSocket 握手处注入；配置值优先于自动鉴权头。发现请求也使用凭据与路由请求头。

## 稳定标识与限制

包名 `opencode-llmapi-custom-headers`，插件及 RPC ID `llmapi-custom-headers`，storage key `configuration`，配置版本 `1`。目录整理不改变这些标识，保留既有路由和凭据。

写入队列和 revision 冲突检测只覆盖单插件实例，不提供跨进程事务或分布式锁。宿主 API 或模型协议变化需要重新验收；固定 SDK 并不替代集成测试。
