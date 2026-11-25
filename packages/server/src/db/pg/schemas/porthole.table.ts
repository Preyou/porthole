import { sql } from 'drizzle-orm'
import { bigint, check, index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { users } from './users.table'

export const portholeShares = pgTable('porthole_shares', {
  address: text().notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  description: text(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  id: text().primaryKey(),
  keyHash: text('key_hash'),
  listener: text().notNull(),
  maxVisits: integer('max_visits'),
  name: text().notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  port: integer().notNull(),
  protocol: text().$type<'http' | 'https'>().notNull(),
  revokedAt: bigint('revoked_at', { mode: 'number' }),
  slug: text().notNull().unique(),
  upstreamHostMode: text('upstream_host_mode').$type<'original' | 'local'>().notNull().default('original'),
  visits: integer().notNull().default(0),
}, table => [
  index('porthole_shares_owner_created_idx').on(table.ownerId, table.createdAt),
  check('porthole_port_range', sql`${table.port} BETWEEN 50100 AND 50999`),
  check('porthole_upstream_host_mode', sql`${table.upstreamHostMode} IN ('original', 'local')`),
  check('porthole_visits_valid', sql`${table.visits} >= 0 AND (${table.maxVisits} IS NULL OR ${table.maxVisits} > 0)`),
])

export const portholeSessions = pgTable('porthole_sessions', {
  id: text().primaryKey(),
  shareId: text('share_id').notNull().references(() => portholeShares.id, { onDelete: 'cascade' }),
}, table => [index('porthole_sessions_share_idx').on(table.shareId)])
