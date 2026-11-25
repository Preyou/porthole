/** 外部 OIDC 身份到本地用户的稳定映射；issuer 与 subject 联合确定唯一身份。 */
import { sql } from 'drizzle-orm'
import { bigint, index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'
import { users } from './users.table'

export const userIdentities = pgTable('user_identities', {
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(sql`(extract(epoch from now()) * 1000)::bigint`),
  issuer: text().notNull(),
  subject: text().notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, table => [
  primaryKey({ columns: [table.issuer, table.subject], name: 'user_identities_pk' }),
  index('user_identities_user_idx').on(table.userId),
])
