/** Yuumi 本地用户；外部身份通过 user_identities 映射，不把上游 subject 暴露为业务主键。 */
import { sql } from 'drizzle-orm'
import { bigint, boolean, pgTable, text } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(sql`(extract(epoch from now()) * 1000)::bigint`),
  email: text(),
  emailVerified: boolean('email_verified').notNull().default(false),
  id: text().primaryKey(),
  image: text(),
  name: text(),
  /** 由数据库触发器维护，调用方不能覆盖更新时间。 */
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().default(sql`(extract(epoch from now()) * 1000)::bigint`),
})
