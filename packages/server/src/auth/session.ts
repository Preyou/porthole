import type { AuthStateStore, StoredSession } from './stateStore'
import { eq } from 'drizzle-orm'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import db from '@/db/pg/db'
import { users } from '@/db/pg/schemas'
import { ResponseCodeError } from '@/errors/responseCode'

export const SESSION_COOKIE_NAME = 'yuumi_session'

export interface AuthUser {
  email: string | null
  id: string
  image: string | null
  name: string | null
}

export interface AuthContext {
  method: 'bearer' | 'session'
  user: AuthUser
  userId: string
}

interface SessionOptions {
  appOrigin: string
  findSessionUser?: (session: StoredSession) => Promise<typeof users.$inferSelect | undefined>
  sessionCookieName?: string
  sessionTtlSeconds: number
  stateStore: Pick<AuthStateStore, 'createSession' | 'deleteSession' | 'getSession'>
}

export function hashAuthValue(value: string) {
  return new Bun.CryptoHasher('sha256').update(value).digest('base64url')
}

export function randomAuthToken(bytes = 32) {
  return crypto.getRandomValues(new Uint8Array(bytes)).toBase64({ alphabet: 'base64url', omitPadding: true })
}

export function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return { email: row.email, id: row.id, image: row.image, name: row.name }
}

async function findLocalUser({ userId }: StoredSession) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return user
}

export function createSessionManager({
  appOrigin,
  findSessionUser = findLocalUser,
  sessionCookieName = SESSION_COOKIE_NAME,
  sessionTtlSeconds,
  stateStore,
}: SessionOptions) {
  const secure = new URL(appOrigin).protocol === 'https:'
  const cookieOptions = { httpOnly: true, path: '/', sameSite: 'lax', secure } as const

  function readToken(request: Request) {
    return new Bun.CookieMap(request.headers.get('cookie') ?? '').get(sessionCookieName)
  }

  function requireOrigin(request: Request) {
    if (request.headers.get('origin') !== appOrigin) { throw new ResponseCodeError(RESPONSE_CODES.FORBIDDEN) }
  }

  return {
    async authenticate(request: Request): Promise<AuthContext> {
      const token = readToken(request)
      if (!token) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
      const session = await stateStore.getSession(hashAuthValue(token))
      if (!session) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
      const user = await findSessionUser(session)
      if (!user) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { requireOrigin(request) }
      return { method: 'session', user: toAuthUser(user), userId: session.userId }
    },
    async clear(request: Request) {
      const token = readToken(request)
      if (token) { await stateStore.deleteSession(hashAuthValue(token)) }
      return new Bun.Cookie(sessionCookieName, '', { ...cookieOptions, expires: new Date(0), maxAge: 0 }).serialize()
    },
    async create(userId: string, issuedAt?: number) {
      const token = randomAuthToken()
      await stateStore.createSession(hashAuthValue(token), userId, sessionTtlSeconds, issuedAt)
      return new Bun.Cookie(sessionCookieName, token, { ...cookieOptions, maxAge: sessionTtlSeconds }).serialize()
    },
    requireOrigin,
  }
}
