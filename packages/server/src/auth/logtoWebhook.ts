import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { recordLogtoAccountChanges } from './logtoAccountState'

const maxPayloadBytes = 256 * 1024
const signatureHeader = 'logto-signature-sha-256'
const subject = z.string().min(1).max(128)
const createdAt = z.iso.datetime({ offset: true }).transform(value => Date.parse(value))
const accountEvent = z.discriminatedUnion('event', [
  z.object({
    createdAt,
    event: z.literal('User.Deleted'),
    method: z.literal('DELETE'),
    params: z.object({ userId: subject }),
    status: z.literal(204),
  }),
  z.object({
    createdAt,
    data: z.object({ isSuspended: z.boolean(), updatedAt: z.number().int().nonnegative().optional() }),
    event: z.literal('User.SuspensionStatus.Updated'),
    method: z.literal('PATCH'),
    params: z.object({ userId: subject }),
    status: z.literal(200),
  }),
  z.object({
    addedUserIds: z.array(subject).default([]),
    createdAt,
    event: z.literal('Organization.Membership.Updated'),
    removedUserIds: z.array(subject).default([]),
  }),
])
const logtoTestPayload = z.object({
  event: z.enum(['User.Deleted', 'User.SuspensionStatus.Updated', 'Organization.Membership.Updated']),
  method: z.literal('POST'),
  params: z.object({ id: z.literal('fake-id') }),
  path: z.literal('/fake-path/:id'),
  status: z.literal(200),
})

export function createLogtoWebhook(provider: string, signingKey: string | undefined) {
  return async (request: Request) => {
    if (!signingKey) { return new Response(null, { status: 404 }) }

    const signature = request.headers.get(signatureHeader)
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) { return new Response(null, { status: 401 }) }
    if (Number(request.headers.get('content-length')) > maxPayloadBytes) { return new Response(null, { status: 413 }) }

    const raw = Buffer.from(await request.arrayBuffer())
    if (raw.length > maxPayloadBytes) { return new Response(null, { status: 413 }) }
    const expected = createHmac('sha256', signingKey).update(raw).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) { return new Response(null, { status: 401 }) }

    let value: unknown
    try { value = JSON.parse(raw.toString('utf8')) }
    catch { return new Response(null, { status: 400 }) }
    if (logtoTestPayload.safeParse(value).success) { return new Response(null, { status: 204 }) }

    const result = accountEvent.safeParse(value)
    if (!result.success) { return new Response(null, { status: 400 }) }
    const event = result.data
    if (event.event === 'Organization.Membership.Updated') {
      const subjects = new Set([...event.addedUserIds, ...event.removedUserIds])
      await recordLogtoAccountChanges(provider, [...subjects].map(subject => ({ changedAt: event.createdAt, subject })))
    }
    else {
      const state = event.event === 'User.Deleted' ? 'deleted' : event.data.isSuspended ? 'suspended' : 'available'
      const changedAt = event.event === 'User.SuspensionStatus.Updated'
        ? event.data.updatedAt ?? event.createdAt
        : event.createdAt
      await recordLogtoAccountChanges(provider, [{ changedAt, state, subject: event.params.userId }])
    }
    return new Response(null, { status: 204 })
  }
}
