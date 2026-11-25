import { Elysia } from 'elysia'
import { z } from 'zod'
import { authConfig, authManager } from '@/auth'
import { localLoginInput } from '@/auth/local'
import { createLogtoWebhook } from '@/auth/logtoWebhook'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import env, { AUTH_MODES } from '@/env'
import { responseDTO } from '@/plugins/formatResponse'

const authUser = z.object({ email: z.string().nullable(), id: z.string(), image: z.string().nullable(), name: z.string().nullable() })
const authError = responseDTO(z.null())
const receiveLogtoWebhook = createLogtoWebhook(
  env.logtoEndpoint,
  env.authMode === 'logto' && env.logtoConfigured ? env.logtoWebhookSigningKey : undefined,
)

/** 对外认证协议服务；OIDC 重定向端点保留原生响应，建档端点使用业务 envelope。 */
export const authService = new Elysia({ name: 'auth-service' })
  .group('/auth', app => app
    .get('/config', ({ set }) => {
      set.headers['cache-control'] = 'no-store'
      return { code: RESPONSE_CODES.SUCCESS, data: authConfig, message: '' }
    }, {
      detail: { security: [], tags: ['auth'] },
      response: { 200: responseDTO(z.object({ configured: z.boolean(), mode: z.enum(AUTH_MODES) })) },
    })
    .get('/login', async ({ query }) => {
      const result = await authManager.startLogin(query.returnTo)
      return new Response(null, { headers: { 'location': result.redirect, 'set-cookie': result.cookie }, status: 302 })
    }, {
      detail: { security: [], tags: ['auth'] },
      query: z.object({ returnTo: z.string().optional() }),
      response: { 404: authError, 503: authError },
    })
    .post('/login/local', async ({ body, request, set }) => {
      const result = await authManager.loginLocal(request, body)
      set.headers['cache-control'] = 'no-store'
      set.headers['set-cookie'] = result.cookie
      return { code: RESPONSE_CODES.SUCCESS, data: result.user, message: '' }
    }, {
      body: localLoginInput,
      detail: { security: [], tags: ['auth'] },
      response: { 200: responseDTO(authUser), 401: authError, 403: authError, 404: authError, 429: authError, 503: authError },
    })
    .get('/callback/logto', async ({ request }) => {
      const result = await authManager.completeLogin(request)
      const headers = new Headers({ location: result.returnTo })
      for (const cookie of result.cookies) { headers.append('set-cookie', cookie) }
      return new Response(null, { headers, status: 302 })
    }, { detail: { security: [], tags: ['auth'] }, response: { 404: authError, 503: authError } })
    .post('/webhook/logto', ({ request }) => receiveLogtoWebhook(request), {
      detail: { hide: true },
      parse: 'none',
    })
    .post('/logout', async ({ request }) => {
      const result = await authManager.logout(request)
      return new Response(null, { headers: { 'location': result.redirect, 'set-cookie': result.cookie }, status: authConfig.mode === 'local' ? 303 : 302 })
    }, { detail: { security: [{ sessionCookie: [] }], tags: ['auth'] }, response: { 404: authError, 503: authError } })
    .post('/provision', async ({ request }) => ({ code: RESPONSE_CODES.SUCCESS, data: await authManager.provision(request), message: '' }), {
      detail: { security: [{ logtoOAuth: [env.logtoApiScope] }], tags: ['auth'] },
      response: {
        200: responseDTO(authUser),
        404: authError,
        503: authError,
      },
    }))
