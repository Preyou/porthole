# Request Usage

本文档面向业务层 AI，说明 app 中 `$api` / `$req` 的使用边界和能力清单。它不是 `@ngt/ui/domains/request` 的完整文档；需要详细配置签名时，从 `docs/ngtui/manifest.json` 进入 module discovery，再读取投影内的 request 模块 README 和公开 TypeScript 契约。

## 分工

- `$api`：默认后端的类型化 API client，来自 `createApi`。
- `$req`：默认后端的组合式请求 hook，来自 `createRequest($api, options)`。
- `$req` 是 `src/api/useRequest.ts` 导出的 `useRequest` 的全局自动导入别名，两者是同一个请求 Hook，不需要另行导入或创建 `useRequest`。
- Vue 组件中发起请求时，优先使用 `$req`。
- `$req` 已覆盖绝大多数请求场景；实现或扩展请求相关能力前，必须先确认能否使用 `$req` 的现有配置、状态或方法解决，避免重复实现请求基础能力。
- 只有不需要组合式请求状态时，才直接使用 `$api`。

本文档说明 Starter 业务层的 `$api` / `$req` 用法和边界；`$req` 底层完整能力文档位于 `docs/ngtui/src/domains/request/README.md`。

## 多后端

对接多个后端时，API client 和 request hook 应成对维护：

```txt
sysApi -> $api
sysReq -> $req

adminApi -> $adminApi
adminReq -> $adminReq
```

规则：

- 每个后端一个 `createApi(...)` 实例。
- 每个 API 实例可以再用 `createRequest(api, options)` 创建对应 request hook。
- 组件内优先使用对应 `$xxxReq`。
- 不需要组合式状态时，才直接使用对应 `$xxxApi`。
- baseURL、鉴权、响应协议、通知策略集中在对应 api 实例。
- 分页协议、超时、请求策略、全局 hooks 等默认项集中在对应 req 实例。

## `$api` 支持的能力

`$api` 是类型化 API client，支持：

- URL 和 method 受 OpenAPI PathMap 约束。
- 请求参数按契约分为 `path`、`params`、`data` 等结构。
- `transform` 响应转换。
- 上传/下载进度回调。
- AbortSignal 取消。
- `forceRequest`。
- method key。
- 自动成功/失败提示控制。
- 业务成功判定。
- 统一成功/失败文案解析和通知分发。

常见用法：

```ts
const detail = await $api('/pets/{id}').get({
  path: { id },
})
```

## `$req` 支持的能力

`$req` 在 `$api` 之上提供组合式请求状态，支持：

- `data`
- `error`
- `loading`
- `status`
- `isSuccess`
- `isError`
- `pendingCount`
- `run`
- `refresh`
- `forceRun`
- `abort`
- `key`
- `downloadProgress`
- `uploadProgress`
- `onBefore`
- `onSuccess`
- `onError`
- `onFinally`
- `onCancel`
- `onDownload`
- `onUpload`

配置能力包括：

- `requestSource`：对象、ref、computed 或 getter 请求参数源。
- `immediate`：是否创建后自动执行。
- `watch`：参数或依赖变化后自动重新执行。
- `rateLimit`：防抖或节流。
- `retry`：失败重试。
- `timeout`：请求超时。
- `strategy`：并发写回策略。
- `keepDataOnError`：失败时是否保留数据。
- `clearErrorOnRun`：执行前是否清空旧错误。
- `initData`：初始数据。
- `onBefore` / `onSuccess` / `onError` / `onFinally` / `onCancel`：生命周期 hooks。
- `refreshTargets`：当前请求成功后刷新其他命名请求。
- `pagination`：分页增强。
- `initial`：分页初始状态。
- `loadingBar`：覆盖全局 LoadingBar 的默认联动模式或实例。
- `forceRequest`、`key`、`notify`、`onUpload`、`onDownload` 等 API 透传控制项。

GET 请求默认 `immediate=true` 且 `watch=true`；非 GET 默认关闭自动执行。

## 全局 LoadingBar 联动

当前 Starter 在 `src/api/useRequest.ts` 中把 `$req` 接入全局 `$loadingBar`，默认模式为 `'auto'`：

- 用户显式调用 `run`、`forceRun`、`refresh`，以及分页的 `go`、`next`、`prev`、`search`、`setPageSize` 时展示加载条。
- `immediate`、watch、轮询和 `refreshTargets` 触发的后台执行默认不展示加载条。
- 单个请求传入 `loadingBar: false` 可以禁用；传入 `true` 会跟踪包括自动执行在内的全部调用；传入 `'auto'` 会恢复默认模式。
- 需要隔离显示区域时，传入 `{ instance, mode }` 使用独立 LoadingBar 实例。

LoadingBar 只提供页面级操作反馈，不替代内容区 Skeleton、按钮 Spinner 或 `$req.loading`。全局实例采用最新调用优先语义；同一实例的新 session 会接管显示，旧请求仍继续执行，但不再更新已被替换的加载条。

## 缓存行为

当前 Starter 的 `sysApi` 没有覆盖 Alova 的 `cacheFor` 配置，因此 `$api` / `$req` 默认沿用以下策略：

- GET 请求缓存 5 分钟，使用内存缓存；其他 HTTP 方法默认不缓存。
- 首次请求或缓存未命中时访问后端；成功响应会写入缓存，失败响应不会写入缓存。
- 缓存按 method key 区分，URL、查询参数、请求体或 headers 不同，通常就是不同缓存项。
- `immediate`、`watch`、普通 `run(params)`、分页跳转和 `search(params)` 都走普通请求路径，默认允许命中缓存。

### 参数变化与自动请求

`watch` 观察到 `requestSource` 或额外依赖变化后，会以最新参数执行普通 `dispatchRun`。请求流程确实被触发，但不会自动设置 `forceRequest=true`，Alova 仍会先按 method key 查询缓存。

参数变化并不等于关闭缓存，而是通常会切换到另一份参数对应的缓存：

- 从 A 变为从未请求过的 B 时，B 无法命中 A 的缓存，通常会因 B 缓存未命中而访问后端。
- B 以前请求过且缓存仍有效时，会直接使用 B 自己的缓存。
- 从 A 切到 B 再回到 A 时，可以使用 A 的有效缓存恢复界面。
- `watch` 被触发但最终 key 未变化时，仍可能返回同一份缓存，因此 watch 触发不代表后端一定收到请求。

### 如何做业务决策

缓存机制负责复用相同请求，不负责判断一次操作是否必须获得最新数据。使用方可以按下面的目标自行选择：

- 配置、字典、普通列表和详情等短时间内允许复用的数据，可以保留默认缓存或设置合适的 TTL。
- 页面返回、参数联动、watch 等隐式读取可以利用缓存快速恢复；不同参数会由 Alova 自动分开存储。
- 任务进度、在线状态、库存余额等始终不能接受旧值的数据，可以在请求配置中使用 `cacheFor: 0`。
- 用户点击查询不必一律强制请求。如果该操作表达“立即重新获取”，可以使用 `forceRun(params)`；如果业务允许复用短期结果，普通 `run(params)` 或分页 `search(params)` 也可以继续使用缓存。
- 全部 GET 共享同一策略时可以在 `src/api/sysApi.ts` 配置全局 `cacheFor`；局部差异可以在 `$api` / `$req` 调用处配置。
- 需要持久化复用时可以使用 `cacheFor: { expire, mode: 'restore' }`，同时确认数据适合写入持久化存储。

```ts
// 单个请求禁用缓存。
const status = $req('/status', 'get', { cacheFor: 0 })

// 单个请求缓存 30 秒。
const dictionary = $req('/dictionary', 'get', { cacheFor: 30_000 })
```

### 普通执行与临时绕过

临时绕过只影响本次读取；强制请求成功后，最新响应仍会更新缓存。

`refresh()` 和 `forceRun(params)` 都会强制本次请求，但表达的含义不同：`refresh()` 使用当前或上一次参数，适合表达“同步当前资源”；`forceRun(params)` 使用明确传入的参数，适合表达“以这组参数重新执行”。参数可以与上次相同，也可以不同。

| 执行方式                                                  | 缓存行为                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `immediate`、`watch`、`run(params)`、分页 `go` / `search` | 普通执行，允许命中缓存                                     |
| `refresh(false)`                                          | 使用当前或上一次参数普通执行，允许命中缓存                 |
| `await $api('/status').get({ forceRequest: true })`       | 只强制这一次直接调用                                       |
| `refresh()`                                               | 默认强制，使用当前或上一次参数；不需要再写 `refresh(true)` |
| `forceRun(params)`                                        | 强制，并使用调用方传入的参数                               |
| `refreshTargets`                                          | 目标请求执行强制 `refresh()`                               |
| `polling.forceRefresh`                                    | 默认 `true`；设为 `false` 时轮询也允许命中缓存             |

如果一个 `$req` 实例只服务于始终要求最新结果的手动操作，可以配置 `forceRequest: true`；如果同一个实例还承担自动读取，则可以保留普通缓存，只在特定操作中调用 `refresh()` 或 `forceRun(params)`。

当 watch 已触发但界面看起来没有刷新时，可以先检查最终参数或请求 `key`。如果 key 没变，或者这组参数已经有有效缓存，Alova 返回缓存就是预期行为；再根据产品意图决定保留缓存、调整 `cacheFor`，还是显式强制本次请求。

常见用法：

```ts
const {
  data: users,
  error: usersError,
  loading: usersLoading,
  run: fetchUsers,
} = $req('/users', 'get', {
  requestSource: computed(() => ({
    params: {
      keyword: route.query.keyword,
    },
  })),
})
```

不推荐把 `$req(...)` 返回值整体收进一个大对象再到处读取属性：

```ts
const usersRequest = $req('/users', 'get')
```

更推荐在创建时解构出当前组件真正使用的状态和动作。存在多个请求时，用别名表达业务语义：

```ts
const {
  data: users,
  run: fetchUsers,
} = $req('/users', 'get')

const {
  loading: createUserLoading,
  run: createUser,
} = $req('/users', 'post', {
  immediate: false,
})
```

## 加载态表达

加载态用于表达用户当前操作或内容区域正在等待，不应与每个请求机械对应。默认目标是保持界面稳定和可交互，并让反馈尽可能靠近受影响区域。

### 使用 `@ngt/ui` 请求状态

- Vue 组件内需要响应式请求状态时使用 `$req`，并直接消费 `loading`、`pendingCount`、`status`、`data` 和 `error`。
- `loading` 是 `pendingCount > 0` 的派生状态，会正确覆盖当前实例的并发调用、重试、取消和作用域销毁。不要再使用独立的 `ref(false)` 与 `try/finally` 重复维护请求 loading。
- 取消会进入 `onCancel` 而不是 `onFinally`；自行在 `onFinally` 中关闭 loading 可能遗漏取消路径。
- `$api` 是 `@ngt/ui` `createApi` 创建的一次性 Promise 请求入口，不提供 Vue 响应式请求状态。action、store 或流程函数可以直接使用 `$api`；组件需要根据请求状态渲染时优先使用 `$req`。

`loading=true`、请求调度已开始和浏览器产生新网络请求是不同事件。请求可能命中缓存或共享在途传输；防抖或节流等待期间任务还没有进入状态机，`loading` 也可能仍为 `false`。界面应根据用户是否正在等待决定如何反馈，不根据网络面板或单次 `loading` 变化机械展示遮罩。

缓存命中或快速请求可能使可见加载态一闪而过。对强视觉反馈必要时使用应用统一的延迟展示策略：请求在阈值前结算则不展示，也不为满足最短动画时长而延迟已可用内容。

### 选择反馈方式

| 请求场景                                     | 推荐表现                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| 首次加载且没有可展示内容                     | 在对应内容区域展示与最终结构接近的 Skeleton                                      |
| GET 参数变化、搜索或分页                     | 只在列表或表格范围内表达等待；防抖等待本身不需要 Spinner                         |
| 已有数据的 `refresh`                         | 保留原内容，必要时展示轻量的局部刷新标识                                         |
| polling、watch 联动或后台同步                | 默认静默更新，不重复展示 Skeleton 或遮罩                                         |
| 保存、提交等 mutation                        | 在触发按钮内展示 Spinner，需要防止重复提交时只禁用相关控件                       |
| 可安全回滚的局部 mutation                    | 优先使用 `run(params, optimistic)` 或 `forceRun(params, optimistic)` 乐观更新    |
| `refreshTargets` 引发关联刷新                | 源操作和目标区域分别消费自己的 loading/error，不合并成页面级 loading             |
| 上传、下载或可计算进度的长任务               | 使用 `uploadProgress`、`downloadProgress` 或业务进度，不只展示无限旋转的 loading |
| 必须阻止某个区域交互                         | 才使用限定在该容器内的局部遮罩                                                   |
| 页面无法展示任何有意义内容且必须阻止全部交互 | 才使用页面级 loading                                                             |

已有数据时，`@ngt/ui` 默认的 `keepDataOnError=true` 允许刷新失败后保留旧内容。应同时表达刷新失败和可恢复入口，不先清空内容再展示全区域错误。判断“是否已有可展示内容”时使用场景语义，不要只检查 `data !== undefined`，因为请求可能配置 `initData`。

首次加载失败应进入明确的错误态，可恢复时提供重试入口。空状态只表示请求成功但没有数据，不表示请求还在加载或已经失败。

乐观更新只用于结果可预测、失败可回滚且冲突风险可控的局部操作。`@ngt/ui` 会在请求失败或取消时回滚当前仍有效的乐观更新；如果“HTTP 成功但业务失败”仍 resolve Promise，状态机会把它当作成功。需要触发失败状态和回滚时，应在统一响应处理或 `transform` 边界抛出错误。

同一 `$req` 实例的 `loading` 聚合其所有活动调用。多个表格行或局部操作可以独立执行时，为它们保留局部 pending 身份或拆分交互边界，不因任意一项请求禁用整个容器。加载反馈同时提供 `aria-busy`、`role="status"` 或可访问名称，并避免导致焦点丢失、布局跳动或无关内容不可操作。

## 分页和无限列表

`$req` 支持分页增强：

- `pagination: true` 使用 req 实例的默认分页协议。
- `pagination: { ... }` 局部覆盖分页协议。
- `initial.page`
- `initial.pageSize`
- `list`
- `total`
- `page`
- `pageSize`
- `go`
- `next`
- `prev`
- `search`
- `setPageSize`
- `clear`
- `infinite` 无限列表模式。

当前 starter 在 `src/api/useRequest.ts` 中已经配置默认分页协议：

- 请求参数写入 query：`page`、`pageSize`。
- 响应读取路径：`response.data.items` 和 `response.data.total`。
- 符合该协议的列表接口可以直接使用 `pagination: true`。
- 接口协议不同的页面，在调用处用 `pagination: { toParams, fromResponse }` 局部覆盖。

详细分页协议写法从 `@ngt/ui` 的 module discovery 进入 request 模块 README。

## 常用判断

- 页面或组件需要 loading/error/data/run：用 `$req`。
- 只在事件里做一次请求且不关心响应式状态：可以直接用 `$api`。
- 需要列表筛选、分页、排序和 URL query 联动：优先用 `$req` 的 `requestSource` / `watch` / `pagination`。
- 需要多个后端：新增成对的 `$xxxApi` / `$xxxReq`。
- 需要修改底层请求能力：先从 `@ngt/ui` 的 module discovery 阅读 request 模块契约，再提出独立的上游修改方案。

## 禁止

- 不直接使用 `fetch`、`axios`、alova method 或临时 client 调后端。
- 不绕过 `$api` / `$req` 或对应具名实例。
- 不在组件里重复写全局鉴权、baseURL、响应协议、通知策略。
- 不在调用处重复校验 OpenAPI 和 API client 已经保证的类型契约。
