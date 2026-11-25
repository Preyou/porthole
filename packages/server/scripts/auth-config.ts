import { parseAppOrigin, readAuthSettings } from '../src/auth/config'

const settings = readAuthSettings(Bun.env)
console.info(JSON.stringify({
  apiPrefix: Bun.env.API_PREFIX?.trim(),
  appOrigin: parseAppOrigin(Bun.env.APP_ORIGIN),
  logtoConfigured: settings.logtoConfigured,
  mode: settings.authMode,
}))
