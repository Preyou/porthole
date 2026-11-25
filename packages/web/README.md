# Porthole Web

Vue 3、Vite 和 NGT UI 构建的 Porthole 管理端。

安装前确保可访问 Preyou 私有仓库。本机 Bun 1.4.2 的干净安装验证使用环境变量 `GITHUB_TOKEN`（具备依赖仓库读取权限）；Token 仅通过进程环境提供，不写入仓库。Git 克隆使用已配置的 SSH。

```bash
bun install --frozen-lockfile
bun run generate
bun run dev
```

依赖由提交的 `bun.lock` 固定。项目显示名在公开的 `env/.env` 中配置，欢迎页页眉和浏览器标题读取同一值。

欢迎页独立运行。进入 `/app/shares` 需要匹配的 Yuumi Server。前端通过同源 `/api/auth/config` 获取后端认证状态。进入分享管理需要有效会话。Logto 已配置时交给托管页面，待配置时给出提示。本地认证使用项目内的用户名和密码表单。两种登录方式共用后端会话、当前用户和退出接口。

管理页每 30 秒刷新监听端口和分享记录，并在标签页隐藏时暂停轮询。操作后重新获取分享记录。访问密钥在创建或更换时显示，二维码在浏览器内生成，只包含分享链接。

## 后端代理

浏览器默认请求同源 `/api`。`bun run dev` 由 Vite 代理，默认前端地址为 `http://localhost:1282`，后端目标为 `http://127.0.0.1:3100`。后端独立运行时，把 `API_ORIGIN` 设为前端所在机器能访问的 HTTP(S) 地址，例如 `API_ORIGIN=http://backend.internal:3100 bun run dev`。停止开发服务器后，可以运行 `bun run preview`，用相同地址和代理预览本地构建。

正式运行时，在前端主机安装 Caddy 2，执行 `bun run build` 后运行 `bun run start`。自带 `Caddyfile` 在同一入口提供 `dist` 和 `/api`。本机默认入口仍为 `http://localhost:1282`。部署时可以像下面这样设置公开站点和内网后端。

```sh
WEB_SITE=app.example.com API_ORIGIN=http://backend.internal:3100 bun run start
```

服务端 `APP_ORIGIN` 使用浏览器实际访问的地址，例如 `https://app.example.com`。启用 Logto 时，登录回调使用该地址下的 `/api/auth/callback/logto`，退出回跳使用同一应用地址。已有站点网关也可以复用 `Caddyfile` 的路由约定，由该网关提供静态文件和同源代理。

接口类型从 src/api/openapi.json 生成；联合模板通过 Server 导出更新该输入。不要手改 src/api/auto 或 types/auto。

```bash
bun run check
bun run build
```

@ngt/ui 固定个人仓库稳定产物版本；安装后导出使用文档到 docs/ngtui。可选评审构建使用个人 annotation 插件，普通构建不启用标注运行时；项目可以在 `env/.env.local` 设置 `ANNOTATIONS_SERVER_URL`。留空时评审使用本机 `http://localhost:3110`。`bun run upgrade:ngt -- --check` 只查询当前可用的稳定 UI 标签。

- [设计](./docs/detailed-design/INDEX.md)
- [实施](./docs/implementation/INDEX.md)

联合启动器可用 `DEV_WEB_HOST`、`DEV_WEB_PORT`、`DEV_API_ORIGIN` 为本次开发提供监听与代理地址。
