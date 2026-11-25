import { afterAll, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createLogtoWebhook } from '../../src/auth/logtoWebhook'
import { createAuthManager, LOGIN_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../src/auth/manager'
import { createRedisAuthStateStore } from '../../src/auth/stateStore'
import { db } from '../../src/db/pg'
import { logtoAccountRevocations, userIdentities, users } from '../../src/db/pg/schemas'
import env from '../../src/env'
import { createFormatResponsePlugin } from '../../src/plugins/formatResponse'
import { createAuthPlugin } from '../../src/plugins/sessionAuth'
import { createRedisConnection } from '../../src/redis/client'

// 隔离的模拟 Logto + 真实 PostgreSQL，覆盖 PKCE、OIDC 校验、Cookie 与 API Resource Token。
const testId = crypto.randomUUID()
const browserSubject = `browser-${testId}`
const apifoxSubject = `apifox-${testId}`
const clientId = `client-${testId}`
const clientSecret = `secret-${testId}`
const resource = `https://api.test/${testId}`
const redis = createRedisConnection(env.redisUrl)
const stateStore = createRedisAuthStateStore(redis, `yuumi:test:${testId}:auth`)
const keys = await generateKeyPair('RS256')
const jwk = { ...await exportJWK(keys.publicKey), alg: 'RS256', kid: testId, use: 'sig' }
let expectedChallenge = ''
let expectedNonce = ''

let upstreamOrigin = ''
const upstream = Bun.serve({
  async fetch(request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path.endsWith('openid-configuration')) {
      return Response.json({
        authorization_endpoint: `${upstreamOrigin}/authorize`,
        end_session_endpoint: `${upstreamOrigin}/logout`,
        issuer: upstreamOrigin,
        jwks_uri: `${upstreamOrigin}/jwks`,
        revocation_endpoint: `${upstreamOrigin}/revoke`,
        token_endpoint: `${upstreamOrigin}/token`,
        userinfo_endpoint: `${upstreamOrigin}/me`,
      })
    }
    if (path === '/jwks') { return Response.json({ keys: [jwk] }) }
    if (path === '/token') {
      const body = new URLSearchParams(await request.text())
      expect(body.get('code')).toBe('test-code')
      expect(new Bun.CryptoHasher('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(expectedChallenge)
      expect(request.headers.get('authorization')).toBe(`Basic ${btoa(`${clientId}:${clientSecret}`)}`)
      const idToken = await new SignJWT({ email: `${testId}@example.test`, email_verified: true, name: 'OIDC Test', nonce: expectedNonce })
        .setProtectedHeader({ alg: 'RS256', kid: testId })
        .setSubject(browserSubject)
        .setIssuer(upstreamOrigin)
        .setAudience(clientId)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(keys.privateKey)
      return Response.json({ access_token: 'unused', expires_in: 3600, id_token: idToken, scope: 'openid profile email' })
    }
    return new Response(null, { status: 404 })
  },
  port: 0,
})
upstreamOrigin = upstream.url.origin

const appOrigin = 'https://yuumi.test'
const managerOptions = {
  apiPrefix: '/api',
  appOrigin,
  clientId,
  clientSecret,
  endpoint: upstreamOrigin,
  loginTtlSeconds: 600,
  resource,
  scope: 'api',
  sessionTtlSeconds: 3600,
  stateStore,
}
const manager = createAuthManager(managerOptions)
const app = new Elysia()
  .use(createFormatResponsePlugin())
  .use(createAuthPlugin(manager))
  .get('/protected', ({ auth, format }) => format(auth.user))
  .post('/write', ({ format }) => format('ok'))

async function accessToken(subject: string, scope = 'api', issuedAt?: number) {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', kid: testId })
    .setSubject(subject)
    .setIssuer(upstreamOrigin)
    .setAudience(resource)
    .setIssuedAt(issuedAt)
    .setExpirationTime('1h')
    .sign(keys.privateKey)
}

afterAll(async () => {
  const identities = await db.select({ userId: userIdentities.userId }).from(userIdentities).where(eq(userIdentities.issuer, upstreamOrigin))
  for (const identity of identities) { await db.delete(users).where(eq(users.id, identity.userId)) }
  await db.delete(logtoAccountRevocations).where(eq(logtoAccountRevocations.provider, upstreamOrigin))
  redis.close()
  upstream.stop(true)
})

test('无角色声明的 Logto 用户可登录，Cookie 会话执行同源写保护', async () => {
  const login = await manager.startLogin('/home/main')
  const loginUrl = new URL(login.redirect)
  expectedNonce = loginUrl.searchParams.get('nonce')!
  expectedChallenge = loginUrl.searchParams.get('code_challenge')!
  expect(expectedNonce).toBeTruthy()
  expect(loginUrl.searchParams.get('redirect_uri')).toBe(`${appOrigin}/api/auth/callback/logto`)
  expect(loginUrl.searchParams.get('scope')).toBe('openid profile email')

  const state = loginUrl.searchParams.get('state')!
  const stateHash = new Bun.CryptoHasher('sha256').update(state).digest('base64url')
  // 开发环境由 Vite 代理到内部地址，后端所见 origin 不等于 Logto 注册的公开回调 origin。
  const completed = await manager.completeLogin(new Request(`http://127.0.0.1:3100/api/auth/callback/logto?code=test-code&state=${state}&iss=${encodeURIComponent(upstreamOrigin)}`, { headers: { cookie: `${LOGIN_COOKIE_NAME}=${state}` } }))
  expect(completed.returnTo).toBe('/home/main')
  expect(completed.cookies[0]).toContain(`${SESSION_COOKIE_NAME}=`)
  expect(completed.cookies[0]).toContain('HttpOnly')
  expect(completed.cookies[0]).toContain('SameSite=Lax')
  expect(completed.cookies[1]).toContain(`${LOGIN_COOKIE_NAME}=`)
  expect(await stateStore.consumeLogin(stateHash)).toBeUndefined()

  const cookie = completed.cookies[0].split(';', 1)[0]
  const protectedResponse = await app.handle(new Request('http://local/protected', { headers: { cookie } }))
  expect(protectedResponse.status).toBe(200)
  expect(await protectedResponse.json()).toMatchObject({ data: { email: `${testId}@example.test`, name: 'OIDC Test' } })
  expect((await app.handle(new Request('http://local/write', { headers: { cookie }, method: 'POST' }))).status).toBe(403)
  expect((await app.handle(new Request('http://local/write', { headers: { cookie, origin: appOrigin }, method: 'POST' }))).status).toBe(200)

  const logout = await manager.logout(new Request(`${appOrigin}/api/auth/logout`, { headers: { cookie, origin: appOrigin }, method: 'POST' }))
  expect(new URL(logout.redirect).pathname).toBe('/logout')
  expect(logout.cookie).toContain('Max-Age=0')
  expect((await app.handle(new Request('http://local/protected', { headers: { cookie } }))).status).toBe(401)
})

test('Apifox Logto Access Token 需先幂等建档，再以 Bearer 访问业务接口', async () => {
  const token = await accessToken(apifoxSubject)
  expect((await app.handle(new Request('http://local/protected', { headers: { authorization: `Bearer ${token}` } }))).status).toBe(403)
  const first = await manager.provision(new Request('http://local', { headers: { authorization: `Bearer ${token}` } }))
  const second = await manager.provision(new Request('http://local', { headers: { authorization: `Bearer ${token}` } }))
  expect(second.id).toBe(first.id)
  expect((await app.handle(new Request('http://local/protected', { headers: { authorization: `Bearer ${token}` } }))).status).toBe(200)
  const wrongScope = await accessToken(apifoxSubject, 'other')
  expect((await app.handle(new Request('http://local/protected', { headers: { authorization: `Bearer ${wrongScope}` } }))).status).toBe(401)
  expect((await app.handle(new Request('http://local/protected'))).status).toBe(401)
})

test('签名的 Logto 通知撤销删除、禁用或分组变更的账号凭证', async () => {
  const signingKey = 'isolated-integration-signing-key'
  const webhook = createLogtoWebhook(upstreamOrigin, signingKey)
  const checkedManager = createAuthManager({ ...managerOptions, sessionIssuer: upstreamOrigin })
  const checkedApp = new Elysia()
    .use(createFormatResponsePlugin())
    .post('/hook', ({ request }) => webhook(request), { parse: 'none' })
    .use(createAuthPlugin(checkedManager))
    .get('/protected', ({ format }) => format('ok'))
    .post('/protected', ({ format }) => format('ok'))

  async function loginBrowser() {
    const login = await checkedManager.startLogin()
    const loginUrl = new URL(login.redirect)
    expectedNonce = loginUrl.searchParams.get('nonce')!
    expectedChallenge = loginUrl.searchParams.get('code_challenge')!
    const state = loginUrl.searchParams.get('state')!
    const completed = await checkedManager.completeLogin(new Request(`${appOrigin}/api/auth/callback/logto?code=test-code&state=${state}`, {
      headers: { cookie: `${LOGIN_COOKIE_NAME}=${state}` },
    }))
    return completed.cookies[0].split(';', 1)[0]
  }

  function notify(payload: Record<string, unknown>, key = signingKey) {
    const body = JSON.stringify(payload)
    return checkedApp.handle(new Request('http://local/hook', {
      body,
      headers: { 'content-type': 'application/json', 'logto-signature-sha-256': createHmac('sha256', key).update(body).digest('hex') },
      method: 'POST',
    }))
  }

  async function access(headers: Record<string, string>) {
    return (await checkedApp.handle(new Request('http://local/protected', { headers }))).status
  }

  function suspension(isSuspended: boolean, eventTime: number) {
    return {
      createdAt: new Date(eventTime).toISOString(),
      data: { isSuspended, updatedAt: eventTime },
      event: 'User.SuspensionStatus.Updated',
      method: 'PATCH',
      params: { userId: browserSubject },
      status: 200,
    }
  }

  const cookie = await loginBrowser()
  const authorization = `Bearer ${await accessToken(browserSubject)}`
  const otherAuthorization = `Bearer ${await accessToken(apifoxSubject)}`
  await checkedManager.provision(new Request('http://local', { headers: { authorization: otherAuthorization } }))
  const membership = {
    createdAt: new Date().toISOString(),
    event: 'Organization.Membership.Updated',
    removedUserIds: [browserSubject],
  }

  expect((await notify(membership, 'wrong-key')).status).toBe(401)
  expect(await access({ cookie })).toBe(200)
  expect(await access({ authorization })).toBe(200)
  expect((await notify(membership)).status).toBe(204)
  expect((await notify(membership)).status).toBe(204)
  expect(await access({ cookie })).toBe(401)
  expect(await access({ authorization })).toBe(401)
  const freshCookie = await loginBrowser()
  expect(await access({ cookie: freshCookie })).toBe(200)
  expect(await access({ authorization: otherAuthorization })).toBe(200)

  const disabledAt = Date.now()
  expect((await notify(suspension(true, disabledAt))).status).toBe(204)
  expect(await access({ cookie: freshCookie })).toBe(401)
  await expect(loginBrowser()).rejects.toThrow()

  const recoveredAt = Date.now()
  expect((await notify(suspension(false, recoveredAt))).status).toBe(204)
  expect((await notify(suspension(true, disabledAt))).status).toBe(204)
  expect(await access({ cookie: freshCookie })).toBe(401)
  const recoveredCookie = await loginBrowser()
  expect(await access({ cookie: recoveredCookie })).toBe(200)
  const recoveredAuthorization = `Bearer ${await accessToken(browserSubject, 'api', Math.ceil(Date.now() / 1000))}`
  expect(await access({ authorization: recoveredAuthorization })).toBe(200)

  const deletion = {
    createdAt: new Date().toISOString(),
    event: 'User.Deleted',
    method: 'DELETE',
    params: { userId: browserSubject },
    status: 204,
  }
  expect((await notify(deletion)).status).toBe(204)
  expect((await notify(suspension(false, Date.now()))).status).toBe(204)
  expect(await access({ cookie: recoveredCookie })).toBe(401)
  expect(await access({ authorization: recoveredAuthorization })).toBe(401)
  expect(await access({ authorization: otherAuthorization })).toBe(200)
  const [identity] = await db.select().from(userIdentities).where(eq(userIdentities.subject, browserSubject))
  expect(identity?.userId).toBeTruthy()
})
