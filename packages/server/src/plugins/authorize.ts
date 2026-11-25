import type { createAuthPlugin } from './sessionAuth'
import { Elysia } from 'elysia'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { ResponseCodeError } from './formatResponse'

/** 资源授权入口：只允许已认证身份访问自己拥有的资源，缺失策略默认拒绝。 */
export function createAuthorizePlugin(authentication: ReturnType<typeof createAuthPlugin>) {
  return new Elysia({ name: 'resource-authorize' })
    .use(authentication)
    .resolve(({ auth }) => ({
      authorize(input?: { ownerId: string }) {
        if (!input || input.ownerId !== auth.userId) { throw new ResponseCodeError(RESPONSE_CODES.FORBIDDEN) }
      },
      authorizeCreate() { return { ownerId: auth.userId } },
    }))
    .macro({
      useAuthorize: (enabled: boolean) => ({
        beforeHandle() {
          if (enabled) { throw new ResponseCodeError(RESPONSE_CODES.FORBIDDEN) }
        },
      }),
    })
    .as('scoped')
}
