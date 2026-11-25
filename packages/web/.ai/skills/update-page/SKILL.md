# 修改页面

当需要修改 app 路由页或其对应 feature/component 时使用这个技能。

## 流程

1. 读取 `AGENTS.md`。
2. 读取页面相关规则：`40-routing.md`、`60-state-and-context.md`、`70-i18n-and-copy.md`、`84-ui-implementation.md`、`85-business-quality.md`，再读取 `.ai/public/page-recipes.md` 选择页面范式，并确认其操作位置与状态清单。
3. 如果来自截图、Figma、MasterGo 或设计稿，先按 `84-ui-implementation.md` 做 Scope Check，区分 Local Page Restore 或 Small Patch；必要时升级为 Full Restore。
4. 先判断改动是局部页面需求，还是系统性能力。
5. 影响面广或方案不确定时，询问用户是局部处理还是系统性解决。
6. 阅读目标页面、父路由、同级页面和相邻组件，确认当前功能在现有路由、feature、组件体系中的归属。
7. 新增功能或组件时，优先参考临近页面和临近功能，保持风格一致。
8. 按 routing rule 判断新增状态是否应进入 URL。
9. 如果新增或修改登录态访问要求，优先判断规则应落在认证区父路由还是登录后业务区父路由；不要因为模板存在 `home.vue` 就默认它已经承载鉴权。
10. 如果新增或修改页面访问要求，优先在路由页或父布局路由声明权限 meta、页面级守卫、进入条件或重定向规则。
11. 不把 `definePage()` 当作路由页标记；没有自定义路由配置需求时保持文件路由默认值，已有调用不再必要时应删除。
12. 如果修改路由页，保留简单页面布局和 URL 状态桥接，不要把它退化成单个功能组件引用，也不要塞入大量业务逻辑。
13. 简单局部状态可以直接留在路由页；拆出的状态放在对应 feature，跨页面业务状态放 app 层。
14. 写具体组件前，按当前业务库、`@ngt/ui`、自封装的顺序查找或设计组件。
15. 可复用且领域中立的能力考虑上提到 `@ngt/ui`。
16. 新增文案同步 `src/locales`。
17. 完成修改初稿后，做一次轻量重复结构检查：
    - 只检查当前修改路由页、对应 feature/component 中的组件、相邻页面和同批设计稿状态。
    - 最多列出 3 类明显重复结构。
    - 同一结构骨架或交互语义出现 2 次以上时，按复用范围抽到对应页面 feature、feature/app 共享目录或 `src/components`，或在获得授权后考虑 `@ngt/ui`。
    - 页面内保留数据数组和 `v-for`，子组件承载重复结构。
18. 按 `86-documentation-sync.md` 判断是否需要同步文档。
19. 按 `90-quality-gates.md` 运行最小必要验证。

## 规则

- 优先从根源修复问题。
- `src/views` 只能放真实路由页面；非路由组件、状态、工具和测试必须移到 `src/features`、`src/components` 或其他对应目录。
- 不在多个页面机械打补丁。
- 不手改生成物。
- URL 状态、敏感字段和编码策略以 `40-routing.md` 为准。
