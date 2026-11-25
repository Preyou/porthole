import { sql } from 'drizzle-orm'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import db from '@/db/pg/db'
import { logtoAccountRevocations as revocations } from '@/db/pg/schemas'
import { ResponseCodeError } from '@/errors/responseCode'

type AccountState = NonNullable<typeof revocations.$inferInsert.state>

export function assertLogtoAccountValid(
  account: { revokedBefore: number | null, state: AccountState | null } | undefined,
  issuedAt: number,
) {
  if (account?.state === 'deleted' || account?.state === 'suspended'
    || (account?.revokedBefore != null && issuedAt <= account.revokedBefore)) {
    throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED)
  }
}

export async function recordLogtoAccountChanges(
  provider: string,
  changes: { changedAt: number, state?: AccountState, subject: string }[],
) {
  if (changes.length === 0) { return }

  await db.insert(revocations).values(changes.map(({ changedAt, state, subject }) => ({
    provider,
    revokedBefore: changedAt,
    state,
    stateChangedAt: state ? changedAt : 0,
    subject,
  }))).onConflictDoUpdate({
    set: {
      revokedBefore: sql`greatest(${revocations.revokedBefore}, excluded.revoked_before)`,
      state: sql`CASE
        WHEN ${revocations.state} = 'deleted' THEN ${revocations.state}
        WHEN excluded.state = 'deleted' THEN excluded.state
        WHEN excluded.state_changed_at > ${revocations.stateChangedAt} THEN excluded.state
        ELSE ${revocations.state} END`,
      stateChangedAt: sql`greatest(${revocations.stateChangedAt}, excluded.state_changed_at)`,
    },
    target: [revocations.provider, revocations.subject],
  })
}
