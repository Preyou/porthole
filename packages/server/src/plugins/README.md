# Server 插件索引

| 模块               | 职责                                 |
| ------------------ | ------------------------------------ |
| sessionAuth        | 受保护默认认证与隔离的公开作用域     |
| authorize          | 当前身份归属、实际资源授权与默认拒绝 |
| apiOrigin          | 单一网页来源与同源访问边界           |
| database           | 数据库注入与连接使用边界             |
| formatResponse     | 统一响应、注册结果码与错误传播       |
| i18n               | 公开语言字典与结果码 key             |
| logger             | 请求追踪、日志轮转和凭据脱敏         |
| idempotency        | 显式启用路由的幂等请求机制           |
| listQueryWhitelist | 路由声明的查询、排序与过滤白名单     |
| paginationStandard | 通用分页输入与结果封装               |

业务 service 使用 src/global.ts 的 createService 获得受保护边界；公开路由使用 publicPlugin 并显式 useAuth:false。资源修改必须授权实际记录，不能把客户端提交的 ownerId 视为可信。

- [结果码](../../docs/response-codes.md)
- [错误类型](../../docs/response-code-error.md)
- [语言资源](./i18n.md)
