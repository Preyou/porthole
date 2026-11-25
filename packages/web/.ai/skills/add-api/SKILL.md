# 新增 API 接入

当需要新增或接入业务 API 时使用这个技能。

## 流程

1. 读取 `AGENTS.md`。
2. 读取请求相关规则：`50-api-and-request.md`、`55-request-feedback.md`、`56-error-handling.md`。
3. 检查 `src/api/auto` 是否已有生成类型。
4. 如果需要更新接口类型，按 `50-api-and-request.md` 修改 OpenAPI 输入或配置，再运行 `bun run openapi-ts`。
5. 读取 `.ai/public/request-usage.md`。
6. 在 `src/api` 接入层确认应使用已有 `$api` / `$req`，还是需要用 `createApi` 和 `createRequest` 新增具名 `$xxxApi` / `$xxxReq`。
7. 在 app 请求层组合业务接口语义。
8. 首次对接某个后端时，分析其实际错误协议，并在对应 `createApi` 实例的 `getErrorMessage` 中完成一次性适配；不预设后端存在固定错误字段。
9. 可预期的接口错误优先在 `getErrorMessage` 中映射为 app i18n；不可预期错误允许保留原始错误文案，无可用文案时使用通用 i18n 兜底。
10. 自动提示、业务成功判定等横切逻辑优先在 API 接入边界集中处理。
11. 按 `86-documentation-sync.md` 判断是否需要同步文档。
12. 按 `90-quality-gates.md` 运行最小必要验证。

## 规则

- 请求封装、契约信任、生成物和错误处理以相关 request rules 为准。
- 后端错误协议只在 API 接入层适配，页面、组件和 feature 不重复解析原始错误响应。
- 不把具体业务接口假设写进 `@ngt/ui`。
