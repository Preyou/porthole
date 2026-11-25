import { expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { createLocalAccount, createLocalAuth, localLoginInput } from '../../src/auth/local'
import { createSessionManager } from '../../src/auth/session'
import { createRedisAuthStateStore } from '../../src/auth/stateStore'
import { RESPONSE_CODES } from '../../src/constants/responseCodeMap'
import { db } from '../../src/db/pg'
import { users } from '../../src/db/pg/schemas'
import env from '../../src/env'
import { createRedisConnection } from '../../src/redis/client'

test('自建登录发放共同的会话，隔离提供方并限制失败尝试', async () => {
  const redis = createRedisConnection(env.redisUrl)
  const namespace = `local-test:${crypto.randomUUID()}`
  const username = `u-${crypto.randomUUID()}`
  const password = 'fixture-only password 21'
  const options = { appOrigin: env.appOrigin, sessionTtlSeconds: 60 }
  const local = createLocalAuth({
    ...options,
    namespace,
    redis,
    stateStore: createRedisAuthStateStore(redis, namespace),
  })
  const otherProvider = createSessionManager({ ...options, stateStore: createRedisAuthStateStore(redis, `${namespace}:other`) })
  let id: string | undefined
  try {
    const user = await createLocalAccount({ name: 'Local Fixture', password, username })
    id = user.id
    await expect(createLocalAccount({ name: 'Duplicate', password, username })).rejects.toMatchObject({ code: RESPONSE_CODES.CONFLICT })
    const input = localLoginInput.parse({ password, username: username.toUpperCase() })
    const signIn = new Request(env.appOrigin, { headers: { origin: env.appOrigin }, method: 'POST' })
    await expect(local.login(new Request(env.appOrigin, { method: 'POST' }), input)).rejects.toMatchObject({ code: RESPONSE_CODES.FORBIDDEN })
    const signedIn = await local.login(signIn, input)
    expect(signedIn.user).toEqual(user)
    expect(signedIn.cookie).toContain('HttpOnly')
    const signedRequest = new Request(env.appOrigin, { headers: { cookie: signedIn.cookie.split(';', 1)[0]!, origin: env.appOrigin } })
    expect((await local.authenticate(signedRequest)).user).toEqual(user)
    await expect(otherProvider.authenticate(signedRequest)).rejects.toMatchObject({ code: RESPONSE_CODES.UNAUTHORIZED })
    expect((await local.logout(signedRequest)).redirect).toBe('/')
    await expect(local.authenticate(signedRequest)).rejects.toMatchObject({ code: RESPONSE_CODES.UNAUTHORIZED })
    for (let index = 0; index < 4; index++) {
      await expect(local.login(signIn, { ...input, password: 'wrong' })).rejects.toMatchObject({ code: RESPONSE_CODES.UNAUTHORIZED })
    }
    await expect(local.login(signIn, input)).rejects.toMatchObject({ code: RESPONSE_CODES.AUTH_TOO_MANY_ATTEMPTS })
  }
  finally {
    if (id) { await db.delete(users).where(eq(users.id, id)) }
    redis.close()
  }
})
