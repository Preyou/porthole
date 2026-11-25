# App Role

前端模板包含独立欢迎页、/auth 登录导航、/app 受保护父布局和私有待办示例。欢迎页不请求后端；父布局获取并注入当前用户，RouterView 位于 provider 子树。业务实现留在 app；基础、组合、请求和主题机制由统一 @ngt/ui 提供。
