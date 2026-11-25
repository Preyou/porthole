# Porthole 的 1Panel 部署

1Panel 编排名为 `porthole-rewrite`。Web 入口是 `127.0.0.1:18084`，API 监听 `127.0.0.1:18085`。两个容器使用 Linux 宿主网络，因此 API 可以发现本机监听端口并访问本机 PostgreSQL 和 Redis。

## 配置 PostgreSQL、Redis 和 Logto

1. 在现有 PostgreSQL 上为 Porthole 准备数据库和账号，建议库名 `porthole_rewrite`。在现有 Redis 上分配独立的逻辑库编号。
2. 在 `https://auth.preyou.site` 对应的 Logto Console 创建 Porthole 的「传统网页应用」和 API 资源。

   | Logto 设置 | 值 |
   | --- | --- |
   | 重定向 URI | `https://dev.preyou.site/api/auth/callback/logto` |
   | 退出后重定向 URI | `https://dev.preyou.site` |
   | API Identifier | 新建 API 资源的标识符 |
   | API scope | `api` |

3. 在 Logto Console 的 Webhooks 新建 `Porthole Account Revocation`，接收地址填 `https://dev.preyou.site/api/auth/webhook/logto`，事件选择 `User.Deleted`、`User.SuspensionStatus.Updated` 和 `Organization.Membership.Updated`。保存生成的签名密钥，并在 API 完成迁移与启动后使用 Logto 的测试投递验证。

4. 同实例的 Logto OSS 可以接入角色和组织关系变更。请用数据库管理员在 Logto 数据库执行下方 SQL，替换示例库名及 Porthole 数据库账号。

   ```sh
   psql -d logto_db -v porthole_db_user=porthole_rewrite -f deploy/1panel/logto-role-changes.sql
   ```

5. 编辑 `packages/server/.env.local` 并保持文件权限为 `600`。连接串中的用户名或密码若包含 URL 保留字符，先对相应部分做 URL 编码。

   | 变量 | 值 |
   | --- | --- |
   | `AUTH_MODE` | `logto` |
   | `APP_ORIGIN` | `https://dev.preyou.site` |
   | `DATABASE_URL` | `postgresql://<用户>:<密码>@127.0.0.1:15432/<数据库>` |
   | `REDIS_URL` | `redis://:<密码>@127.0.0.1:6379/<逻辑库编号>` |
   | `LOGTO_ENDPOINT` | `https://auth.preyou.site` |
   | `LOGTO_APP_ID` | Porthole Logto 应用 ID |
   | `LOGTO_APP_SECRET` | Porthole Logto 应用密钥 |
   | `LOGTO_API_RESOURCE` | Porthole API Identifier |
   | `LOGTO_API_SCOPE` | `api` |
   | `LOGTO_WEBHOOK_SIGNING_KEY` | Logto Webhook 签名密钥 |
   | `LOGTO_ROLE_CHANGE_DATABASE` | 可选，安装关系变更记录的 Logto 数据库名 |

   后台每 5 秒读取一次角色和组织关系变更。受保护接口的账号状态校验只读 Porthole 数据库。

   若分设迁移和应用账号，在 `MIGRATION_DATABASE_URL` 填写同一专用数据库的迁移连接串。

## 构建并导入 1Panel

首次安装在服务器的 Porthole 项目根目录执行 `bun install --frozen-lockfile` 和 `bun run setup`，再按上节完成生产配置。编排的构建路径以 `/mnt/vdb1/code/porthole` 为准。构建和迁移使用以下命令。

```sh
cd /mnt/vdb1/code/porthole
bun run build
docker compose -f deploy/1panel/docker-compose.yml build
docker compose -f deploy/1panel/docker-compose.yml run --rm --no-deps api bun run db:migrate
```

在 1Panel 的「容器 → 编排」中从路径创建编排，选择 `/mnt/vdb1/code/porthole/deploy/1panel/docker-compose.yml`。启动后，在宿主机使用管理域名的 Host 检查页面和 API。

```sh
curl -fsS -H 'Host: dev.preyou.site' http://127.0.0.1:18084/api/health
curl -fsS -H 'Host: dev.preyou.site' http://127.0.0.1:18084/api/auth/config
```

需要在隔离验证中替换端口或域名时，可以向 Compose 提供 `PORTHOLE_API_PORT`、`PORTHOLE_WEB_PORT`、`PORTHOLE_MANAGEMENT_HOST` 和 `PORTHOLE_SHARE_DOMAIN`。管理域名与 `APP_ORIGIN` 的主机名须一致。

## 切换现有域名入口

确认本机健康接口可用，且 `/api/auth/config` 返回已配置的 Logto 模式后，将 `dev.preyou.site` 和 `*.dev.preyou.site` 各自现有的 OpenResty 上游切到 `http://127.0.0.1:18084`。OpenResty 继续负责 DNS 对应域名上的 HTTPS 响应，向 Porthole 转发原始 Host，并用实际协议和可信客户端地址写入 `X-Forwarded-Proto` 与 `X-Real-IP`。管理站点提供页面和同源 API，通配域名的所有请求路径由分享网关处理。

能通过 Porthole 的 Logto 应用登录的账号都可以发现端口并管理自己的分享。直接使用 Bearer 调用 API 时，令牌需包含对应 API Resource 和 `api` scope。验证管理台登录与退出，再核对目标端口、访问限制和撤销。Porthole 成功接收 Logto 删除通知后，该账号的下一次受保护 API 请求返回 `401`。

## 升级现有部署

已启用 Logto 的部署应先添加删除通知并设置 `LOGTO_WEBHOOK_SIGNING_KEY`。从原账号查询方案迁移时，可在切换期间将已删除的本地身份补录到撤销表。

更新服务器工作区的源码。如果依赖或锁文件有变化，先重新执行根目录的 `bun install --frozen-lockfile` 和 `bun run setup`。按构建前端、构建镜像、迁移数据库、重建容器的顺序执行。迁移由新镜像运行，完成后再启动新 API。

```sh
cd /mnt/vdb1/code/porthole
bun run build
docker compose -f deploy/1panel/docker-compose.yml build api web
docker compose -f deploy/1panel/docker-compose.yml run --rm --no-deps api bun run db:migrate
```

迁移成功后，在 1Panel 重建 `porthole-rewrite`，或在终端操作同一个编排。

```sh
docker compose -f deploy/1panel/docker-compose.yml up -d --no-build --force-recreate --wait api web
docker compose -f deploy/1panel/docker-compose.yml ps
curl -fsS -H 'Host: dev.preyou.site' http://127.0.0.1:18084/api/health
```

检查两个容器处于运行状态，健康接口返回 `data.status=ok`。
