import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { ResponseCodeError } from './responseCode'

export class DependencyUnavailableError extends ResponseCodeError {
  readonly dependency: 'Database' | 'Redis'

  constructor(dependency: 'Database' | 'Redis', cause: unknown) {
    super(RESPONSE_CODES.SERVICE_UNAVAILABLE, cause instanceof Error ? cause.message : '', { cause })
    this.dependency = dependency
    this.name = 'DependencyUnavailableError'
  }
}
