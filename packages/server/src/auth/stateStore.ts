import type { RedisConnection } from '@/redis/client'

export interface LoginTransaction {
  codeVerifier: string
  nonce: string
  returnTo: string
}

export interface StoredSession {
  issuedAt: number
  userId: string
}

export interface AuthStateStore {
  consumeLogin: (stateHash: string) => Promise<LoginTransaction | undefined>
  createLogin: (stateHash: string, transaction: LoginTransaction, ttlSeconds: number) => Promise<void>
  createSession: (tokenHash: string, userId: string, ttlSeconds: number, issuedAt?: number) => Promise<void>
  deleteSession: (tokenHash: string) => Promise<void>
  getSession: (tokenHash: string) => Promise<StoredSession | undefined>
}

const CONSUME_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then
  redis.call('DEL', KEYS[1])
end
return value
`.trim()

function parseLoginTransaction(value: string): LoginTransaction {
  const parsed = JSON.parse(value) as Partial<LoginTransaction>
  if (typeof parsed.codeVerifier !== 'string' || typeof parsed.nonce !== 'string' || typeof parsed.returnTo !== 'string') {
    throw new TypeError('Invalid Redis login transaction')
  }
  return { codeVerifier: parsed.codeVerifier, nonce: parsed.nonce, returnTo: parsed.returnTo }
}

export function createRedisAuthStateStore(redis: RedisConnection, prefix: string): AuthStateStore {
  const loginKey = (stateHash: string) => `${prefix}:login:${stateHash}`
  const sessionKey = (tokenHash: string) => `${prefix}:session:${tokenHash}`

  async function create(key: string, value: string, ttlSeconds: number) {
    const result = await redis.send<'OK' | null>('SET', [key, value, 'EX', String(ttlSeconds), 'NX'])
    if (result !== 'OK') { throw new Error('Redis authentication key collision') }
  }

  return {
    async consumeLogin(stateHash) {
      const value = await redis.send<null | string>('EVAL', [CONSUME_SCRIPT, '1', loginKey(stateHash)])
      return value === null ? undefined : parseLoginTransaction(value)
    },
    async createLogin(stateHash, transaction, ttlSeconds) {
      await create(loginKey(stateHash), JSON.stringify(transaction), ttlSeconds)
    },
    async createSession(tokenHash, userId, ttlSeconds, issuedAt = Date.now()) {
      await create(sessionKey(tokenHash), JSON.stringify({ issuedAt, userId }), ttlSeconds)
    },
    async deleteSession(tokenHash) {
      await redis.del(sessionKey(tokenHash))
    },
    async getSession(tokenHash) {
      const value = await redis.get(sessionKey(tokenHash))
      if (!value) { return undefined }
      // 已上线的旧会话只存用户 ID。
      if (!value.startsWith('{')) { return { issuedAt: 0, userId: value } }
      const session = JSON.parse(value) as Partial<StoredSession>
      if (typeof session.userId !== 'string' || typeof session.issuedAt !== 'number') {
        throw new TypeError('Invalid Redis session')
      }
      return { issuedAt: session.issuedAt, userId: session.userId }
    },
  }
}
