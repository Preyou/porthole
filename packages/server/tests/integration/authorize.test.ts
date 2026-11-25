import { expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { ResponseCodeError } from '@/plugins/formatResponse'
import { createAuthorizePlugin } from '../../src/plugins/authorize'
import { createFormatResponsePlugin } from '../../src/plugins/formatResponse'
import { createAuthPlugin, createPublicAuthPlugin } from '../../src/plugins/sessionAuth'

const manager = {
  async authenticate(request: Request) {
    if (request.headers.get('authorization') !== 'Bearer test-token') { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
    return { user: { email: null, id: 'owner', image: null, name: null }, userId: 'owner' }
  },
}
const app = new Elysia()
  .use(createFormatResponsePlugin())
  .use(createAuthorizePlugin(createAuthPlugin(manager)))
  .get('/allow', ({ authorize, format }) => {
    authorize({ ownerId: 'owner' })
    return format('ok')
  })
  .get('/deny', ({ authorize, format }) => {
    authorize({ ownerId: 'other' })
    return format('ok')
  })
  .get('/empty', ({ format }) => format('ok'), { useAuthorize: true })
  .get('/create', ({ authorizeCreate, format }) => format(authorizeCreate()))

async function request(path: string) {
  return app.handle(new Request(`http://localhost${path}`, { headers: { Authorization: 'Bearer test-token' } }))
}
test('归属匹配允许，跨用户拒绝，缺失策略拒绝', async () => {
  expect((await request('/allow')).status).toBe(200)
  expect((await request('/deny')).status).toBe(403)
  expect((await request('/empty')).status).toBe(403)
  expect(await (await request('/create')).json()).toMatchObject({ data: { ownerId: 'owner' } })
})

test('公开与受保护服务互不泄漏，挂载顺序不影响默认认证', async () => {
  for (const publicFirst of [true, false]) {
    const publicRoutes = new Elysia({ name: 'test-public' }).use(createPublicAuthPlugin()).get('/public', () => ({ code: 20000000, data: 'public', message: 'success' }), { useAuth: false }).get('/forgotten', () => ({ code: 20000000, data: 'closed', message: 'success' }))
    const protectedRoutes = new Elysia({ name: 'test-protected' }).use(createAuthPlugin(manager)).get('/protected', ({ auth }) => ({ code: 20000000, data: auth.userId, message: 'success' }))
    const combined = publicFirst
      ? new Elysia().use(createFormatResponsePlugin()).use(publicRoutes).use(protectedRoutes)
      : new Elysia().use(createFormatResponsePlugin()).use(protectedRoutes).use(publicRoutes)
    expect((await combined.handle(new Request('http://localhost/public'))).status).toBe(200)
    expect((await combined.handle(new Request('http://localhost/forgotten'))).status).toBe(401)
    expect((await combined.handle(new Request('http://localhost/protected'))).status).toBe(401)
    expect((await combined.handle(new Request('http://localhost/protected', { headers: { Authorization: 'Bearer test-token' } }))).status).toBe(200)
  }
})
