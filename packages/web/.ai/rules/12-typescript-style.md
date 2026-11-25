# TypeScript Style

## Scope

适用于本仓库的 TypeScript 代码和类型设计。

## 规则

- 默认使用 TypeScript，不新增 JavaScript 业务代码。
- 优先使用 `unknown`、泛型约束、类型收敛和明确契约。
- `any` 只用于边界桥接、第三方类型缺失或框架类型限制等合理场景。
- 新增 `any` 时，在使用点附近写 `// any-reason: <原因>`。
- 优先使用不可变字面量和 `as const` 表达静态结构。
- 默认不使用 `enum`；需要枚举语义时，优先使用字面量联合、`as const` 对象或常量映射。
- 类型收敛优先考虑 `satisfies`；确认具体类型时可使用 `as`。
- 明确安全时可使用 `as unknown as SomeType` 或 `// @ts-expect-error <reason>`，但必须能说明原因。
- 未使用的占位参数默认命名为 `_`；同一作用域冲突时使用 `_name`。
- 实际会被使用的变量或参数不使用下划线前缀，第三方 API 固定约定除外。
