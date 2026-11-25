# Documentation Sync

app 文档只维护模板和业务层通用约定，不要求每个小改动都写文档。

## 规则

- 改模板默认能力、目录结构、私有仓库初始化入口或开发方式时，同步 `README.md` 和 `.ai/public/app-usage.md`。
- 改页面、路由、URL 状态或导航 meta 约定时，同步 routing rule 或 app README。
- 改 `$api` / `$req` 创建方式、使用边界、多后端策略、分页或提示策略时，同步 `.ai/public/request-usage.md` 和相关 rule。
- 新增或修改环境变量时，同步 example 文件，并补充用途注释。
- 修改公共包 AI 文档同步命令、目录或安装行为时，同步 README、入口规则和 `.ai/public` 使用资料。
- 基于具体产品目标、数据新鲜度、交互策略、权限、路由或业务场景形成的使用决策与约束，写在本 app 的 README、`.ai/public` 或相关 rule；引用 UI 文档说明底层能力、公开契约和默认行为，不在 app 中重复维护公共包文档。
- 新增复杂 feature 时，可以在 feature 目录加轻量 README，说明入口、状态、请求和注意事项。
- 不强制每个业务页面都有 README。
- 局部样式、文案微调、内部实现细节或 bug 修复，没有改变使用方式时，不需要更新文档。

## Checks

- 模板初始化与使用方式变化是否同步 README 和 app-usage。
- 请求体系变化是否同步 request-usage。
- 环境变量变化是否同步 example。
- `docs/ngtui` / `docs/ngtui` 的同步方式是否与安装脚本一致。
- app 的具体使用决策和业务约束是否由本 app 文档承载，并正确引用公共包能力说明。
- 是否避免为普通页面小改动制造低价值文档。

## 规则权威与去重

- `AGENTS.md` 只维护阅读路由、规则清单及必要授权；目录、路由、状态、请求、页面与验证要求由对应专项文件承载。
- skill 引用专项规则并描述执行顺序，public 资料提供使用指导，README 提供概览，不复制同一主题的完整约束。
- 页面组合与状态清单统一维护在 `.ai/public/page-recipes.md`；新增页面范式时同步检查 add-page、update-page 与 app-usage 的入口是否有效。
- 精简入口时逐项核实原约束仍有权威来源，保留唯一的授权或边界要求。规则、工具配置和公开契约存在差异时先说明差异，不用复制文案掩盖冲突。
- 新增规则必须登记在本仓库 `AGENTS.md`；重命名同步修改引用。规则中的脚本命令以本仓库 `package.json` 为准，独立 Starter 不依赖父仓库脚本。
