import type { AuthContext } from './session'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import env from '@/env'
import { ResponseCodeError } from '@/errors/responseCode'
import { createRedisConnection } from '@/redis/client'
import { createLocalAuth } from './local'
import { createAuthManager, LOGIN_COOKIE_NAME as defaultLoginCookieName } from './manager'
import { SESSION_COOKIE_NAME as defaultSessionCookieName } from './session'
import { createRedisAuthStateStore } from './stateStore'

// HTTPS 管理入口和分享子域属于同一站点，主机前缀阻止子域设置父域认证 Cookie。
const secure = new URL(env.appOrigin).protocol === 'https:'
export const LOGIN_COOKIE_NAME = secure ? '__Host-porthole_login' : defaultLoginCookieName
export const SESSION_COOKIE_NAME = secure ? '__Host-porthole_session' : defaultSessionCookieName

const redis = env.authMode === 'local' || (env.authMode === 'logto' && env.logtoConfigured)
  ? createRedisConnection(env.redisUrl)
  : undefined
const namespace = `yuumi:${env.nodeEnv}:auth`
// 沿用线上会话命名空间，已有登录会话继续有效。
export const logtoSessionNamespace = `${namespace}:porthole-role:v1`
const logto = env.authMode === 'logto' && redis
  ? createAuthManager({
      apiPrefix: env.apiPrefix,
      appOrigin: env.appOrigin,
      clientId: env.logtoAppId,
      clientSecret: env.logtoAppSecret,
      endpoint: env.logtoEndpoint,
      loginCookieName: LOGIN_COOKIE_NAME,
      loginTtlSeconds: env.authLoginTtlSeconds,
      resource: env.logtoApiResource,
      scope: env.logtoApiScope,
      sessionCookieName: SESSION_COOKIE_NAME,
      sessionIssuer: env.logtoWebhookSigningKey ? `${env.logtoEndpoint}/oidc` : undefined,
      sessionTtlSeconds: env.authSessionTtlSeconds,
      stateStore: createRedisAuthStateStore(redis, logtoSessionNamespace),
    })
  : undefined
const localNamespace = `${namespace}:local`
const local = env.authMode === 'local' && redis
  ? createLocalAuth({
      appOrigin: env.appOrigin,
      namespace: localNamespace,
      redis,
      sessionCookieName: SESSION_COOKIE_NAME,
      sessionTtlSeconds: env.authSessionTtlSeconds,
      stateStore: createRedisAuthStateStore(redis, localNamespace),
    })
  : undefined

function requireLogto() {
  if (env.authMode !== 'logto') { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }
  if (!logto) { throw new ResponseCodeError(RESPONSE_CODES.AUTH_PROVIDER_NOT_CONFIGURED) }
  return logto
}

function requireLocal() {
  if (!local) { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }
  return local
}

export const authConfig = { configured: Boolean(logto || local), mode: env.authMode }

export const authManager = {
  async authenticate(request: Request): Promise<AuthContext> {
    const active = logto ?? local
    if (!active) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
    return active.authenticate(request)
  },
  completeLogin: (request: Request) => requireLogto().completeLogin(request),
  loginLocal: (request: Request, input: { password: string, username: string }) => requireLocal().login(request, input),
  logout: (request: Request) => env.authMode === 'local' ? requireLocal().logout(request) : requireLogto().logout(request),
  provision: (request: Request) => requireLogto().provision(request),
  startLogin: (returnTo?: string) => requireLogto().startLogin(returnTo),
}

export type { AuthManagerOptions } from './manager'
export type { AuthContext, AuthUser } from './session'
export type { AuthStateStore, LoginTransaction } from './stateStore'
