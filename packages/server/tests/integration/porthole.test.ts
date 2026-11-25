import { afterAll, beforeAll, expect, test } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { app } from '../../src/app'
import { logtoSessionNamespace, SESSION_COOKIE_NAME } from '../../src/auth'
import { hashAuthValue } from '../../src/auth/session'
import { createRedisAuthStateStore } from '../../src/auth/stateStore'
import { db } from '../../src/db/pg'
import { portholeSessions, portholeShares, users } from '../../src/db/pg/schemas'
import env from '../../src/env'
import { accessPath } from '../../src/porthole/accessPage'
import { handleShare } from '../../src/porthole/gateway'
import { createRedisConnection } from '../../src/redis/client'

const owner = crypto.randomUUID()
const other = crypto.randomUUID()
const tokens = [crypto.randomUUID(), crypto.randomUUID()]
const hashes = tokens.map(hashAuthValue)
const redis = createRedisConnection(env.redisUrl)
const store = createRedisAuthStateStore(redis, logtoSessionNamespace)
let upstream: ReturnType<typeof Bun.serve<undefined>> | undefined

function startUpstream(port: number) {
  return Bun.serve({
    async fetch(request) {
      const { pathname, search } = new URL(request.url)
      const host = request.headers.get('host')
      if (pathname === '/local-host-required' && host !== `127.0.0.1:${port}`) {
        return new Response('Upstream requires its own host', { status: 403 })
      }
      if (pathname === '/redirect') {
        return new Response(null, { headers: { location: `http://127.0.0.1:${port}/hello?after=redirect` }, status: 302 })
      }
      const headers = new Headers()
      headers.append('set-cookie', 'upstream=value; Path=/; Domain=.localhost')
      headers.append('set-cookie', 'porthole_access=forged; Path=/')
      return Response.json({ body: await request.text(), cookie: request.headers.get('cookie'), forwardedHost: request.headers.get('x-forwarded-host'), host, pathname, search }, { headers })
    },
    hostname: '127.0.0.1',
    port,
  })
}

beforeAll(async () => {
  await db.insert(users).values([{ id: owner }, { id: other }])
  await Promise.all([store.createSession(hashes[0]!, owner, 60), store.createSession(hashes[1]!, other, 60)])
  for (let port = 50_999; port >= 50_980; port--) {
    try {
      upstream = startUpstream(port)
      break
    }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EADDRINUSE')) { throw error }
    }
  }
  if (!upstream) { throw new Error('No available test upstream port') }
})
afterAll(async () => {
  upstream?.stop(true)
  await Promise.all(hashes.map(hash => store.deleteSession(hash)))
  await db.delete(users).where(inArray(users.id, [owner, other]))
  redis.close()
})

function management(path: string, method = 'GET', body?: unknown, token = tokens[0]) {
  return app.handle(new Request(`http://localhost${env.apiPrefix}/porthole${path}`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}`, origin: env.appOrigin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }))
}

function shareRequest(url: string, path: string, cookie?: string, values?: URLSearchParams) {
  return handleShare(new Request(`${url}${path}`, {
    body: values,
    headers: { ...(cookie ? { cookie } : {}), ...(values ? { origin: url } : {}) },
    method: values ? 'POST' : 'GET',
  }))
}

async function hold(url: string) {
  const response = await shareRequest(url, '/hello?source=direct')
  expect(response.status).toBe(200)
  expect(response.headers.get('referrer-policy')).toBe('same-origin')
  expect(await response.text()).toContain('name="key"')
  return response.headers.get('set-cookie')?.split(';')[0]
}

function unlock(url: string, cookie: string | undefined, key: string) {
  return shareRequest(url, accessPath, cookie, new URLSearchParams({ key, next: '/hello?source=direct' }))
}

test('已授权成员均可发现和发布，分享与配额按各自用户和访客会话隔离', async () => {
  const port = upstream!.port!
  const inventory = await management('/ports')
  expect(inventory.status).toBe(200)
  expect((await inventory.json()).data.ports).toContainEqual({ address: '127.0.0.1', port, protocol: 'http' })
  expect((await management('/ports', 'GET', undefined, tokens[1])).status).toBe(200)
  const body = { durationMinutes: 10, key: { mode: 'custom', value: 'test-access-secret' }, maxVisits: 2, name: 'Test upstream', port, slug: `test-${crypto.randomUUID().slice(0, 8)}` }
  expect((await management('/shares', 'POST', { ...body, port: 51_000 })).status).toBe(422)
  const created = await management('/shares', 'POST', body)
  expect(created.status).toBe(201)
  expect(created.headers.get('cache-control')).toBe('no-store')
  const { accessKey, share } = (await created.json()).data
  const otherShares = await management('/shares', 'GET', undefined, tokens[1])
  expect((await otherShares.json()).data).toEqual([])
  expect((await management(`/shares/${share.id}`, 'PATCH', { action: 'extend' }, tokens[1])).status).toBe(404)
  expect(accessKey).toBe(body.key.value)
  expect(share).toMatchObject({ description: null, hasKey: true, port, remaining: 2, status: 'active', upstreamHostMode: 'original', visits: 0 })
  expect((await management('/shares', 'POST', body)).status).toBe(409)
  const [stored] = await db.select().from(portholeShares).where(eq(portholeShares.id, share.id))
  expect(stored?.keyHash).not.toBe(body.key.value)

  const visitor = await hold(share.url)
  const another = await hold(share.url)
  const third = await hold(share.url)
  expect(visitor).toBeDefined()
  for (const origin of ['null', 'https://elsewhere.example']) {
    const rejected = await handleShare(new Request(`${share.url}${accessPath}`, {
      body: new URLSearchParams({ key: accessKey, next: '/' }),
      headers: { cookie: visitor!, origin },
      method: 'POST',
    }))
    expect(rejected.status).toBe(403)
  }
  const incorrect = await unlock(share.url, visitor, 'incorrect-key')
  expect(incorrect.status).toBe(403)
  expect(incorrect.headers.get('referrer-policy')).toBe('same-origin')
  expect(await incorrect.text()).toContain('访问密钥不正确')
  const first = await unlock(share.url, visitor, accessKey)
  expect(first.status).toBe(303)
  expect(first.headers.get('location')).toBe('/hello?source=direct')
  expect(first.headers.get('referrer-policy')).toBe('no-referrer')
  expect((await unlock(share.url, visitor, accessKey)).status).toBe(303)
  const concurrent = await Promise.all([unlock(share.url, another, accessKey), unlock(share.url, third, accessKey)])
  expect(concurrent.map(response => response.status).sort()).toEqual([303, 429])

  const through = await shareRequest(share.url, '/hello?source=direct', `${visitor}; app_cookie=value; yuumi_session=admin-token`)
  expect(through.status).toBe(200)
  expect(through.headers.getSetCookie()).toEqual(['upstream=value; Path=/'])
  expect(await through.json()).toMatchObject({ cookie: 'app_cookie=value', host: new URL(share.url).host, pathname: '/hello', search: '?source=direct' })
  expect((await shareRequest(share.url, '/local-host-required', visitor)).status).toBe(403)
  const localMode = { action: 'edit', maxVisits: body.maxVisits, name: body.name, upstreamHostMode: 'local' }
  const editPath = `/shares/${share.id}`
  expect((await management(editPath, 'PATCH', localMode, tokens[1])).status).toBe(404)
  expect((await management(editPath, 'PATCH', { ...localMode, upstreamHostMode: 'example.test' })).status).toBe(422)
  const updated = await management(editPath, 'PATCH', localMode)
  expect(updated.status).toBe(200)
  expect((await updated.json()).data.share).toMatchObject({ upstreamHostMode: 'local', url: share.url, visits: 2 })
  const localResponse = await shareRequest(share.url, '/local-host-required', visitor)
  expect(localResponse.status).toBe(200)
  expect(await localResponse.json()).toMatchObject({ forwardedHost: new URL(share.url).host, host: `127.0.0.1:${port}` })
  expect((await shareRequest(share.url, '/redirect', visitor)).headers.get('location')).toBe(`${share.url}/hello?after=redirect`)
  const oldClient = await management(editPath, 'PATCH', { action: 'edit', maxVisits: body.maxVisits, name: body.name })
  expect((await oldClient.json()).data.share.upstreamHostMode).toBe('local')
  const restored = await management(editPath, 'PATCH', { ...localMode, upstreamHostMode: 'original' })
  expect((await restored.json()).data.share.upstreamHostMode).toBe('original')
  expect((await shareRequest(share.url, '/local-host-required', visitor)).status).toBe(403)
  expect((await shareRequest(share.url, '/', undefined)).status).toBe(429)
  expect((await (await management('/shares')).json()).data).toContainEqual(expect.objectContaining({ id: share.id, remaining: 0, status: 'exhausted', visits: 2 }))
  const extended = await management(`/shares/${share.id}`, 'PATCH', { action: 'extend' })
  expect((await extended.json()).data.share.expiresAt).toBe(share.expiresAt + 3_600_000)

  upstream!.stop(true)
  upstream = startUpstream(port)
  expect((await shareRequest(share.url, '/', visitor)).status).toBe(503)
  expect((await management(`/shares/${share.id}`, 'PATCH', { action: 'reconnect' })).status).toBe(200)
  expect((await shareRequest(share.url, '/', visitor)).status).toBe(429)
  expect((await management(`/shares/${share.id}`, 'PATCH', { action: 'revoke' })).status).toBe(200)
  expect((await shareRequest(share.url, '/', visitor)).status).toBe(410)
}, 15_000)

test('创建分享时可直接使用已绑定的本机 Host', async () => {
  const port = upstream!.port!
  const created = await management('/shares', 'POST', {
    durationMinutes: 10,
    key: { mode: 'none' },
    maxVisits: null,
    name: 'Local Host upstream',
    port,
    upstreamHostMode: 'local',
  })
  expect(created.status).toBe(201)
  const { share } = (await created.json()).data
  expect(share.upstreamHostMode).toBe('local')
  const response = await shareRequest(share.url, '/local-host-required')
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ forwardedHost: new URL(share.url).host, host: `127.0.0.1:${port}` })
}, 15_000)

test('可选描述可以修改或清空，永久删除只允许所有者并清理访客会话', async () => {
  const body = {
    description: '  严格限定在管理台的备注  ',
    durationMinutes: 10,
    key: { mode: 'generate' },
    maxVisits: null,
    name: 'Share with description',
    port: upstream!.port!,
  }
  expect((await management('/shares', 'POST', { ...body, description: 'a'.repeat(501) })).status).toBe(422)
  const created = await management('/shares', 'POST', body)
  expect(created.status).toBe(201)
  const { accessKey, share } = (await created.json()).data
  expect(share.description).toBe(body.description.trim())

  const path = `/shares/${share.id}`
  const edit = { action: 'edit', maxVisits: null, name: body.name }
  const preserved = await management(path, 'PATCH', edit)
  expect((await preserved.json()).data.share.description).toBe(body.description.trim())
  const cleared = await management(path, 'PATCH', { ...edit, description: null })
  expect((await cleared.json()).data.share.description).toBeNull()
  const updated = await management(path, 'PATCH', { ...edit, description: body.description })
  expect((await updated.json()).data.share.description).toBe(body.description.trim())

  const gate = await shareRequest(share.url, '/hello')
  expect(await gate.text()).not.toContain(body.description.trim())
  const visitor = gate.headers.get('set-cookie')?.split(';')[0]
  expect((await unlock(share.url, visitor, accessKey)).status).toBe(303)
  expect(await db.select().from(portholeSessions).where(eq(portholeSessions.shareId, share.id))).toHaveLength(1)
  expect((await management(path, 'DELETE', undefined, tokens[1])).status).toBe(404)
  expect((await shareRequest(share.url, '/hello', visitor)).status).toBe(200)

  const deleted = await management(path, 'DELETE')
  expect(deleted.status).toBe(200)
  expect((await deleted.json()).data.id).toBe(share.id)
  expect(await db.select().from(portholeShares).where(eq(portholeShares.id, share.id))).toHaveLength(0)
  expect(await db.select().from(portholeSessions).where(eq(portholeSessions.shareId, share.id))).toHaveLength(0)
  expect((await shareRequest(share.url, '/hello', visitor)).status).toBe(404)
  expect((await management(path, 'DELETE')).status).toBe(404)
}, 15_000)
