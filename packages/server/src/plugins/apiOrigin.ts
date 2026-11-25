import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { RESPONSE_CODES } from '../constants/responseCodeMap'

export function createApiOriginPlugin(appOrigin: string) {
  return new Elysia({ name: 'api-origin', seed: appOrigin })
    .onRequest(({ request }) => {
      const origin = request.headers.get('origin')
      if (origin !== null && origin !== appOrigin) {
        return Response.json({ code: RESPONSE_CODES.FORBIDDEN, data: null, message: '' }, { status: 403 })
      }
    })
    .use(cors({
      credentials: true,
      exposeHeaders: [],
      origin: request => request.headers.get('origin') === appOrigin,
    }))
    .as('scoped')
}
