import { isAxiosError } from 'axios'

export function localSignInErrorKey(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 401) { return 'auth.invalidCredentials' }
  if (status === 429) { return 'auth.rateLimited' }
  return 'common.requestFailed'
}
