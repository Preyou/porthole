import type { AuthUser } from '../auth'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import env from '@/env'
import { ResponseCodeError, responseDTO } from './formatResponse'

export function createPublicAuthPlugin() {
  return new Elysia({ name: 'public-auth' })
    .decorate('publicRoute', false)
    .macro({
      useAuth(enabled: boolean) {
        if (enabled) { throw new Error('受保护路由必须使用 globalPlugin') }
        return { detail: { security: [] }, transform(context) { context.publicRoute = true } }
      },
    })
    .onBeforeHandle(({ publicRoute }) => {
      if (!publicRoute) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
    })
    .as('scoped')
}

export function createAuthPlugin(manager: { authenticate: (request: Request) => Promise<{ user: AuthUser, userId: string }> }) {
  return new Elysia({ name: 'session-auth' })
    .macro({
      useAuth(enabled: boolean) {
        if (!enabled) { throw new Error('公开路由必须使用 publicPlugin，不能在受保护作用域关闭认证') }
        return { detail: { security: [{ logtoOAuth: [env.logtoApiScope] }, { sessionCookie: [] }] } }
      },
    })
    .resolve({ as: 'scoped' }, async ({ request }) => ({
      auth: await manager.authenticate(request),
    }))
    .guard({ response: { 401: responseDTO(z.null()), 403: responseDTO(z.null()), 503: responseDTO(z.null()) }, useAuth: true })
    .as('scoped')
}
