# Global Helpers

本文档面向业务侧 AI，说明当前 app 中 `$` 开头全局 helper 的可用范围和使用边界。

## 通用规则

- `$` helper 来自 app 的自动导入、Vue app 注入或类型声明；使用前优先确认 `vite.config.ts`、`types/vite-env.d.ts`、`types/auto/auto-imports.d.ts` 或对应 public 文档。
- 已有 `$` helper 是应用基础设施入口，不要在页面或 feature 中绕开它重新创建同类 client、toast、i18n 或 class 工具。
- 不把 `$` helper 的 app 语义写入 `@ngt/ui`；公共包需要能力时应通过 props、slots、回调或包自身机制接收。

## `$i18n`

- `$i18n` 是 `src/locales` 导出的 i18n global 实例，可在 Vue 组件外使用。
- 在 `definePage`、路由 meta、菜单配置、表格列配置、schema 配置等非 Vue setup 环境中，可以使用 `$i18n.t(...)` 生成当前文案。
- 新增 `$i18n.t(...)` key 时，同步维护 `src/locales/zh-CN.json` 和 `src/locales/en-US.json`。
- 路由 meta 需要翻译时使用稳定的 `titleKey`，由 menu-router、breadcrumb-router 和应用文档标题在渲染时解析；不要在 `definePage` 初始化阶段把 `$i18n.t(...)` 的结果写进 `title`，否则切换语言后不会更新。

## `$api` 和 `$req`

- `$api` 是 app 默认类型化 API client，适合不需要组合式请求状态的底层调用。
- `$req` 是 app 默认请求状态入口，Vue 组件内发请求优先使用 `$req`。
- 使用 `$api` / `$req` 前，读取 `.ai/public/request-usage.md`。
- 不在页面、组件或 feature 中直接使用 `fetch`、`axios`、alova method 或临时 client 调业务后端。

## `$toast`

- `$toast` 用于需要用户立即感知的全局提示。
- 当前默认 `$api` / `$req` client 已开启请求失败自动提示；页面不重复触发含义相同的 `$toast`，AI 也不在每个调用点要求重复处理。
- 请求通知不替代业务错误状态；页面仍可以渲染与通知一致的内容块错误状态。
- 表单字段错误优先展示在字段附近，不使用全局 `$toast`。
- 默认展示位置和自动关闭时间分别由 `VITE_TOAST_POSITION` 和 `VITE_TOAST_DURATION_MS` 配置；单次调用显式传入的配置优先。
- 需要持续展示的通知使用 `duration: Infinity`；`$toast.loading()` 需要更新为结果状态或主动关闭。

## `$loadingBar`

- `$loadingBar` 是绑定到 `document.body` 的全局共享 LoadingBar 实例，适合页面切换、全局任务和跨组件操作。
- `$req` 默认以 `auto` 模式复用该实例：用户显式发起的请求操作显示加载条，初始化、watch、轮询和关联后台刷新保持静默。
- 单个请求可以通过 `loadingBar: false` 禁用联动，或使用 `true`、`'auto'` 和完整实例配置覆盖默认值。
- 局部容器或隔离场景应通过 `@ngt/ui/domains/loading-bar` 的 `createLoadingBar()` 创建独立实例。
- 默认定位、显示延迟、预期时长和结束时长分别由 `VITE_LOADING_BAR_POSITION`、`VITE_LOADING_BAR_DELAY_MS`、`VITE_LOADING_BAR_DURATION_MS`、`VITE_LOADING_BAR_SETTLE_DURATION_MS` 配置。
- `start()` 返回 session 完成 Promise；新 session 覆盖旧 session 时旧 Promise 会拒绝，业务代码需要按需处理该结果。

## `$cn`

- `$cn` 用于合并条件 class 和 Tailwind class。
- 只合并合法 Tailwind class、组件 variant 结果和主题 token class；不要借 `$cn` 固化传统 CSS 或硬编码视觉风格。
