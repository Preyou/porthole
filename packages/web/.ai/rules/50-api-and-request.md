# API And Request

app 默认使用 OpenAPI 生成类型，并通过 `@ngt/ui/domains/request` 组织请求状态。

## 当前结构

- `src/api/sysApi.ts`：创建系统 API client，配置默认请求行为。
- `src/api/useRequest.ts`：创建 app 级 request hook。
- `src/api/openapi.json`：零 endpoint 的默认生成输入，仅用于保持初始化流程可运行。
- `src/api/auto/**`：OpenAPI 生成物，禁止手改。
- `openapi-ts.config.ts`：OpenAPI 生成配置。
- `OPENAPI_INPUT`：由具体应用配置的 OpenAPI schema URL 或本地文件路径。

## 规则

- 接口类型来自 OpenAPI 或明确契约。
- OpenAPI 类型生成使用 `OPENAPI_INPUT`；真实 app 应把它替换为自己的 schema URL 或本地文件路径。
- 模板不启动开发 Mock Server，也不提供示例业务接口。
- 生成物不要手改，需要更新时运行 `bun run openapi-ts`。
- `$req` 是 `src/api/useRequest.ts` 导出的 `useRequest` 的全局自动导入别名，两者是同一个请求 Hook，不需要另行导入或创建 `useRequest`。
- 使用 `$api` / `$req` 前，先读业务用法文档 `.ai/public/request-usage.md`；需要查询完整能力时，读 `docs/ngtui/src/domains/request/README.md`。
- 业务代码调用后端 API 时，仅允许通过 `$api` 或基于对应 api 实例创建的 app 请求封装。
- 在 Vue 组件中发起请求时，优先使用 `$req`，以获得组合式 API 的 loading、error、data、run 等状态能力。
- `$req` 已覆盖绝大多数请求场景；实现或扩展请求相关能力前，必须先确认能否使用 `$req` 的现有配置、状态或方法解决，避免重复实现请求基础能力。
- `$api` 更适合作为底层类型化 API client；组件内只有在不需要组合式请求状态时才直接使用 `$api`。
- 不在页面、组件或 feature 中直接使用 `fetch`、`axios`、alova method 或临时 client 调后端。
- 对接多个后端时，在 `src/api` 接入层使用 `createApi` 创建多个具名 api 实例，再通过对应 api 实例请求后端。
- 多后端对接时，API client 和 request hook 应成对维护。默认后端使用 `$api` / `$req`；其他后端使用清晰命名的 `$xxxApi` / `$xxxReq`。
- 组件内优先使用对应的 `$xxxReq`，只有不需要组合式状态时才直接使用 `$xxxApi`。
- 多后端实例应有清晰命名和独立配置，不把 baseURL、鉴权、响应协议散落到业务调用处。
- 业务请求组合留在 app 层。
- 通用请求状态、分页协议、自动提示策略优先复用 `@ngt/ui/domains/request`。
- `$api` / `$req` 的缓存机制以 `.ai/public/request-usage.md` 的“缓存行为”章节为准：先理解 `watch` 等自动执行仍走普通缓存路径、参数通过 method key 隔离缓存，以及 `refresh()` 与 `forceRun(params)` 的实际差异，再按数据新鲜度和操作意图选择是否复用或绕过缓存。
- 信任 API client 和 OpenAPI 类型契约，不在调用处重复做无意义兜底。
- 如果接口契约不完整或已知不可靠，应在 API 接入边界集中适配。

## 新增接口

- 先确认是否已有生成类型。
- 没有生成类型时，优先更新 OpenAPI schema 或配置。
- 如果临时手写类型，必须明确这是 app 层业务契约。
- 不把具体业务接口假设上提到 `@ngt/ui`。
