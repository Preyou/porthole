import { z } from 'zod'

// 分页契约由 schema 提供；不通过宏注入 record 查询覆盖业务字段。
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

export function pageData<Item>(items: Item[], total: number, { page, pageSize }: z.infer<typeof paginationQuerySchema>) {
  return { items, page, pageSize, total }
}
