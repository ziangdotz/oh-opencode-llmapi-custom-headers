# 发布流程

当前发布基线：v0.1.1。package.json 和 package-lock.json 使用 0.1.1；Git tag（如使用）为 v0.1.1。配置版本仍为 1，不随包版本变化。

1. 更新变更记录、兼容矩阵和用户文档。
2. 同步 manifest/lockfile 版本，执行 npm ci 与 npm run verify:release（需要 Bun 1.4.3）。
3. 使用目标 OpenCode 对真实 TUI、集成/密钥、模型目录和请求头做回归，记录未完成范围。
4. npm pack（prepack 自动执行 verify:release），检查 tarball 清单和独立安装加载；记录 SHA-256。包检查包括版本、lockfile、导出入口和文件白名单。
5. 核对无密钥、个人路径、数据库、本机测试配置或旧安装包。
6. 按维护者的仓库/发布目标创建版本标签和上传产物。当前任务仅生成本地包，不自动发布或创建标签。

发布包通过 files 白名单包含 src、docs、examples、README、CHANGELOG、LICENSE；不包含 test、tools、node_modules、.validation、CI 或开发配置。包直接导出 TypeScript，依赖 OpenCode 的插件加载器，不是通用 Node.js 库。

SemVer：修复使用 patch；新增兼容功能使用 minor；不兼容变更需明确迁移说明。0.x 版本仍需记录行为变化。依赖升级应单独验证，不能通过 npm audit fix --force 无审查改写宿主契约。
