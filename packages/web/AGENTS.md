# Agent Rules For App Template

本仓库是可复制的 Web 应用模板，代表业务层 app 的默认结构和约定。

编辑本 app 前，先阅读本文件、目标文件和相邻实现。只要实现、修改、修复或评估某类功能，必须在分析或编码前读取本文件中对应的任务规则、public 资料或 skill；不要只凭记忆执行。

## How To Use This File

本文件是 app 规则路由入口，不是可选说明。处理仓库内任意路径时，先执行：

1. 判断任务类型：页面、路由、导航、表单、请求、状态、文案、环境变量、图标、主题、公共能力使用、文档、验证或页面调试。
2. 判断涉及路径：`src/**`、`.ai/**`、`env/**`、`README.md`、配置文件，或是否牵涉已安装的 `@ngt/ui` 公开契约。
3. 按 `App Rule Inventory` 扫描全量规则清单，并读取所有适用规则。命中多个规则时读取并集。
4. 代码或配置改动必须读取 `.ai/rules/11-code-authoring.md`；TypeScript 改动额外读取 `12-typescript-style.md`；复杂或持续增长的文件读取 `13-large-file-strategy.md`。
5. 阅读目标文件、相邻实现和必要 public 资料。
6. 如果实际影响面变化，回到第 1 步重新路由。

命中路由的规则文件必须在分析或编码前读取。没有完成对应路由前，不要编码、改文件或给出确定性实现结论。

本文件中的 `src/**`、`.ai/**`、`env/**`、`README.md` 默认都相对仓库根目录。需要理解公共能力时，先读取安装流程生成的 `docs/ngtui/manifest.json`，再按其中入口读取当前依赖版本提供的公开资料。

## App Boundary

本仓库是轻量应用模板。app 职责、模板范围见 `.ai/rules/10-app-role.md`；业务与公共包的边界见 `.ai/rules/20-business-boundary.md`。涉及页面或共享能力判断时必须读取这两份规则。

根源方案需要修改 UI 时，先核实当前依赖投影中的公开契约，说明上游方案、影响和兼容风险并请求授权；不得修改依赖安装目录或通过 app 补丁绕过授权。上游仓库独立验证并发布稳定轻量标签后，本 app 再将 UI 固定到共同的兼容标签。

## Task Reading Routes

以下路径相对本仓库，不依赖父 workspace：

| 关注点                    | 权威入口                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| 目录职责与组件层级        | 目录与组件结构                                                        |
| 路由、访问边界与 URL 状态 | `.ai/rules/40-routing.md`                                             |
| 状态作用域与 provider     | `.ai/rules/60-state-and-context.md`                                   |
| 页面组合与状态范式        | `.ai/rules/85-business-quality.md`，再读 `.ai/public/page-recipes.md` |
| 公共能力发现              | `.ai/public/shared-capability-usage.md`                               |
| 文档职责与规则去重        | `.ai/rules/86-documentation-sync.md`                                  |
| 验证范围与命令            | `.ai/rules/90-quality-gates.md`                                       |

- 页面新增、修改、还原及业务组件任务必须读取页面组合与公共能力发现资料；已有页面的局部小改只应用相关范式，不重做整页。
- 新增、重构或评估表单与可编辑字段前，必须读取 `.ai/skills/add-form/SKILL.md`。
- 开发任务在分析或编码前必须读取质量门禁；其他关注点按下表取并集，不以本表代替专项规则。

## App Rule Inventory

以下清单列出本 app 全部规则。每次 app 任务必须先扫描全表，再按适用场景读取规则；不要把未命中的规则理解为不存在。

| 规则文档                              | 说明                                               | 适用场景                                               |
| ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `.ai/rules/10-app-role.md`            | app 层职责、可承载内容和禁止越界内容               | 所有 app 任务、判断能力属于 app 还是公共包             |
| `.ai/rules/11-code-authoring.md`      | 代码编写、契约、样式、异步、配置和验证基线         | 所有代码或配置改动                                     |
| `.ai/rules/12-typescript-style.md`    | TypeScript、`any`、`enum`、断言和未使用参数规则    | TypeScript 代码改动或类型设计                          |
| `.ai/rules/13-large-file-strategy.md` | 大文件识别、拆分与 `max-lines` 放行规则            | 新增功能、复杂模块扩展或重构                           |
| `.ai/rules/20-business-boundary.md`   | 业务代码与 `@ngt/ui` 的边界                        | 公共能力使用、能力上提、跨包修改、避免 app 层重复补丁  |
| `.ai/rules/30-change-validation.md`   | 文档与验证                                         |
| `.ai/rules/30-module-anatomy.md`      | 页面、组件、feature、共享代码的目录组织            | 新增或修改页面、组件、模块、业务结构和文件放置         |
| `.ai/rules/40-routing.md`             | 路由、布局路由、route group、URL 状态和 route meta | 新增页面、修改路由、菜单、导航、面包屑、可恢复页面状态 |
| `.ai/rules/50-api-and-request.md`     | `$api` / `$req`、OpenAPI、请求接入边界和多后端策略 | 接入或修改 API、请求封装、接口类型、请求状态           |
| `.ai/rules/55-request-feedback.md`    | 请求 loading、toast、分页、表单错误和提示渠道      | 请求反馈、错误提示、分页列表、表单提交体验             |
| `.ai/rules/56-error-handling.md`      | app 层错误处理、异常传播和业务错误展示             | 请求错误、表单错误、状态错误、错误边界和失败恢复       |
| `.ai/rules/60-state-and-context.md`   | 页面状态、跨页面状态、上下文和副作用边界           | 状态管理、feature 状态、路由状态、业务上下文           |
| `.ai/rules/70-i18n-and-copy.md`       | app 文案、i18n key、双语同步和模板文案边界         | 新增或修改可见文案、按钮、提示、页面标题、业务 copy    |
| `.ai/rules/80-env-and-config.md`      | app 环境变量、公共默认配置和私有配置分层           | 新增或修改 env、配置读取、baseURL、开关和部署配置      |
| `.ai/rules/83-icon-usage.md`          | app 图标使用、动态图标和图标注册边界               | 页面、导航、按钮、菜单、route meta 或业务图标          |
| `.ai/rules/84-ui-implementation.md`   | app UI 实现、布局、主题 token、截图还原和复用判断  | 新增或修改页面、业务组件、截图/Figma/MasterGo 还原     |
| `.ai/rules/85-business-quality.md`    | 业务质量、重复结构检查、交互完整性和产品语义       | 新增功能、页面还原、业务流程、复杂交互或体验打磨       |
| `.ai/rules/86-documentation-sync.md`  | app README、public 资料、规则和使用说明同步        | 改模板能力、请求用法、路由、环境变量、文档或规则       |
| `.ai/rules/89-browser-debugging.md`   | 真实浏览器调试工具选择和使用边界                   | 页面、控制台、网络、DOM、样式或交互调试                |
| `.ai/rules/90-quality-gates.md`       | app 级格式化、类型检查、生成类型和验证策略         | 所有 app 代码、配置、文档或规则改动后的验证            |

使用模板：

- `.ai/public/app-usage.md`：给外部 AI 理解该 app 模板的入口说明。
- `.ai/public/request-usage.md`：业务层 `$api` / `$req` 使用索引。
- `.ai/public/shared-capability-usage.md`：业务侧使用 `@ngt/ui` 的发现、选择和导入规则。
- `.ai/public/global-helpers.md`：业务侧 `$i18n`、`$api`、`$req`、`$toast`、`$cn` 使用边界。

新增页面、修改页面、截图还原或编写业务组件时，`.ai/public/shared-capability-usage.md` 是必读资料；它负责把业务侧任务连接到 `@ngt/ui` 声明的 AI 资料。

只有功能描述、没有截图或设计稿时，仍按产品语义先判断路由位置、父布局、同级导航、模块归属、组件来源和状态边界；不要因为缺少截图就跳过路由设计、公共能力发现或 i18n 规则。

## Supplemental Materials

- `.ai/skills/add-page/SKILL.md`：新增页面。
- `.ai/skills/update-page/SKILL.md`：修改页面。
- `.ai/skills/add-form/SKILL.md`：新增、重构或评估表单与可编辑字段。
- `.ai/skills/add-api/SKILL.md`：新增或接入 API。
- `.ai/skills/update-env/SKILL.md`：新增或修改环境变量。
- `.ai/public/request-usage.md`：查询 `$api` / `$req` 详细用法。
