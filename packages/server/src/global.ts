import { Elysia } from 'elysia'
import { authManager } from './auth'
import * as pg from './db/pg'
import env from './env'
import { serverI18n } from './locales'
import { createAuthorizePlugin } from './plugins/authorize'
import { createDatabasePlugin } from './plugins/database'
import { createFormatResponsePlugin } from './plugins/formatResponse'
import { createIdempotencyPlugin } from './plugins/idempotency'
import { createListQueryWhitelistPlugin } from './plugins/listQueryWhitelist'
import { createLoggerPlugin } from './plugins/logger'
import { createAuthPlugin, createPublicAuthPlugin } from './plugins/sessionAuth'

const idempotencyPluginOptions = env.idempotencyTtlMs === undefined
  ? undefined
  : {
      options: {
        cacheTTLMS: env.idempotencyTtlMs,
      },
    }

export const governancePlugin = new Elysia({
  name: 'global-governance-plugin',
})
  .decorate('i18n', serverI18n.i18n)
  .use(createDatabasePlugin(pg))
  .use(createLoggerPlugin({
    logsDir: env.logFileDir,
    logsMaxBytes: env.logFileMaxBytes,
    logsRetentionDays: env.logFileRetentionDays,
    redactKeys: ['accessKey', 'authorization', 'key', 'credential', 'credentialCiphertext', 'imageUrl', 'token', 'uploadUrl', 'url'],
  }))
  .use(createIdempotencyPlugin(idempotencyPluginOptions))
  .use(createFormatResponsePlugin())
  .use(createListQueryWhitelistPlugin())
  .as('scoped')

// 公开服务需逐路由显式声明，避免通过继承受保护作用域后关闭认证。
export const publicPlugin = new Elysia({ name: 'public-governance-plugin' })
  .use(governancePlugin)
  .use(createPublicAuthPlugin())
  .as('scoped')

export const globalPlugin = new Elysia({ name: 'protected-governance-plugin' })
  .use(governancePlugin)
  .use(createAuthorizePlugin(createAuthPlugin(authManager)))
  .as('scoped')

export function createService(name: string) {
  // guard 的路由元数据在服务注册处展开，避免依赖插件跨作用域继承 detail。
  return new Elysia({ name }).use(globalPlugin).guard({ useAuth: true })
}
