# 环境配置

复制 `.env.example` 为忽略的 `.env.local`，由 Bun 加载。运行时代码统一通过 `src/env.ts` 的冻结配置读取 import.meta.env；错误配置启动时显式失败，不继续伪造可用状态。

必需配置为 NODE_ENV、API_PREFIX、APP_ORIGIN、DATABASE_URL、REDIS_URL、PORT、OPENAPI_URL。登录配置按认证模式提供。具体说明以 `.env.example` 为准。

HTTP 文档入口由 `API_PREFIX + OPENAPI_URL` 组成，默认 `/api/openapi`。接口 JSON 位于该入口加 `/json`。浏览器回调由 APP_ORIGIN、API_PREFIX 和 `/auth/callback/logto` 组成。数据库只使用 PostgreSQL；生产迁移可单独配置 MIGRATION_DATABASE_URL。真实密钥、连接凭据与 Cookie 不进入版本控制或日志。

## 当前服务器与项目隔离

`.env.example` 的注释记录 PostgreSQL `127.0.0.1:15432`、用户名 `porthole_db_user`，以及 Redis `127.0.0.1:6379`。密码、数据库名和 Redis 逻辑库编号由每个新项目自行填写，示例不指定现有业务库，也不创建数据库。

`DATABASE_URL` 和 `REDIS_URL` 默认整体为空；不要仅删除 PostgreSQL URL 的库名后保留连接串，否则驱动可能选择默认数据库。填好独立数据库名、Redis 逻辑库和密码后再设置完整连接串。Logto 配置同样留空，使用托管登录前填写。

已有 `.env.local` 不会被模板更新覆盖，需由维护者显式调整。联合模板提供的隔离 Compose 使用另一组本地端口，连接方法以其 README 为准。

可选 `HOST` 指定监听主机，缺省采用 Bun 的监听默认值。联合本地开发显式设置 `127.0.0.1`。

## 认证模式

公开配置 AUTH_MODE 取 off、logto、local。示例选 off，历史配置省略该变量时沿用 logto。修改后重启服务。选择 logto 时，LOGTO_ENDPOINT、LOGTO_APP_ID、LOGTO_APP_SECRET、LOGTO_API_RESOURCE 齐备后才可登录。生产 Logto 认证还必填 LOGTO_WEBHOOK_SIGNING_KEY，填入 Logto 的 Webhook 签名密钥。LOGTO_ROLE_CHANGE_DATABASE 可配置同实例的 Logto 数据库名，让后台读取角色和组织关系变更。接收地址为 APP_ORIGIN、API_PREFIX 与 /auth/webhook/logto 拼接。选择 local 时通过 auth:user 创建账号，使用项目自己的登录页。关闭认证时受保护接口仍需要身份，匿名访问策略由业务项目实现。

## Porthole 访问与绑定

`PORTHOLE_OWNER_ID` 使用登录后 `GET /api/users/me` 返回的本地 `data.id`。管理路由在该值缺失时拒绝授权。生产保持 `PORTHOLE_BIND_HOST=127.0.0.1`，入口网关转发并保留原始 Host。`PORTHOLE_SHARE_DOMAIN` 是受代理和证书覆盖的分享域后缀。生产缺省为 `dev.preyou.site`，开发缺省沿用 `APP_ORIGIN` 的主机名。
