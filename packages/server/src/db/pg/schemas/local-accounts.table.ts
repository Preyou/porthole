import { pgTable, text } from 'drizzle-orm/pg-core'
import { users } from './users.table'

export const localAccounts = pgTable('local_accounts', {
  passwordHash: text('password_hash').notNull(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  username: text().primaryKey(),
})
