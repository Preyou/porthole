import type { GetAuthConfigResponse } from './auto'

export type AuthConfiguration = GetAuthConfigResponse['data']

export function isSignInAvailable(configuration: AuthConfiguration) {
  return configuration.mode !== 'off' && configuration.configured
}
