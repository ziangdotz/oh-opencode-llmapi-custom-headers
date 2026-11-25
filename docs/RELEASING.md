# 发布流程

本文描述插件 `v0.1.0` 的本地交付和发布准备。当前项目尚未声明已发布到 npm 公共仓库，也不会自动创建远端标签或上传产物。

## 1. 版本策略

- 插件版本严格保持 `0.1.0`，对外展示为 `v0.1.0`。
- 只有所有者明确要求升级插件版本时，才允许修改项目版本。
- 依赖升级、宿主适配、缺陷修复和文档更新**不构成**版本升级授权。
- 配置 schema 版本为 `1`，不随插件版本自动变化。
- 如果未来升级版本，必须同步：
  - `package.json`
  - `package-lock.json`
  - `tools/check-package.ts`
  - README、文档和 CHANGELOG
  - 安装包文件名和交付记录

## 2. 发布前检查清单

1. [ ] 变更记录、兼容矩阵和用户文档已更新。
2. [ ] `package.json`、`package-lock.json` 的项目版本均为 `0.1.0`。
3. [ ] `@opencode/plugin` 和 `@opencode/theme` 固定到目标宿主版本（当前 `2.4.1`）。
4. [ ] `@opentui/core` 和 `@opentui/solid` 固定到验证版本（当前 `0.9.4`）。
5. [ ] 锁文件与 manifest 的 dependencies/devDependencies 一致。
6. [ ] 执行 `npm ci`。
7. [ ] 执行 `npm run verify:release`。
8. [ ] 执行 `npm pack` 并记录 SHA-256。
9. [ ] 检查 tarball 文件白名单。
10. [ ] 在隔离宿主执行 `npm run test:host:smoke`。
11. [ ] 按 [验证](VALIDATION.md) 完成真实终端验收，或明确记录未执行项目。
12. [ ] 确认没有密钥、个人路径、数据库、`.validation`、`node_modules` 或旧安装包。
13. [ ] 记录提交 ID、宿主版本、Node/npm/Bun 版本和结果。

## 3. 发布门禁

```sh
npm ci
npm run verify:release
```

`verify:release` 展开为：

```text
format:check
  → check (tsc --noEmit)
  → test (22 项逻辑测试)
  → test:tui (Bun 原生渲染)
  → check:package (版本、锁文件、导出、白名单)
```

`npm pack` 的 `prepack` 会再次执行同一门禁。

`check:package` 检查：

- 项目版本为 `0.1.0`。
- 锁文件根版本和依赖字段与 manifest 一致。
- `@opencode/plugin` 为 `2.4.1`，且不在生产依赖中。
- 发布包只包含白名单文件。
- 所有 `exports` 目标都存在。
- 多行编辑器源码包含在包内。
- 不包含隐藏路径或 `node_modules`。

## 4. 产物

发布包通过 `files` 白名单包含：

```text
src/
tools/harden-development.mjs
docs/
examples/
README.md
README.en.md
CHANGELOG.md
LICENSE
CONTRIBUTING.md
SECURITY.md
package.json
```

不包含：

- `test/`
- `tools/` 中除 `harden-development.mjs` 外的开发工具
- `node_modules/`
- `.validation/`
- `.github/`
- 开发配置、日志和本机数据

包直接导出 TypeScript，依赖 OpenCode 的插件加载器，不是通用 Node.js 库。发布包不会生成 `dist`。

## 5. 生成与记录

```sh
npm pack
sha256sum opencode-llmapi-custom-headers-0.1.0.tgz
```

Windows PowerShell：

```powershell
npm pack
Get-FileHash .\opencode-llmapi-custom-headers-0.1.0.tgz -Algorithm SHA256
```

记录：

- 文件名和 SHA-256。
- 提交 ID。
- OpenCode、Node、npm、Bun 版本。
- `verify:release` 结果。
- 无模型烟雾检查结果。
- 真实终端验收结果或未执行原因。

## 6. 标签与发布

如果维护者决定发布：

1. 确认发布门禁和验收记录齐全。
2. 按仓库目标创建标签，例如 `v0.1.0`。
3. 上传经过检查的 `.tgz` 和 SHA-256。
4. 在发布说明中列出：
   - 支持的宿主版本。
   - 已验证范围。
   - 未验证项目。
   - 安全和支持边界。
5. 不要宣称 npm 公共发布、生产认证或完整协议验收，除非实际完成。

当前任务只生成本地包，不自动发布或创建标签。

## 7. 回滚发布

1. 撤回或标记有问题的产物。
2. 恢复上一个审核过的安装包和插件目录。
3. 恢复匹配的配置和数据快照。
4. 重新执行无模型烟雾检查和终端验收。
5. 在 CHANGELOG 中记录问题和回滚原因。

不要删除宿主数据库来“回滚”配置。

## 8. 依赖与审计

- 生产依赖只有 Zod。
- SDK、主题和 OpenTUI 是开发依赖，运行时由宿主提供。
- 发布前执行 `npm audit --omit=dev` 并记录结果。
- CI 对生产依赖告警阻断。
- 开发依赖的已知告警、本地防护和移除条件见 [依赖审查](DEPENDENCY-REVIEW.md)。
- 不要使用 `npm audit fix --force` 无审查改写宿主契约。

## 9. 文档同步

发布前确认以下文档与代码一致：

- README 的版本、宿主版本和安装步骤。
- `docs/README.md` 的基线表。
- `docs/ARCHITECTURE.md` 的模块和契约。
- `docs/CONFIGURATION.md` 的 schema 和默认值。
- `docs/VALIDATION.md` 的已验证/未验证范围。
- `CHANGELOG.md` 的日期和变更。
- `tools/check-package.ts` 的宿主版本断言。

文档中的示例不得包含真实密钥、内部端点或个人信息。
