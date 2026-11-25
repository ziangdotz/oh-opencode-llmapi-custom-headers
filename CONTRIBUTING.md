# 贡献规范

共同分层、开发流程、文档职责与验证授权见 [统一工程规范](docs/ENGINEERING.md)。项目专属规则见本文。

感谢参与改进。提交前请阅读 [架构](docs/ARCHITECTURE.md)、[开发](docs/DEVELOPMENT.md) 和 [安全模型](docs/SECURITY.md)。

## 1. 提交内容

每个变更应说明：

- 触发问题和实际行为。
- 最终行为与用户可见影响。
- 验证方式和未验证范围。
- 兼容性、配置 schema 和迁移影响。
- 是否涉及宿主版本、SDK 或依赖变更。

不要在一个提交中混合无关重构、依赖升级和行为变更。

## 2. 本地检查

```sh
npm ci
npm run format
npm run verify
```

发布候选或涉及 TUI 的变更：

```sh
npm run verify:release
```

要求 Bun `>=1.3.14`；本项目在 `1.4.3` 上验证。

涉及宿主交互的变更还应执行：

- 隔离宿主无模型烟雾检查（`npm run test:host:smoke`）。
- 真实 OpenCode 终端中的菜单、编辑器、保存、返回和 `/connect` 检查。

`npm run test:host` 会调用模型生成接口，只能在明确授权和隔离服务下运行。

## 3. 代码约束

- 保持公开 exports、插件/RPC ID、Provider 前缀和 storage key 稳定。
- `core` 不引入宿主依赖。
- 新增配置必须定义默认值、校验和旧数据迁移；不静默忽略未知字段。
- 可观察行为变更必须更新测试和用户文档。
- 用户界面文案保持 `English / 中文`。
- 遵循现有 TypeScript 风格和 Prettier 配置。
- 不提交 `node_modules`、`.validation`、数据库、日志、密钥或生成的 `.tgz`。

## 4. 版本与依赖

- 插件版本严格保持 `0.1.0`，除非所有者明确授权升级。
- 依赖升级必须单独审查，不能使用 `npm audit fix --force` 无审查改写宿主契约。
- SDK、主题和 OpenTUI 使用精确版本。
- 修改 `package.json` 后必须更新 `package-lock.json`，并运行 `npm run check:package`。

## 5. 文档

- 行为、配置或兼容性变化必须同步更新相关文档和 `CHANGELOG.md`。
- 文档中的版本、宿主基线、命令和默认值必须与代码一致。
- 示例使用占位值和示例域名，不包含真实密钥或内部地址。
- 明确区分“已验证”和“未验证”，不要把静态检查描述为真实宿主验收。

## 6. 安全

- 不在 issue、PR、日志或测试夹具中放置真实密钥。
- 不公开未修复漏洞的可利用细节。
- 涉及凭据、请求头、网络访问和持久化的变更应说明威胁和缓解。
- 发布前执行 `npm audit --omit=dev` 并记录结果。

## 7. 评审清单

- [ ] 问题描述清晰，行为变化可验证。
- [ ] 测试覆盖新增或修改的行为。
- [ ] `npm run verify` 通过。
- [ ] 涉及 TUI 时 `npm run test:tui` 通过。
- [ ] `npm run check:package` 通过。
- [ ] 配置兼容和迁移已审查。
- [ ] 文档和 CHANGELOG 已更新。
- [ ] 没有密钥、个人路径、数据库或生成产物。
- [ ] 未验证项目已明确记录。

发布流程见 [发布流程](docs/RELEASING.md)。
