# Porthole

Porthole 把服务器上监听的 HTTP 或 HTTPS 服务分享为子域名链接。它自动发现 Linux 宿主机上 `50100–50999` 范围内的端口，可以为预览环境、内部工具和临时演示生成分享链接，并控制访客的访问条件。

- 按端口号筛选服务，创建分享时从可搜索的列表选择端口。服务名称默认用端口号，子域名可手填或随机生成。
- 为分享设置有效期、访客会话名额和访问密钥，可填写描述，或为 Vite 等开发服务指定上游 Host。
- 在桌面和移动端管理分享。记录支持搜索和过滤、复制链接、生成二维码、新标签打开、续期一小时、撤销和永久删除。
- 生产管理台使用 Logto 登录，每个账号管理自己的分享。收到 Logto 删除或禁用通知后，该账号的受保护请求返回 `401`。分组或角色变更使旧凭证失效，用户可以重新登录。

访客会话、访问密钥和上游转发的行为见 [产品说明](docs/porthole.md)。

## 本地开发

需要 Bun 1.4.2 或更新版本、Docker Compose，以及可通过 Git SSH 读取 Preyou 的前端依赖仓库。以下命令在本地开发副本的项目根目录执行。

### 安装依赖并配置开发环境

```sh
bun install --frozen-lockfile
bun run setup
chmod 600 packages/server/.env.local
COMPOSE_PROJECT_NAME=porthole-dev bun run infra:up
```

`setup` 安装前后端依赖，并从示例创建缺失的服务端配置。将以下值合并到本地的 `packages/server/.env.local`。连接串对应根目录 Compose 提供的开发 PostgreSQL 和 Redis。

```dotenv
NODE_ENV=development
AUTH_MODE=local
APP_ORIGIN=http://127.0.0.1:1282
API_PREFIX=/api
OPENAPI_URL=/openapi
PORT=3100
PORTHOLE_BIND_HOST=127.0.0.1
PORTHOLE_SHARE_DOMAIN=localhost
DATABASE_URL=postgresql://yuumi:yuumi@127.0.0.1:25432/yuumi
REDIS_URL=redis://127.0.0.1:26379/0
```

### 创建本地账号并启动

在 Bash 中执行以下命令。本地账号密码至少 12 个字符。

```bash
bun run db:migrate
IFS= read -rs -p '本地开发账号密码: ' porthole_dev_password
printf '\n'
printf '%s\n' "$porthole_dev_password" | bun run auth:user -- alice "Alice"
unset porthole_dev_password

DEV_WEB_HOST=127.0.0.1 DEV_WEB_PORT=1282 DEV_API_ORIGIN=http://127.0.0.1:3100 bun run dev
```

打开 `http://127.0.0.1:1282`，用 `alice` 登录。Vite 将同源 `/api` 请求转发给 Bun 后端。可访问 `/api/health` 检查连通性，`/api/openapi` 查看 API 文档。调试时保持浏览器入口、`APP_ORIGIN` 和 Vite 代理目标的主机名均为 `127.0.0.1`。

改端口时，同步更新相应的环境变量和连接串。若开发数据库端口已被占用，可通过 `POSTGRES_PORT` 和 `REDIS_PORT` 调整 Compose 的映射。结束时按 Ctrl+C，再执行 `COMPOSE_PROJECT_NAME=porthole-dev bun run infra:down` 停止开发数据库。

要调试 Logto，把 `AUTH_MODE` 改为 `logto` 并填入开发应用配置。在 Logto 登记 `http://127.0.0.1:1282/api/auth/callback/logto` 和退出后回到的 `http://127.0.0.1:1282`。完整变量见 [服务端配置说明](packages/server/docs/env-rules.md)。

### 检查和构建

```sh
bun run check
bun run build
```

API 契约有变更时运行 `bun run generate:web`，更新前端 OpenAPI 定义和请求类型。`bun run build` 的前端产物在 `packages/web/dist`。

验证端口发现、访客密钥、额度和实际转发时，使用 Linux 和隔离的 PostgreSQL、Redis。先执行 `bun run db:migrate`，再从项目根目录运行集成测试。以下 Logto 参数用于启用测试会话，测试使用受控的身份服务和会话数据。

```sh
NODE_ENV=test AUTH_MODE=logto \
LOGTO_ENDPOINT=http://127.0.0.1:23001 LOGTO_APP_ID=integration-test \
LOGTO_APP_SECRET=integration-test LOGTO_API_RESOURCE=https://api.example.test \
LOGTO_API_SCOPE=api LOGTO_WEBHOOK_SIGNING_KEY='' LOGTO_ROLE_CHANGE_DATABASE='' \
bun run --cwd packages/server test:integration
```

开发命令启动管理台和同源 API。用分享子域名做端到端验证时，按部署手册配置域名和代理。

## 生产部署

当前部署在 `/mnt/vdb1/code/porthole`，由 1Panel 管理同一个 Compose 编排 `porthole-rewrite`。编排包含提供静态前端的 Web 容器（`127.0.0.1:18084`）和以生产模式运行的 Bun API 容器（`127.0.0.1:18085`）。两者使用 Linux 宿主网络，管理台通过同源入口访问 API。

1. 准备 Porthole 专用 PostgreSQL 数据库和 Redis 逻辑库。配置 Logto 的传统网页应用、API 资源和账号变更 Webhook。
2. 从项目根目录执行 `bun install --frozen-lockfile` 和 `bun run setup`。在 `packages/server/.env.local` 填写生产配置，执行 `chmod 600 packages/server/.env.local`。数据库及 Redis 连接串、Logto 应用密钥和 Webhook 签名密钥由 Compose 注入 API 容器。
3. 构建前端和容器镜像，再运行数据库迁移。

   ```sh
   bun run build
   docker compose -f deploy/1panel/docker-compose.yml build api web
   docker compose -f deploy/1panel/docker-compose.yml run --rm --no-deps -T api bun run db:migrate
   ```

4. 在 1Panel 的「容器 → 编排」导入并启动 `deploy/1panel/docker-compose.yml`。已有编排升级时，在迁移完成后重建容器。
5. 将管理域名 `dev.preyou.site` 和分享通配域名 `*.dev.preyou.site` 交给现有 HTTPS 代理，将请求转发到 `http://127.0.0.1:18084` 并保留原始 Host。配置对应的 DNS 和 TLS。
6. 检查管理页面和健康接口，试用 Logto 登录，并在 Logto 控制台发送 Webhook 测试通知。

   ```sh
   curl -fsS https://dev.preyou.site/api/health
   curl -fsS https://dev.preyou.site/api/auth/config
   ```

[1Panel 部署手册](deploy/1panel/README.md) 包含完整的变量表、Logto 回调和 Webhook 地址、自托管 Logto 的角色变更同步以及升级命令。

## 项目目录

| 目录 | 内容 |
| --- | --- |
| [`packages/web`](packages/web/) | Vue 3、Vite 和 NGT UI 管理台 |
| [`packages/server`](packages/server/) | Bun、Elysia、Drizzle、认证、端口发现和分享网关 |
| [`deploy/1panel`](deploy/1panel/) | 生产 Compose、镜像构建和 Nginx 配置 |
| [`docs`](docs/) | 产品说明、详细设计和实施文档 |

- [详细设计索引](docs/detailed-design/INDEX.md)
- [实施文档索引](docs/implementation/INDEX.md)
