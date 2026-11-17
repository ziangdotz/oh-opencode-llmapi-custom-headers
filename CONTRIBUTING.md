# 贡献规范

先阅读 docs/ARCHITECTURE.md 和 docs/DEVELOPMENT.md。提交变更应说明实际问题、最终行为、验证方式及兼容影响。遵循现有 TypeScript 风格，运行 npm run verify；修改公开行为时更新测试、文档和 CHANGELOG。

不要提交密钥、个人路径、数据库、.validation 数据、node_modules 或生成的 tgz。不要修改公开插件标识、存储键及既有凭据引用，除非同时提供明确迁移方案。发布流程见 docs/RELEASING.md。
