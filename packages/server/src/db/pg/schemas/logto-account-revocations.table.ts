import { bigint, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

export const logtoAccountRevocations = pgTable('logto_account_revocations', {
  provider: text().notNull(),
  revokedBefore: bigint('revoked_before', { mode: 'number' }).notNull(),
  state: text().$type<'available' | 'suspended' | 'deleted'>(),
  stateChangedAt: bigint('state_changed_at', { mode: 'number' }).notNull(),
  subject: text().notNull(),
}, table => [
  primaryKey({ columns: [table.provider, table.subject], name: 'logto_account_revocations_pk' }),
])
