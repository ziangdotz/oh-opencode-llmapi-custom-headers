# 依赖审查

本文记录插件 `0.1.0` 的依赖边界、审计结果和开发期防护。审计结果具有时效性，发布前应重新执行。

## 本轮宿主依赖对齐（2026-11-26）

SDK/theme 使用 2.4.2；theme 依赖 OpenTUI 0.9.9，开发期 core/solid 同步至 0.9.9。OpenTUI 声明 Node >=26.4.0、Bun >=1.3.14；Node 24.22.1 安装产生 EBADENGINE 警告，原生渲染使用 Bun 1.4.3。旧审计结果保留为历史，本轮未执行 npm audit，不将旧结果归于当前依赖树。SDK 的内部包及 Effect 4.1.0 随锁文件同步。

## 1. 运行时依赖

生产安装只包含：

| 包    | 版本    | 用途            |
| ----- | ------- | --------------- |
| `zod` | `4.6.7` | 配置和 RPC 校验 |

OpenCode 在运行时提供以下模块，因此不作为生产依赖打包：

- `@opencode/plugin`
- `@opencode/theme`
- `@opentui/core`
- `@opentui/solid`
- `solid-js`
- `effect`（由宿主映射，插件不直接使用）

这些模块在 `devDependencies` 中固定精确版本，用于类型检查和本地测试：

| 包                 | 版本     |
| ------------------ | -------- |
| `@opencode/plugin` | `2.4.2`  |
| `@opencode/theme`  | `2.4.2`  |
| `@opentui/core`    | `0.9.9`  |
| `@opentui/solid`   | `0.9.9`  |
| `solid-js`         | `1.9.17` |

## 2. 2026-11-24 审计

命令：

```sh
npm audit --omit=dev
npm ls --omit=dev --all
```

结果：

- 生产依赖漏洞：`0`（info / low / moderate / high / critical 均为 0）。
- 生产依赖树：根包 + `zod@4.6.7`。
- `npm install` 对完整依赖树报告 0 项漏洞。

限制：

- 审计结果只描述当前 lockfile 和当前漏洞库，不保证未来。
- 生产零告警只覆盖插件安装依赖，不覆盖 OpenCode 宿主自身的依赖。
- 不把审计结果表述为安全审计或生产认证。

## 3. OpenTUI 引擎提示

`@opentui/core@0.9.4` 声明：

```text
bun >=1.3.14
node >=26.4.0
```

在 Node 22/24 上安装会出现引擎警告，这是预期现象：

- 项目只使用 Node 执行格式、类型和逻辑测试。
- 原生 TUI 渲染测试使用 Bun `1.4.3`。
- 宿主使用自带运行时加载 OpenTUI。

不要为了消除警告而修改宿主或伪造 Node 版本。

## 4. 依赖覆盖

`package.json` 使用精确覆盖：

```json
{
  "overrides": {
    "glob": "14.0.6",
    "minimatch": "11.0.9",
    "esbuild": "0.28.1"
  }
}
```

这些覆盖用于固定开发工具链中的传递依赖版本。升级覆盖版本时必须：

1. 重新执行 `npm ci`。
2. 执行完整发布门禁。
3. 重新运行依赖防护回归。
4. 记录升级原因和结果。

## 5. 开发期 glob 防护

历史告警报告 `picomatch` 4.0.7 尚无已发布修复版本。`tools/harden-development.mjs` 在安装后对本地开发副本添加明确防护：

- 只处理 `node_modules` 中的 `picomatch@4.0.7`。
- 遇到其他版本直接报错，要求先审查。
- 对包含星号的重复 extglob 按字面量处理，避免进入危险正则生成分支。
- 重复执行是幂等的。

`test/dependency.test.ts` 使用 2 秒子进程超时验证：

- `+(*)`、`+(*a)`、`*(*a)`、`+(*|a)` 等恶意模式不会挂起或误匹配。
- 普通 glob 和合法 extglob 仍正常工作。

该防护收紧开发工具语义，不冒充上游修复，也不修改 OpenCode 自身二进制。上游发布修复后应移除本地补丁并重新回归。

## 6. 安装脚本

`package.json` 的 `postinstall` 执行 `tools/harden-development.mjs`。如果使用 `--ignore-scripts` 安装，需要手动执行：

```sh
node tools/harden-development.mjs
```

CI 会运行恶意输入回归；未加固的副本不应通过门禁。

## 7. 供应链策略

- 使用 `npm ci` 和提交的 lockfile。
- 不使用 `latest` 或宽版本范围。
- 生产依赖变更必须单独提交并审查。
- 不使用 `npm audit fix --force` 无审查改写宿主契约。
- 发布前记录 `npm audit --omit=dev` 结果。
- 不把本机 npm 审计输出（可能含路径）原样放入发布包。

## 8. 历史记录

- **2026-11-24**：SDK/theme 升级到 2.4.1，OpenTUI 保持 0.9.4；生产审计 0 项；完整依赖树审计 0 项。
- **2026-11-24（早前）**：SDK/theme 2.4.0；生产审计 0 项。
- **2026-11-18**：Zod 从 4.3.6 升级到 4.6.7，处理受限集合验证内存耗尽报告；生产审计 0 项。
- 更早的告警数量和处置记录不代表当前 lockfile。

维护者应在自己的环境中重新运行审计，并保留带时间戳的报告。漏洞库更新后计数可能变化。
