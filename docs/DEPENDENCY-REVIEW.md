# 依赖审查

日期：2026-11-18。插件 0.1.1，SDK 2.3.2。审查命令：`npm audit --omit=dev --json`，以提交的 lockfile 为准。

本次将直接依赖 Zod 从 4.3.6 升级到 4.6.7，处理 [受限集合验证可能耗尽内存](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) 的高危报告，升级后必须重新运行发布门禁和宿主回归。

后续处置：OpenCode 在运行时提供 SDK，现将 @opencode/plugin 2.3.2 限定为开发依赖，生产安装仅依赖 Zod。glob 精确覆盖至 14.0.6、minimatch 至 11.0.9，esbuild 至 0.28.1；通过项目回归验证这些覆盖。生产审计已为 0 项，CI 对任何生产告警阻断交付。

开发依赖中的 picomatch 4.0.7 尚无已发布修复版，npm 仍会按版本报告 5 个 high（根问题及传播包）。postinstall 的 tools/harden-development.mjs 对安装副本添加明确防护：包含星号的重复 extglob 按字面量匹配，拒绝进入危险正则生成分支。带 2 秒进程超时的回归验证 +(*)、+(_a)、_(_a)、+(_|a)，并验证普通 glob 与无星号 extglob。该防护收紧开发工具 glob 语义，不冒充上游修复，也不修改 OpenCode 自身二进制。

不能用 --ignore-scripts 安装后直接跳过防护；若禁用安装脚本，需手动执行 node tools/harden-development.mjs。CI 的恶意输入回归会阻止未加固副本通过。上游发布修复后应移除该本地补丁并重新回归。生产零告警只描述插件的安装依赖，宿主自身的依赖仍由 OpenCode 维护。

报告含本地安装路径，不随安装包分发原始 npm 输出。维护者应在自己的环境重跑审计并保留报告；漏洞库更新后计数可能变化。不得将自动审计上传完整配置或凭据。
