import type { SQL } from 'bun'
import { defineRelations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import env from '@/env'
import { createPostgresClient } from './client'
import * as schema from './schemas/tables'

// Drizzle 声明要求完整 SQL 类型，实际只调用查询、begin 和 savepoint；SDK 桥接仅限此处。
export default drizzle({
  client: createPostgresClient(env.databaseUrl) as unknown as SQL,
  relations: defineRelations(schema),
})
