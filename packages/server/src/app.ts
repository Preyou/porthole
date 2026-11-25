import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { SESSION_COOKIE_NAME } from './auth'
import env from './env'
import { governancePlugin, publicPlugin } from './global'
import { createApiOriginPlugin } from './plugins/apiOrigin'
import { responseDTO } from './plugins/formatResponse'
import { i18nPlugin } from './plugins/i18n'
import { authService } from './services/auth'
import { portholeService } from './services/porthole'
import { todosService } from './services/todos'
import { usersService } from './services/users'

const openApiLogtoEndpoint = env.logtoConfigured ? env.logtoEndpoint : 'https://auth.example.com'

export const app = new Elysia()
  .group(env.apiPrefix, app => app
    .use(createApiOriginPlugin(env.appOrigin))
    // 文档作为公共基础路由，在认证与业务响应治理前注册，避免随业务 service 重复挂载。
    .use(openapi({
      documentation: {
        components: {
          securitySchemes: {
            logtoOAuth: {
              description: `Logto 模式下，公开客户端使用 audience=${env.logtoApiResource || 'https://api.example.com'}、scope=${env.logtoApiScope} 的 Access Token（Authorization Code + S256 PKCE）。`,
              flows: { authorizationCode: {
                authorizationUrl: `${openApiLogtoEndpoint}/oidc/auth`,
                scopes: { [env.logtoApiScope]: 'Porthole 管理 API' },
                tokenUrl: `${openApiLogtoEndpoint}/oidc/token`,
              } },
              type: 'oauth2',
            },
            sessionCookie: { in: 'cookie', name: SESSION_COOKIE_NAME, type: 'apiKey' },
          },
        },
        info: {
          title: 'Porthole API',
          version: '1.0.0',
        },
        openapi: '3.1.0',
      },
      mapJsonSchema: {
        // 文档描述 HTTP 输入，保留转换前的字符串/数组契约；handler 使用转换后的类型。
        zod: (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' }),
      },
      path: env.openapiUrl,
    }))
    .use(i18nPlugin)
    .use(governancePlugin)
    .use(authService)
    .use(usersService)
    .use(todosService)
    .use(portholeService)
    .use(new Elysia({ name: 'health' }).use(publicPlugin)
      .get('/health', ({ format }) => format({ status: 'ok' }), {
        detail: { security: [], tags: ['health'] },
        response: { 200: responseDTO(z.object({ status: z.literal('ok') })) },
        useAuth: false,
      })))
