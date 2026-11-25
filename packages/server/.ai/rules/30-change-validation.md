# 验证

先更新有效设计与实施文档再编码。修改后只格式化变更文件：`bunx --bun eslint <文件路径...> --fix`。提交前 `bun run check`；认证与数据改动还运行 `bun run test:integration`。schema 变化运行 `bun run db:generate`，在隔离数据库 `bun run db:migrate` 后验证。接口变化导出 OpenAPI，由消费端生成，不手改生成类型。
