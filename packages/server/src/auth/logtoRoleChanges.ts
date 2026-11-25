import { createPostgresClient } from '@/db/pg/client'
import { recordLogtoAccountChanges } from './logtoAccountState'

interface RoleChange {
  changedAt: number
  subject: string
}

export function startLogtoRoleChangeSync(databaseUrl: string, logtoDatabase: string, provider: string) {
  const url = new URL(databaseUrl)
  url.pathname = `/${encodeURIComponent(logtoDatabase)}`
  const logtoDb = createPostgresClient(url.href, { timeoutMs: 5000 })
  const applied = new Map<string, number>()
  let syncing = false

  async function sync() {
    if (syncing) { return }
    syncing = true
    try {
      const changes = await logtoDb<RoleChange[]>`
        SELECT subject, changed_at::float8 AS "changedAt"
        FROM porthole_identity.membership_changes
      `
      const pending = changes.filter(change => change.changedAt > (applied.get(change.subject) ?? 0))
      const batchSize = 500
      for (let offset = 0; offset < pending.length; offset += batchSize) {
        const batch = pending.slice(offset, offset + batchSize)
        await recordLogtoAccountChanges(provider, batch)
        for (const { changedAt, subject } of batch) { applied.set(subject, changedAt) }
      }
    }
    catch (error) {
      console.error('[auth] Logto role changes sync failed', error instanceof Error ? error.name : 'Error')
    }
    finally { syncing = false }
  }

  void sync()
  setInterval(() => { void sync() }, 5000).unref()
}
