# Yuumi Server

Bun、Elysia、PostgreSQL/Drizzle、Redis 服务端模板，包含认证授权、当前用户、私有待办 CRUD、OpenAPI、统一结果码和双语资源。

```bash
bun install
cp .env.example .env.local
# 编辑 .env.local，填写本项目的库名、Redis 逻辑库、密码及需要的认证配置
bun run db:migrate
bun run dev
```

默认 env 的注释已记录当前服务器 PostgreSQL（127.0.0.1:15432，用户名 porthole_db_user）和 Redis（127.0.0.1:6379）。库名、逻辑库编号、连接串和密钥留空，须按 [环境配置](./docs/env-rules.md) 为新项目填写；模板不创建或复用现有业务库。

`AUTH_MODE` 选择 `off`、`logto` 或 `local`。修改后重启。公开的 `GET /api/auth/config` 返回当前模式和配置状态，业务路由仍按自身授权规则执行。

- `off` 停用登录入口。既有私有接口继续要求身份。
- `logto` 使用项目的 Logto Traditional Web 应用与 API Resource。回调为 `APP_ORIGIN + API_PREFIX + /auth/callback/logto`。配置齐备后可用登录和 Bearer，Logto 身份仍可用 `POST /api/auth/provision` 显式建档。
- `local` 用管理员创建的账号登录。密码从标准输入读取，密码长度为 12–256 字符。两种登录方式使用相同的 HttpOnly Cookie 和当前用户接口。

管理员建号示例（Bash）：

```bash
read -rs -p "Password: " yuumi_account_password
printf '\n'
printf '%s\n' "$yuumi_account_password" | bun run auth:user -- alice "Alice"
unset yuumi_account_password
```

开发端口默认 `3100`。公开健康入口是 `/api/health`，OpenAPI 文档和 JSON 分别是 `/api/openapi` 与 `/api/openapi/json`。

待办接口 GET/POST /api/todos、PATCH/DELETE /api/todos/:id，只能操作本人资源。统一响应 {code,data,message}，message 用于诊断，用户提示通过 /api/i18n/zh-CN 或 en-US 加载。

```bash
bun run check
bun run test:integration
bun run openapi:export -- ./openapi.json
```

普通 check 运行不依赖外部数据库的单元测试。集成测试使用项目隔离的 PostgreSQL/Redis 和受控 OIDC 服务，不会访问真实 Logto。参考根联合模板 compose 或使用同等隔离实例。生产环境自行配置凭据和持久化策略。

- [设计](./docs/detailed-design/INDEX.md)
- [实施](./docs/implementation/INDEX.md)
