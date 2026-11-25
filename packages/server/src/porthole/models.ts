import { z } from 'zod'
import { slugPattern } from './config'

const description = z.string().trim().max(500).nullable()
const durationMinutes = z.number().int().min(1).max(43_200)
const maximumVisits = z.number().int().min(1).max(1_000_000).nullable()
const name = z.string().trim().min(1).max(100)
const port = z.number().int().min(50_100).max(50_999)
const protocol = z.enum(['http', 'https'])
const upstreamHostMode = z.enum(['original', 'local'])
const key = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({ mode: z.literal('generate') }),
  z.object({ mode: z.literal('custom'), value: z.string().trim().min(8).max(128) }),
])

export const shareCreateSchema = z.object({
  description: description.optional(),
  durationMinutes,
  key,
  maxVisits: maximumVisits,
  name,
  port,
  slug: z.string().trim().toLowerCase().regex(slugPattern).optional(),
  upstreamHostMode: upstreamHostMode.optional(),
})
export const shareChangeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('extend') }),
  z.object({ action: z.literal('revoke') }),
  z.object({ action: z.literal('reconnect') }),
  z.object({
    action: z.literal('edit'),
    description: description.optional(),
    durationMinutes: durationMinutes.optional(),
    key: key.optional(),
    maxVisits: maximumVisits,
    name,
    upstreamHostMode: upstreamHostMode.optional(),
  }),
])
export const shareSchema = z.object({
  createdAt: z.number(),
  description,
  expiresAt: z.number(),
  hasKey: z.boolean(),
  id: z.string(),
  maxVisits: maximumVisits,
  name,
  port,
  protocol,
  remaining: z.number().nullable(),
  slug: z.string(),
  status: z.enum(['active', 'expired', 'exhausted', 'revoked', 'offline', 'changed']),
  upstreamHostMode,
  url: z.url(),
  visits: z.number(),
})
export const shareResultSchema = z.object({ accessKey: z.string().nullable(), share: shareSchema })
export const discoveredPortSchema = z.object({ address: z.string().nullable(), port, protocol: protocol.nullable() })
export const shareIdSchema = z.object({ id: z.uuid() })

export type ShareCreate = z.infer<typeof shareCreateSchema>
export type ShareChange = z.infer<typeof shareChangeSchema>
export type Share = z.infer<typeof shareSchema>
