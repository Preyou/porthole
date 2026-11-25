import type { Share, ShareChange, ShareCreate } from './models'
import { and, desc, eq, sql } from 'drizzle-orm'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { db } from '@/db/pg'
import { portholeSessions, portholeShares } from '@/db/pg/schemas'
import { ResponseCodeError } from '@/errors/responseCode'
import { managementOrigin, shareUrl } from './config'
import { listenersByPort, resolveTarget } from './discovery'

export type ShareRecord = typeof portholeShares.$inferSelect

type Key = ShareCreate['key']
const minute = 60_000

export function randomToken(bytes = 24) {
  return crypto.getRandomValues(new Uint8Array(bytes)).toHex()
}

function sessionDigest(shareId: string, token: string) {
  return new Bun.CryptoHasher('sha256').update(shareId).update(':').update(token).digest('hex')
}

async function issueKey(input: Key) {
  const accessKey = input.mode === 'custom' ? input.value : input.mode === 'generate' ? randomToken(12) : null
  return { accessKey, keyHash: accessKey === null ? null : await Bun.password.hash(accessKey) }
}

export function remainingVisits(record: ShareRecord) {
  return record.maxVisits === null ? null : Math.max(0, record.maxVisits - record.visits)
}

export function shareEnded(record: ShareRecord, now = Date.now()) {
  return record.revokedAt !== null || record.expiresAt <= now
}

export function listenerStatus(record: ShareRecord, listeners: Awaited<ReturnType<typeof listenersByPort>>) {
  const entries = listeners.get(record.port)
  if (!entries?.length) { return 'offline' }
  return entries.some(entry => entry.id === record.listener) ? 'active' : 'changed'
}

function formatShare(record: ShareRecord, listeners: Awaited<ReturnType<typeof listenersByPort>>): Share {
  const { createdAt, description, expiresAt, id, keyHash, maxVisits, name, port, protocol, slug, upstreamHostMode, visits } = record
  const remaining = remainingVisits(record)
  const upstream = listenerStatus(record, listeners)
  const status = record.revokedAt !== null
    ? 'revoked'
    : record.expiresAt <= Date.now()
      ? 'expired'
      : upstream !== 'active' ? upstream : remaining === 0 ? 'exhausted' : 'active'
  return { createdAt, description, expiresAt, hasKey: keyHash !== null, id, maxVisits, name, port, protocol, remaining, slug, status, upstreamHostMode, url: shareUrl(slug), visits }
}

export async function listShares(userId: string) {
  const [records, listeners] = await Promise.all([
    db.select().from(portholeShares).where(eq(portholeShares.ownerId, userId)).orderBy(desc(portholeShares.createdAt)),
    listenersByPort(),
  ])
  return records.map(record => formatShare(record, listeners))
}

async function reachableTarget(port: number) {
  const target = await resolveTarget(port)
  if (!target) { throw new ResponseCodeError(RESPONSE_CODES.SERVICE_UNAVAILABLE, 'Upstream is unreachable') }
  return { address: target.address, listener: target.id, protocol: target.protocol }
}

export async function createShare(userId: string, input: ShareCreate) {
  const [target, key] = await Promise.all([reachableTarget(input.port), issueKey(input.key)])
  const now = Date.now()
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = input.slug ?? randomToken(5)
    if (new URL(shareUrl(slug)).hostname === managementOrigin.hostname) { break }
    const [record] = await db.insert(portholeShares).values({
      ...target,
      createdAt: now,
      description: input.description || null,
      expiresAt: now + input.durationMinutes * minute,
      id: crypto.randomUUID(),
      keyHash: key.keyHash,
      maxVisits: input.maxVisits,
      name: input.name,
      ownerId: userId,
      port: input.port,
      slug,
      upstreamHostMode: input.upstreamHostMode,
    }).onConflictDoNothing({ target: portholeShares.slug }).returning()
    if (record) { return { accessKey: key.accessKey, share: formatShare(record, await listenersByPort()) } }
    if (input.slug) { break }
  }
  throw new ResponseCodeError(RESPONSE_CODES.CONFLICT)
}

export async function changeShare(userId: string, id: string, change: ShareChange) {
  const where = and(eq(portholeShares.id, id), eq(portholeShares.ownerId, userId))
  const [candidate] = await db.select().from(portholeShares).where(where)
  if (!candidate) { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }

  const key = change.action === 'edit' && change.key ? await issueKey(change.key) : undefined
  const target = change.action === 'reconnect' ? await reachableTarget(candidate.port) : undefined
  const record = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(portholeShares).where(where).for('update')
    if (!current) { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }
    if (current.revokedAt !== null) {
      if (change.action === 'revoke') { return current }
      throw new ResponseCodeError(RESPONSE_CODES.CONFLICT)
    }
    const now = Date.now()
    let patch: Partial<ShareRecord>
    switch (change.action) {
      case 'extend':
        if (current.expiresAt <= now) { throw new ResponseCodeError(RESPONSE_CODES.CONFLICT) }
        patch = { expiresAt: current.expiresAt + 60 * minute }
        break
      case 'revoke':
        patch = { revokedAt: now }
        break
      case 'reconnect':
        if (!target) { throw new ResponseCodeError(RESPONSE_CODES.SERVICE_UNAVAILABLE) }
        patch = target
        break
      case 'edit':
        patch = { maxVisits: change.maxVisits, name: change.name }
        if (change.description !== undefined) { patch.description = change.description || null }
        if (change.upstreamHostMode !== undefined) { patch.upstreamHostMode = change.upstreamHostMode }
        if (change.durationMinutes) { patch.expiresAt = now + change.durationMinutes * minute }
        if (key) { patch.keyHash = key.keyHash }
        break
    }
    if (key || target || change.action === 'revoke' || (current.expiresAt <= now && patch.expiresAt !== undefined)) {
      await tx.delete(portholeSessions).where(eq(portholeSessions.shareId, id))
    }
    const [updated] = await tx.update(portholeShares).set(patch).where(where).returning()
    if (!updated) { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }
    return updated
  })
  return { accessKey: key?.accessKey ?? null, share: formatShare(record, await listenersByPort()) }
}

export async function deleteShare(userId: string, id: string) {
  const [deleted] = await db.delete(portholeShares)
    .where(and(eq(portholeShares.id, id), eq(portholeShares.ownerId, userId)))
    .returning({ id: portholeShares.id })
  if (!deleted) { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }
  return deleted
}

export async function findShare(slug: string) {
  const [record] = await db.select().from(portholeShares).where(eq(portholeShares.slug, slug))
  return record
}

export async function hasSession(shareId: string, token: string) {
  const [session] = await db.select({ id: portholeSessions.id }).from(portholeSessions).where(and(eq(portholeSessions.shareId, shareId), eq(portholeSessions.id, sessionDigest(shareId, token)))).limit(1)
  return !!session
}

export async function grantSession(share: ShareRecord, token: string) {
  return db.transaction(async (tx) => {
    const where = eq(portholeShares.id, share.id)
    const [current] = await tx.select().from(portholeShares).where(where).for('update')
    if (!current || shareEnded(current)) { return 'ended' }
    if (current.keyHash !== share.keyHash || current.listener !== share.listener) { return 'changed' }
    const session = { id: sessionDigest(current.id, token), shareId: current.id }
    const [existing] = await tx.select({ id: portholeSessions.id }).from(portholeSessions).where(and(eq(portholeSessions.id, session.id), eq(portholeSessions.shareId, current.id))).limit(1)
    if (existing) { return 'granted' }
    if (remainingVisits(current) === 0) { return 'exhausted' }
    await tx.insert(portholeSessions).values(session)
    await tx.update(portholeShares).set({ visits: sql`${portholeShares.visits} + 1` }).where(where)
    return 'granted'
  })
}
