# Quality Gates

维护 app 后，根据改动范围执行验证。

## 常用命令

```sh
bun run openapi-ts
bun run check:ngt-docs
bun run lint
bun run type-check
bun run build
```

命令以 `bun run` 为例，可替换为 `bun run` / `pbun run`。

## 规则

- 每次改动后，只对变更文件运行 ESLint format，例如 `eslint <changed-files> --fix`。
- 提交改动前，只对变更文件或工具支持的最小受影响范围运行类型检查。
- 如果 Vue/TypeScript 工具无法可靠地只检查单个变更文件，说明原因，并选择最小受影响项目检查。
- 改 OpenAPI schema 或生成配置时，运行 `bun run openapi-ts`。
- 改公共包依赖、AI 文档入口或同步脚本时，运行 `bun run sync:ngt-docs` 和 `bun run check:ngt-docs`。
- 改路由、页面或自动导入配置时，注意生成类型是否需要刷新。
- 改页面或目录结构时，检查 `src/views` 是否仍只包含真实路由页面，没有非路由组件、状态、工具或测试文件。
- 改路由页时，检查是否存在仅用于标记页面或重复默认配置的 `definePage()`；没有自定义路由配置需求时应删除。
- 需要真实页面调试时，读取 `.ai/rules/89-browser-debugging.md`。
- 推送前运行完整检查。

## 检查重点

- 是否保持业务代码在 app 层。
- 是否避免公共包反向依赖 app。
- 是否同步路由、文案、环境变量 example。
- 是否没有手改生成物。
- 本地 AI 文档投影是否与当前安装的 UI 版本一致。
- 本次变更中复杂、有歧义、存在非显然约束或特殊处理的逻辑是否有相邻中文注释，并说明原因、约束或取舍。
- `src/views` 中的每个文件是否都直接对应一个 URL 页面或父布局路由。
- 是否只格式化变更文件。
