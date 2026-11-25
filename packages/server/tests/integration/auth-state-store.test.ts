import { afterAll, expect, test } from 'bun:test'
import { createRedisAuthStateStore } from '../../src/auth/stateStore'
import { RESPONSE_CODES } from '../../src/constants/responseCodeMap'
import env from '../../src/env'
import { createRedisConnection } from '../../src/redis/client'

const testId = crypto.randomUUID()
const redis = createRedisConnection(env.redisUrl)
const stateStore = createRedisAuthStateStore(redis, `yuumi:test:${testId}:auth`)

afterAll(() => redis.close())

test('Redis 登录事务只能原子消费一次', async () => {
  const transaction = { codeVerifier: 'verifier', nonce: 'nonce', returnTo: '/home/main' }
  await stateStore.createLogin('state', transaction, 60)
  await expect(stateStore.createLogin('state', transaction, 60)).rejects.toThrow('Redis authentication key collision')
  const consumed = await Promise.all(Array.from({ length: 8 }, () => stateStore.consumeLogin('state')))
  expect(consumed.filter(Boolean)).toEqual([transaction])
  expect(await stateStore.consumeLogin('state')).toBeUndefined()
})

test('Redis Session 可读取、删除并按 TTL 过期', async () => {
  await stateStore.createSession('delete-token', 'delete-user', 60)
  expect(await stateStore.getSession('delete-token')).toMatchObject({ issuedAt: expect.any(Number), userId: 'delete-user' })
  await stateStore.deleteSession('delete-token')
  expect(await stateStore.getSession('delete-token')).toBeUndefined()

  await stateStore.createSession('expiring-token', 'expiring-user', 1)
  expect(await stateStore.getSession('expiring-token')).toMatchObject({ issuedAt: expect.any(Number), userId: 'expiring-user' })
  await Bun.sleep(1100)
  expect(await stateStore.getSession('expiring-token')).toBeUndefined()
})

test('Redis 连接失败保持依赖不可用语义', async () => {
  const unavailable = createRedisConnection('redis://127.0.0.1:1', { connectionTimeout: 50, maxRetries: 0 })
  try {
    await expect(unavailable.get('unreachable')).rejects.toMatchObject({
      code: RESPONSE_CODES.SERVICE_UNAVAILABLE,
      dependency: 'Redis',
    })
  }
  finally {
    unavailable.close()
  }
})
