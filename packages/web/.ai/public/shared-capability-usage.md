# Shared Capability Usage

本文档面向 Starter 和复制后的业务 app，说明如何按功能发现、选择和使用统一的 `@ngt/ui`。

## 适用场景

新增页面、修改页面、截图还原、编写业务组件，或添加表单、表格、菜单、弹窗、图标、主题、请求状态及通用交互时，必须先走本文档。

只修改业务逻辑、接口参数映射、文案或局部状态，且不新增 UI 结构时，可以只读取对应业务规则。

## 发现流程

1. 先看目标页面、相邻页面和 app 内已有共享组件，确认是否已有业务语义一致的实现。列表、详情、新建/编辑和设置页面同时读取[页面组合使用指导](./page-recipes.md)。
2. 读取一次 `docs/ngtui/manifest.json`，沿其中声明的 summary、discovery 和 usage 入口，按功能查找组件、domain、composable 或工具。
3. 对命中的候选模块读取其 README，确认 props、emits、slots、状态 owner、生命周期和错误契约；签名以当前依赖版本的公开 TypeScript 声明和 package exports 为准。
4. 区分同功能组件的组合部件与不同语义的能力：例如 Form 和 SchemaForm、Calendar 和 DatePicker、Table 和 DataTable、InputGroup 和 PromptInput 分别解决不同任务。依据业务任务选择适合的功能模块。
5. 直接使用或组合已经满足需求的公开能力。未命中时，再判断缺少的是公共能力，还是绑定当前产品的业务结构。

不凭记忆猜测组件存在与否，不进入 `node_modules` 或包内部源码代替公开能力发现。

## 选择规则

- 优先复用业务语义相同的相邻实现；业务语义相同但样式或布局不同，应先考虑抽 app 层业务组件。
- 当前页面、相邻页面、同一 feature 或同批设计稿状态中出现 2 次以上的同类结构，应按复用范围封装，避免复制同类 DOM。
- 控件、消息、附件、表格、schema 表单、图标、语言选择和其他组件，均按功能从 `@ngt/ui/<功能名>` 选择；请求、主题等机制从对应 domain 或 composable 选择。
- 下拉选择默认使用 `@ngt/ui/select`。选项数组可直接交给 Select 的 options 便捷模式；需要搜索时使用 Combobox。只有明确需要浏览器原生选择行为时才使用 NativeSelect。
- 同一组件族的根与可组合部件从同一模块导入。Message、CodeBlock、Attachment、Collapsible、NumberField 和 Select 使用统一的根与契约，不在 app 中再包装另一套同名实现。
- 具体接口语义、权限、租户、产品文案、业务流程和一次性页面结构留在 app 层，不进入公共包。
- 只有文字自身承担独立排版层级时，才使用 `@ngt/ui/text` 的 Text。Button、Badge、菜单项、下拉选项、Tabs Trigger、导航项和 Label 等已管理排版的组件直接接收文字。

自行封装前，明确布局、可替换内容、props、slots、events、内部状态、父组件控制边界及数据如何传入。已有组件的简单组合没有稳定复用边界时，可留在页面或父组件中。

重复结构按复用范围落位：

1. 只在当前页面复用且带业务语义：对应的 `src/features` 页面或 feature 目录。
2. 同一 feature、同一路由分组或相邻页面复用：feature 或 app 内共享目录。
3. 跨 feature 复用且不带具体业务功能的小组件：`src/components`。
4. 跨 app 且领域中立的组件、变体或机制：候选归属是 `@ngt/ui`，先说明影响范围并核对当前任务授权。

`src/views` 只存放真实路由页面，不属于组件复用层级。父组件文件与同名子目录的组织规则适用于 `src/features`，以及确需多级拆分的 `src/components`。

## 公开入口

- app 只从 package exports 导入，例如 `@ngt/ui/button`、`@ngt/ui/icon`、`@ngt/ui/message`、`@ngt/ui/attachment`、`@ngt/ui/schema-form`。
- 通用机制使用 `@ngt/ui/domains/theme`、`@ngt/ui/domains/request`、`@ngt/ui/composables/use-promise-fn`、`@ngt/ui/utils` 等公开入口。
- 禁止从 `packages/*/src/**`、`node_modules/@ngt/ui/src/**` 或其他内部路径导入公共包实现。
- 文档投影通过 `bun run sync:ngt-docs` 刷新，再运行 `bun run check:ngt-docs`；投影目录不能手工修改。

## 能力缺失时

- 绑定产品接口、权限、文案或流程：在 app 对应 feature 中实现；简单且无需拆分的内容可以直接留在路由页。
- 属于领域中立的组件、变体或通用机制：说明公共库方案、影响范围、公开 API 变化及应用侧重复实现的代价，核对已有授权，再按公共库自己的文档和验证流程修改。
- 公共库独立验证并发布稳定预构建产物后，Starter 更新固定依赖和文档投影，再完成本 app 检查与构建；同步采用当前版本的唯一组件契约。

不要在 app 层复制本应属于公共库的根源能力。

## 实现约束

- 页面和组件只消费主题 token、组件 variant 和合法 Tailwind class，不写硬编码颜色或独立主题。
- 不用字号、字重、行高和字距工具类重新实现 Text 已有的独立文字层级；全局分级通过公开的 `--typography-*` CSS 变量调整。
- 不因模板节点包含文字就使用 Text；所属组件移除后文字仍需明确 variant 时才使用它。
- 截图只用于识别结构、层级、组件语义、状态和重复结构，不复制具体主题风格。
- 原生标签可以表达布局语义；手写已有公共组件能表达的控件或交互前，说明公开能力不能满足的具体原因并核对任务授权。
