# State And Context

app 可以维护业务状态，但状态范围要清晰。

## 默认优先级

状态方案按作用域从小到大选择：

1. 页面或组件局部状态：优先 `ref` / `computed`，靠近使用处。
2. 同一组件树共享状态：优先 typed provider/inject。
3. 同一父布局、同一业务域或同一 feature 下跨页面共享状态：把 provider 放在父布局或父 feature。
4. 可复用但不需要共享同一实例的状态逻辑：使用 composable。
5. 可恢复、可分享、需要进入 URL 的页面状态：使用 route params/query。
6. 请求状态、分页、重试、loading、error、data：优先使用 `$req`。
7. 必须脱离组件树、跨不相关页面树共享、需要复杂持久化、需要 store devtools/插件生态或组件外代码必须直接读写时，才使用 store。

不要因为状态跨页面就默认创建 store；如果这些页面有共同父布局或共同 feature，优先父布局/feature provider。

## 放置规则

- 简单页面局部状态可以直接留在路由页；需要拆成独立文件时，放到对应的 `src/features` 业务目录，不得放在 `src/views` 的页面同名目录中。
- 跨页面业务状态先判断是否属于同一父布局、同一业务域或同一 feature；能由父布局或父 feature provider 覆盖时，优先 provider/inject。
- provider/inject 应使用 typed injection key，并封装成 `provideXxxContext()` / `useXxxContext()` 一类明确 API；不要散落字符串 key。
- provider 缺失时，`useXxxContext()` 应明确报错；只有确实允许缺省时，才提供显式 optional API。
- provider 只暴露必要的 readonly state、派生状态和 action，不把内部可变实现随意透出。
- feature 私有 provider 优先放在对应 feature 目录；轻量父布局 provider 可以直接由父路由页创建，拆出的 provider 实现放在父 feature 目录；全 app provider 只有在作用域确实覆盖全应用时才放到应用入口附近。
- 通用状态能力优先使用 `@ngt/ui`。
- app 专属上下文可以在 app 层 provider/composable 中维护。
- 页面级访问状态、权限判断、feature flag 判断和进入条件，优先靠近路由页或页面 feature。
- 全局登录态、租户上下文、token 生命周期和基础权限上下文，优先放在明确的 app provider、路由初始化或全局守卫等已有接入边界；只有需要脱离组件树或组件外直接读写时才使用 store。
- 如果确实需要 store，应按业务域拆分，避免把 UI 临时状态、请求缓存和无关业务状态塞进同一个全局 store。

## Provider 代码组织

provider 跟随作用域放置，不默认创建 `src/providers` 这类全局大桶。
业务 context 默认使用 `@ngt/ui/utils` 的 `createContext()` 创建 typed provider/inject helper，再在本地二次命名为具体 API。

feature 私有上下文放在对应 feature 目录：

```txt
src/features/User.vue
src/features/user/
  userContext.ts
  UserInfo.vue
  UserBuild.vue
```

父布局或业务域上下文放在父布局 feature 附近：

```txt
src/features/Home.vue
src/features/home/
  homeContext.ts
  HomeProvider.vue
  HomeSidebar.vue
```

真正全应用上下文才放到 `src/app`：

```txt
src/app/
  AppProviders.vue
  appContext.ts
```

- `xxxContext.ts` 推荐写法：

```ts
import { createContext } from '@ngt/ui/utils'

interface XxxContext {
  refresh: () => Promise<void>
}

const {
  provideContext: provideXxxContext,
  useContext: useXxxContext,
} = createContext<XxxContext>()

export {
  provideXxxContext,
  useXxxContext,
}
```

- 轻量 provider 只需要 `xxxContext.ts`，由父组件自己调用 `provideXxxContext()`。
- 复杂 provider 如果自己负责请求、初始化、loading、error、阻断子树渲染等流程，再增加 `XxxProvider.vue`。
- context 文件统一命名为 `xxxContext.ts`。
- 对外 API 统一命名为 `provideXxxContext()`、`useXxxContext()`。
- 只有确实允许缺省 provider 时，才额外提供 `useOptionalXxxContext()`。
- injection key 默认留在 context 文件内部；除非有明确扩展需求，不对外暴露 key。
- `src/components` 不放 provider；组件需要上下文时，应从所属 feature/layout/app 的 context API 注入。

## 禁止

- 把所有状态都全局化。
- 把 store 当作 provider/inject、URL 状态或 `$req` 的默认替代品。
- 为了跨几个同父布局子页面共享状态而直接创建 store。
- 在 store 中堆页面局部 UI 状态、复杂表格状态、表单编辑草稿或临时筛选条件；这类状态优先留在路由页、对应 feature、URL 或 provider。
- 把 app store 注入 `@ngt/ui`。
- 让公共包读取 app 路由名、权限、租户、feature flag 或业务配置。

## 原则

- 状态越靠近使用处越好。
- 共享状态优先通过 provider 限定生命周期和可见范围。
- 共享状态必须有明确复用理由。
- 副作用边界要清晰。
- store 是更强的全局机制，使用前必须能说明 provider/inject 不适合的原因。
