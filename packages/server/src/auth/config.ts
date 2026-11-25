export const AUTH_MODES = ['off', 'logto', 'local'] as const
export type AuthMode = typeof AUTH_MODES[number]

export function parseAppOrigin(value: string | undefined) {
  if (!value?.trim()) { return undefined }
  const url = URL.parse(value.trim())
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.href !== `${url.origin}/`) {
    throw new Error('[env] APP_ORIGIN must be an HTTP origin without credentials or a path')
  }
  return url.origin
}

export function readAuthSettings(raw: Record<string, string | undefined>) {
  const authMode = raw.AUTH_MODE?.trim() || 'logto'
  if (authMode !== 'off' && authMode !== 'logto' && authMode !== 'local') {
    throw new Error('[env] AUTH_MODE must be off, logto, or local')
  }
  const logtoAppId = raw.LOGTO_APP_ID?.trim() || ''
  const logtoAppSecret = raw.LOGTO_APP_SECRET?.trim() || ''
  const logtoApiResource = raw.LOGTO_API_RESOURCE?.trim() || ''
  const logtoEndpoint = raw.LOGTO_ENDPOINT?.trim().replace(/\/$/, '') || ''
  const endpoint = URL.parse(logtoEndpoint)
  const logtoConfigured = Boolean(logtoAppId && logtoAppSecret && logtoApiResource && endpoint
    && ['http:', 'https:'].includes(endpoint.protocol) && !endpoint.username && !endpoint.password
    && !endpoint.search && !endpoint.hash)

  return { authMode, logtoApiResource, logtoAppId, logtoAppSecret, logtoConfigured, logtoEndpoint } as const
}
