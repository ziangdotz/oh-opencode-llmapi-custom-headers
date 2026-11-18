# 开发

## 环境

Node.js 22+、npm、OpenCode 2.3.2。使用 npm ci 和已提交的 lockfile。SDK 必须精确固定版本，不使用 latest 或兼容 shim。

多行编辑器原生渲染检查：安装 Bun 1.3.14+ 后执行 `npm run test:tui`（本机使用 Bun 1.4.3）。该检查覆盖多行粘贴、换行、缩进、全选、校验失败保留输入、保存、小窗口自适应及弹窗关闭取消。普通 Node.js 逻辑测试不加载原生编辑器；OpenTUI 的 Node 原生 FFI 需要 Node 26.4+，Node 22/24 开发环境应使用 Bun 执行渲染检查。

`@opencode/theme` 是用于检查宿主主题 API 的开发依赖，不能省略：2.3.2 的 `theme.text` 是颜色集合，应取 `text.base` 等叶子颜色。渲染测试应使用同样的嵌套结构；组件测试之后仍需在真实 OpenCode 中测试加载与交互，避免宿主上下文差异被测试环境掩盖。

```sh
npm ci
npm run format
npm run verify
```

verify 顺序为格式检查、TypeScript 严格检查和自动测试。CI 在 Windows/Linux Node 24 上执行相同流程；CI 文件已提供，不代表远端 CI 已执行。

## 集成验证

```powershell
$env:OPENCODE_TEST_URL = 'http://127.0.0.1:19093'
$env:OPENCODE_TEST_ISOLATED = '1'
npm run test:host
```

先自行启动一个只用于测试的 OpenCode 服务并安装插件。测试读取 OPENCODE_SERVER_PASSWORD 进行鉴权，临时替换配置，结束后恢复；异常终止可能阻止恢复。因此工具要求显式地址和隔离确认变量，不允许将它指向日常服务。它使用本地 19091 端口的模拟服务，HTTP 400 是预期响应，仅验证出站协议路径和头。

## 修改约束

保持公开 exports、插件/RPC ID、Provider 前缀及 storage key 稳定。core 不引入宿主依赖。SDK 升级需同时进行类型检查、真实宿主验证及凭据/请求头回归。新增配置必须明确默认值及旧版本处理；不静默忽略字段。可观察行为变更需更新测试及用户文档。
