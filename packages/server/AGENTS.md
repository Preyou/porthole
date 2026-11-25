# Yuumi Server

先读 `.ai/INDEX.md`，再读当前模块的三层设计。业务实现只在 src 下；只使用 Bun 与 PostgreSQL；schema 是数据库唯一来源，部署通过 migration。

| 规则                                | 场景            |
| ----------------------------------- | --------------- |
| `.ai/rules/10-server-boundary.md`   | API、认证与数据 |
| `.ai/rules/30-change-validation.md` | 所有修改与提交  |

TypeScript 使用明确类型。错误只在明确边界转换，不吞错、不重放写入。
