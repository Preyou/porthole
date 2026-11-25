---
name: add-form
description: 在采用 ngtui 架构的业务 app 中新增、重构或评估表单与可编辑字段，并在 @ngt/ui 展示能力、standalone SchemaField、AutoForm 和 createSchemaForm 之间选择。添加输入项、条件编辑、字段校验、统一提交、取消、重置、请求状态或后端字段错误时使用。
---

# 在 ngtui app 中编写表单

先判断内容是否需要表单能力，再按编辑关系和提交单元选择 `@ngt/ui` 的公开组件。

## 读取资料

1. 读取当前 app 的 `AGENTS.md` 和 `.ai/public/shared-capability-usage.md`。
2. 读取 `docs/ngtui/manifest.json`，再按 discovery 和 usage 入口读取投影内的 schema-form 模块 README。
3. 读取 app 的 `.ai/rules/60-state-and-context.md`、`70-i18n-and-copy.md`、`84-ui-implementation.md`、`85-business-quality.md` 和 `90-quality-gates.md`。
4. 涉及接口提交或后端错误时，再读取 `.ai/rules/50-api-and-request.md`、`55-request-feedback.md`、`56-error-handling.md` 和 `.ai/public/request-usage.md`。
5. 需要其他展示或输入控件时，沿第 2 步已读取 manifest 的 summary、discovery 和 usage 查找对应功能模块，不重复按来源分类检索。

只从公开 package exports 导入。Schema Form 从 `@ngt/ui/schema-form` 导入，其他组件从 `@ngt/ui/<功能名>` 导入，同族根与部件使用同一入口。

## 选择展示或表单能力

按以下顺序判断：

1. **硬编码静态内容**
   - 内容固定在代码中，不读取运行时数据，也没有当前或条件触发的编辑、校验、提交和持久化。
   - 不建立 Zod schema 或表单状态，不使用 `SchemaField`、`AutoForm`、`createSchemaForm` 等 Schema Form 能力。
   - 按产品语义使用展示组件；需要统一字段式排版时可以使用 `@ngt/ui/field`。
2. **数据驱动但始终只读**
   - 可以使用展示组件，也可以为了统一视觉、字段排版或状态表达，把数据绑定到 readonly/disabled 的 `SchemaField` 或 Schema Form 组件。
   - 不要因为复用了表单组件，就额外虚构不存在的编辑入口、校验流程或提交行为。
3. **存在条件编辑**
   - 不得因为默认态只读、当前权限不足、编辑入口隐藏或控件暂时 disabled，就归为硬编码静态内容。
   - 按真实编辑态继续判断字段关系。
   - 根据切换体验决定分支渲染展示组件与 `SchemaField`，或由同一 `SchemaField` 切换 readonly/disabled；按实际情况选择。

“纯静态”只表示硬编码且没有编辑能力，不等于默认只读、条件只读或暂时不可编辑。

## 选择 SchemaField 或 Schema Form

### 编辑项相互独立

满足以下特征时，分别使用 standalone `SchemaField`：

- 各字段独立进入和退出编辑态。
- 各字段独立校验、保存、取消和展示错误。
- 一个字段的提交、重置或失败不应影响其他字段。
- 字段之间没有跨字段约束、条件联动或原子保存要求。

使用 `v-model` 维护独立值，并按需配置 `schema`、label、description、placeholder、readonly、disabled 和校验时机。多个独立字段需要共享稳定 matcher 时，可以使用 standalone 模式的 `createSchemaField(matchers)`；不要因此包装成整张表单。

### 编辑项构成同一提交单元

命中以下任一情况时，使用 Schema Form：

- 多个字段共享提交、取消或重置。
- 存在跨字段校验或条件联动。
- 需要统一提交状态、表单级错误或脏状态判断。
- 需要原子保存或原子回滚。
- 后端按同一业务对象返回多个字段错误。

默认 matcher 足够时使用 `AutoForm`；需要稳定的自定义 matcher 时使用 `createSchemaForm(matchers)`。需要调整单个字段的标签、说明、占位内容或控件组合时，优先使用具名字段 slot 和 `SchemaField v-bind="field"`，不要重写整套表单绑定。

form-controlled `SchemaField` 由 form context 和 `name` 管理，不再传入 `modelValue` 或 `defaultValue`，避免双状态源。

## 建立 Zod 契约

1. 优先复用 OpenAPI 生成或业务边界已有的 Zod schema；app 特有字段在 app 层扩展。
2. 把类型、必填、范围、格式和跨字段约束放入 schema、控件或数据进入边界，不在多个层级重复维护同一规则。
3. 让 Zod issue message 成为前端字段校验文案的事实来源；Schema Form 会直接展示 `issue.message`，不要在 `SchemaField` 或提交处理里重复生成同一条校验文案。
4. 通用类型、必填、格式和范围错误使用 app 已配置的 `z.config(z.locales.*())` 本地化消息，并随当前 locale 切换。
5. 具体业务规则的校验文案在 app schema 中通过 `{ error: t('...') }` 等 Zod API 提供；需要随语言切换时，把 schema 声明为 `computed` 或使用等价响应式方案。
6. label、description、placeholder 和操作提示不是校验 issue message，继续由 app locale 和组件 props/slots 提供。
7. 后端字段错误不是 Zod 本地校验文案；由 app 层映射到对应表单字段错误，不反向写入 schema。
8. 使用 `z.input` 表达编辑态输入，使用 `z.output` 表达校验和转换后的提交值。
9. 明确 initial values、已提交值和编辑草稿；使用类型约束保证字段名和值与 schema 一致。
10. 信任已经建立的 schema 和 TypeScript 契约；外部契约不可靠时只在 API 接入边界集中适配。

## 状态、文案与请求

1. 页面或组件局部编辑状态优先使用 `ref` / `computed`；同一 feature 或父布局共享时优先使用 typed provider/inject，不默认创建 store。
2. 明确进入编辑、取消、清空、重置、提交成功和提交失败后的值变化：
   - 取消恢复进入编辑前的已提交值。
   - 重置恢复约定的初始值或默认值。
   - 清空只移除当前字段值。
3. app 产品文案进入 `src/locales`；Schema Form 标签可以使用显式 label 或 `labelI18nPrefix`，不要把业务文案写入 `@ngt/ui`。
4. Vue 组件中的真实提交优先使用 `$req` 管理 loading、error 和重试；具体接口语义、权限、持久化和业务错误解释留在 app 层。
5. 字段校验错误和后端字段错误靠近字段展示，不使用全局 `$toast`；无法局部表达的失败再进入表单级或全局反馈。
6. 提交期间防止重复提交；同一个结果只使用一个主要反馈渠道，不吞掉异常或把失败改写成成功。

## 公共能力边界

- 现有 Schema Form 能力满足需求时直接组合使用，不在 app 层复制绑定、校验或 matcher 基础设施。
- 缺少领域中立的组件、variant、size、state、props、事件或跨 app 表单能力时，按所属功能考虑补到 `@ngt/ui`。
- 涉及产品字段、接口、权限、业务流程或一次性页面结构时，留在 app 层。
- 判断需要修改 `@ngt/ui` 时，先说明独立的上游方案和影响；公共库独立验证并发布稳定预构建产物后，再更新本仓库固定依赖和文档投影。

## 验证

根据风险覆盖以下行为：

1. Zod schema 的有效值、无效值、边界值和转换结果。
2. standalone `SchemaField` 之间不会互相提交、重置、污染值或覆盖错误。
3. Schema Form 的有效提交、`invalidSubmit`、跨字段约束和重置。
4. 条件编辑切换时的数据保留、取消和权限变化。
5. 后端字段错误映射、提交失败和重复提交防护。
6. 按 `.ai/rules/90-quality-gates.md` 运行变更文件的最小必要 ESLint、类型检查和针对性测试。

## 禁止

- 不为硬编码展示内容建立 Schema Form 状态。
- 不把互不相关的编辑项包装成同一张 Schema Form。
- 不用多个 standalone `SchemaField` 模拟存在跨字段约束的统一表单。
- 不把 readonly 或 disabled 当作“纯静态”的判断依据。
- 不从 `node_modules/@ngt/ui/src/**` 导入内部实现。
- 不吞掉校验错误、提交异常或后端字段错误。
