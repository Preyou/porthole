# 前端模板

欢迎页可独立打开，/app/shares 通过同源 /api 访问服务端。用冻结的锁文件安装依赖，再生成接口类型。项目显示名来自公开的 `env/.env` 中的 `APP_NAME`。主题、双语、认证导航、当前用户和待办为模板示例。公共能力从 docs/ngtui/manifest.json 发现。

认证由同源 `/api/auth/config` 决定。前端在访问登录或受保护页面时读取配置。本地登录、Logto 跳转、关闭和待配置各有对应界面，登录成功后均使用现有会话和当前用户上下文。

开发与本地构建预览由 Vite 代理同源 `/api`。正式运行由 `bun run start` 使用 Caddy 提供同源代理与静态文件。`API_ORIGIN` 配置代理目标，联合启动器可用 `DEV_WEB_HOST`、`DEV_WEB_PORT`、`DEV_API_ORIGIN` 注入本次开发的值。部署时按照 README 设置浏览器访问地址及认证回调。
