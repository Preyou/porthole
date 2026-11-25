# Server Boundary

认证采用独立 Session/Bearer 内核，业务默认认证，公开路由显式声明。资源归属来自当前身份，修改实际资源前授权。API 用 Zod 声明输入和成功响应，由 OpenAPI 导出；业务响应为 {code,data,message}。PostgreSQL schema 位于 src/db/pg/schemas，迁移生成，不手改已执行历史。私有配置只在忽略的 .env.local。
