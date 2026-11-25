import type { Share, ShareStatus } from './contracts'

export function shareStatus(share: Share, now: number): ShareStatus {
  return share.status !== 'revoked' && share.expiresAt <= now ? 'expired' : share.status
}
