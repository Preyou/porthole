import { app } from './app'
import { startLogtoRoleChangeSync } from './auth/logtoRoleChanges'
import env from './env'
import { listenHost, managementOrigin } from './porthole/config'
import { handleShare } from './porthole/gateway'

export { app } from './app'

const server = Bun.serve({
  fetch(request) {
    const url = new URL(request.url)
    const localHealth = url.hostname === '127.0.0.1' && url.pathname === `${env.apiPrefix}/health`
    return url.hostname === managementOrigin.hostname || localHealth ? app.handle(request) : handleShare(request)
  },
  hostname: listenHost,
  idleTimeout: 60,
  port: env.port,
})

if (env.authMode === 'logto' && env.logtoConfigured && env.logtoRoleChangeDatabase) {
  startLogtoRoleChangeSync(env.databaseUrl, env.logtoRoleChangeDatabase, env.logtoEndpoint)
}

console.log(`Porthole API listening on ${server.hostname}:${server.port}`)
