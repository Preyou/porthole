import { sql } from 'drizzle-orm'
import { bigint, boolean, check, index, pgTable, text } from 'drizzle-orm/pg-core'
import { users } from './users.table'

export const todos = pgTable('todos', {
  completed: boolean().notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(sql`(extract(epoch from now()) * 1000)::bigint`),
  id: text().primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().default(sql`(extract(epoch from now()) * 1000)::bigint`),
}, table => [
  check('todos_title_valid', sql`char_length(btrim(${table.title})) between 1 and 200`),
  index('todos_owner_created_idx').on(table.ownerId, table.createdAt),
])
