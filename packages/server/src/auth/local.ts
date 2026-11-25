import type { AuthStateStore } from './stateStore'
import type { RedisConnection } from '@/redis/client'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import db from '@/db/pg/db'
import { localAccounts, users } from '@/db/pg/schemas'
import { ResponseCodeError } from '@/errors/responseCode'
import { createSessionManager, hashAuthValue, toAuthUser } from './session'

const passwordOptions = { algorithm: 'argon2id', memoryCost: 19456, timeCost: 2 } as const
const ATTEMPT_SCRIPT = `
local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if total > tonumber(ARGV[2]) then return 0 end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
if attempts > tonumber(ARGV[3]) then return 0 end
return 1
`.trim()

export const localUsername = z.string().trim().regex(/^[a-z0-9][\w.-]{2,63}$/i).transform(value => value.toLowerCase())
export const localLoginInput = z.object({
  password: z.string().min(1).max(256),
  username: localUsername,
})

export async function createLocalAccount(input: { name: string, password: string, username: string }) {
  const username = localUsername.parse(input.username)
  const name = z.string().trim().min(1).max(100).parse(input.name)
  const password = z.string().min(12).max(256).parse(input.password)
  const passwordHash = await Bun.password.hash(password, passwordOptions)
  const userId = `usr_${crypto.randomUUID()}`
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ id: userId, name }).returning()
    const [account] = await tx.insert(localAccounts).values({ passwordHash, userId, username }).onConflictDoNothing({ target: localAccounts.username }).returning({ username: localAccounts.username })
    if (!account) { throw new ResponseCodeError(RESPONSE_CODES.CONFLICT) }
    return toAuthUser(user!)
  })
}

export function createLocalAuth(options: {
  appOrigin: string
  namespace: string
  redis: RedisConnection
  sessionCookieName?: string
  sessionTtlSeconds: number
  stateStore: AuthStateStore
}) {
  const sessions = createSessionManager(options)
  const dummyHash = Bun.password.hashSync('Unused password for unknown local accounts', passwordOptions)
  const attemptsKey = `${options.namespace}:attempts`
  return {
    authenticate(request: Request) {
      if (request.headers.has('authorization')) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
      return sessions.authenticate(request)
    },
    async login(request: Request, input: z.output<typeof localLoginInput>) {
      sessions.requireOrigin(request)
      // Redis 原子计数也覆盖不存在的用户名，限制并发密码哈希工作量。
      const allowed = await options.redis.send<number>('EVAL', [ATTEMPT_SCRIPT, '2', attemptsKey, `${attemptsKey}:${hashAuthValue(input.username)}`, '60', '120', '5'])
      if (!allowed) { throw new ResponseCodeError(RESPONSE_CODES.AUTH_TOO_MANY_ATTEMPTS) }
      const [account] = await db.select({ passwordHash: localAccounts.passwordHash, user: users })
        .from(localAccounts)
        .innerJoin(users, eq(users.id, localAccounts.userId))
        .where(eq(localAccounts.username, input.username))
        .limit(1)
      const valid = await Bun.password.verify(input.password, account?.passwordHash ?? dummyHash)
      if (!valid || !account) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
      await sessions.clear(request)
      return { cookie: await sessions.create(account.user.id), user: toAuthUser(account.user) }
    },
    async logout(request: Request) {
      sessions.requireOrigin(request)
      return { cookie: await sessions.clear(request), redirect: '/' }
    },
  }
}
