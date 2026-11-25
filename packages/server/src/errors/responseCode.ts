import type { FailureResponseCode } from '@/constants/responseCodeMap'

export const RESPONSE_CODE_ERROR_BRAND = Symbol.for('yuumi.response-code-error')

export class ResponseCodeError extends Error {
  code: FailureResponseCode
  readonly [RESPONSE_CODE_ERROR_BRAND] = true

  constructor(code: FailureResponseCode, message = '', options?: ErrorOptions) {
    super(message, options)
    this.name = 'ResponseCodeError'
    this.code = code
  }
}
