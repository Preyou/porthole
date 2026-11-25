import type { AuthMode } from './auth/config'
import { parseAppOrigin, readAuthSettings } from './auth/config'

export { AUTH_MODES } from './auth/config'

type RawEnv = Record<string, string | undefined>

const APP_REQUIRED_KEYS = [
  'API_PREFIX',
  'APP_ORIGIN',
  'DATABASE_URL',
  'NODE_ENV',
  'OPENAPI_URL',
  'PORT',
  'REDIS_URL',
] as const

export type NodeEnv = 'development' | 'production' | 'test'

export interface ServerEnv {
  apiPrefix: string
  authMode: AuthMode
  databaseUrl: string
  host?: string
  idempotencyTtlMs?: number
  logFileDir?: string
  logFileMaxBytes?: number
  logFileRetentionDays?: number
  logMask?: number
  nodeEnv: NodeEnv
  openapiUrl: string
  port: number
  portholeBindHost?: string
  portholeShareDomain?: string
  redisUrl: string
  authLoginTtlSeconds: number
  authSessionTtlSeconds: number
  logtoAppId: string
  logtoAppSecret: string
  logtoConfigured: boolean
  logtoEndpoint: string
  logtoApiResource: string
  logtoApiScope: string
  logtoRoleChangeDatabase?: string
  logtoWebhookSigningKey?: string
  appOrigin: string
}

const rawEnv = import.meta.env as unknown as RawEnv

function normalizeText(input: string | undefined) {
  const normalized = input?.trim()
  return normalized || undefined
}

function ensureRequired(raw: RawEnv, keys: readonly string[]) {
  const missing = keys.filter((key) => {
    const value = normalizeText(raw[key])
    return !value
  })

  if (missing.length > 0) {
    throw new Error(`[env] Missing required env vars: ${missing.join(', ')}`)
  }
}

function parseIntEnv(
  key: string,
  value: string,
  options: {
    max?: number
    min?: number
  } = {},
) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) {
    throw new TypeError(`[env] ${key} must be an integer, got "${value}"`)
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`[env] ${key} must be >= ${options.min}, got "${parsed}"`)
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`[env] ${key} must be <= ${options.max}, got "${parsed}"`)
  }

  return parsed
}

function parseOptionalIntEnv(
  key: string,
  input: string | undefined,
  options: {
    max?: number
    min?: number
  } = {},
) {
  const value = normalizeText(input)
  if (!value) {
    return undefined
  }

  return parseIntEnv(key, value, options)
}

function parseNodeEnv(input: string): NodeEnv {
  const value = input.toLowerCase()
  if (value === 'development' || value === 'production' || value === 'test') {
    return value
  }

  throw new Error(`[env] NODE_ENV must be development|test|production, got "${input}"`)
}

function parsePathEnv(key: string, input: string) {
  const value = input.trim()
  if (!value.startsWith('/')) {
    throw new Error(`[env] ${key} must start with "/", got "${input}"`)
  }

  return value
}

function parseServerEnv(raw: RawEnv): ServerEnv {
  ensureRequired(raw, APP_REQUIRED_KEYS)

  const nodeEnv = parseNodeEnv(raw.NODE_ENV as string)
  const apiPrefix = parsePathEnv('API_PREFIX', raw.API_PREFIX as string)
  const openapiUrl = parsePathEnv('OPENAPI_URL', raw.OPENAPI_URL as string)
  const port = parseIntEnv('PORT', raw.PORT as string, {
    max: 65535,
    min: 1,
  })
  const databaseUrl = (raw.DATABASE_URL as string).trim()
  const logMask = parseOptionalIntEnv('LOG_MASK', raw.LOG_MASK, { min: 0 })
  const logFileDir = normalizeText(raw.LOG_FILE_DIR)
  const logFileMaxBytes = parseOptionalIntEnv('LOG_FILE_MAX_BYTES', raw.LOG_FILE_MAX_BYTES, { min: 1 })
  const logFileRetentionDays = parseOptionalIntEnv('LOG_FILE_RETENTION_DAYS', raw.LOG_FILE_RETENTION_DAYS, { min: 1 })
  const idempotencyTtlMs = parseOptionalIntEnv('IDEMPOTENCY_TTL_MS', raw.IDEMPOTENCY_TTL_MS, { min: 1 })
  const appOrigin = parseAppOrigin(raw.APP_ORIGIN)!
  const auth = readAuthSettings(raw)
  const logtoWebhookSigningKey = normalizeText(raw.LOGTO_WEBHOOK_SIGNING_KEY)
  if (nodeEnv === 'production' && auth.authMode === 'logto' && auth.logtoConfigured && !logtoWebhookSigningKey) {
    throw new Error('[env] LOGTO_WEBHOOK_SIGNING_KEY is required for production Logto authentication')
  }
  return {
    ...auth,
    apiPrefix,
    appOrigin,
    authLoginTtlSeconds: parseIntEnv('AUTH_LOGIN_TTL_SECONDS', raw.AUTH_LOGIN_TTL_SECONDS ?? '600', { min: 60 }),
    authSessionTtlSeconds: parseIntEnv('AUTH_SESSION_TTL_SECONDS', raw.AUTH_SESSION_TTL_SECONDS ?? '2592000', { min: 60 }),
    databaseUrl,
    host: normalizeText(raw.HOST),
    idempotencyTtlMs,
    logFileDir,
    logFileMaxBytes,
    logFileRetentionDays,
    logMask,
    logtoApiScope: normalizeText(raw.LOGTO_API_SCOPE) ?? 'api',
    logtoRoleChangeDatabase: normalizeText(raw.LOGTO_ROLE_CHANGE_DATABASE),
    logtoWebhookSigningKey,
    nodeEnv,
    openapiUrl,
    port,
    portholeBindHost: normalizeText(raw.PORTHOLE_BIND_HOST),
    portholeShareDomain: normalizeText(raw.PORTHOLE_SHARE_DOMAIN),
    redisUrl: raw.REDIS_URL as string,
  }
}

const env: Readonly<ServerEnv> = Object.freeze(parseServerEnv(rawEnv))

export default env
