import type {
  FailureResponseCode,
  RegisteredResponseCode,
  ResponseCodeDefinition,
  ResponseCodeMap,
  SuccessResponseCode,
} from '@/constants/responseCodeMap'
import { Elysia } from 'elysia'
import { z } from 'zod'
import {
  DEFAULT_ERROR_CODE,
  DEFAULT_SUCCESS_CODE,
  RESPONSE_CODE_MAP,
  RESPONSE_CODES,
} from '@/constants/responseCodeMap'
import { RESPONSE_CODE_ERROR_BRAND, ResponseCodeError } from '@/errors/responseCode'

export { ResponseCodeError } from '@/errors/responseCode'

export interface ResponseEnvelope<D = unknown> {
  code: RegisteredResponseCode
  data: D
  message: string
}

export interface FormatResponsePluginOptions {
  codeMap?: ResponseCodeMap
  defaultErrorCode?: FailureResponseCode
  defaultSuccessCode?: SuccessResponseCode
}

function resolveCodeDefinition(
  codeMap: ResponseCodeMap,
  code: RegisteredResponseCode,
  defaultErrorCode: RegisteredResponseCode,
) {
  return codeMap[code]
    ?? codeMap[defaultErrorCode]
    ?? {
      httpStatus: 500,
    } satisfies ResponseCodeDefinition
}

function hasOwn(obj: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function isResponseCodeError(error: unknown): error is ResponseCodeError {
  if (error instanceof ResponseCodeError) {
    return true
  }

  if (!error || typeof error !== 'object') {
    return false
  }

  if (!hasOwn(error, RESPONSE_CODE_ERROR_BRAND)) {
    return false
  }

  return typeof (error as ResponseCodeError).code === 'number'
}

export function resolveErrorCode(
  codeMap: ResponseCodeMap,
  error: unknown,
  fallback: RegisteredResponseCode,
) {
  if (!isResponseCodeError(error)) {
    return fallback
  }

  if (!codeMap[error.code]) {
    return fallback
  }

  return error.code
}

export function unwrapResponseCodeError(error: unknown) {
  const visited = new Set<unknown>()
  let current = error
  // ORM 会包装驱动错误；保留根错误供日志记录，响应识别其中的已知业务码。
  while (current instanceof Error && !visited.has(current)) {
    if (isResponseCodeError(current)) { return current }
    visited.add(current)
    current = current.cause
  }
  return error
}

export function createFormatResponsePlugin(options: FormatResponsePluginOptions = {}) {
  const codeMap: ResponseCodeMap = {
    ...RESPONSE_CODE_MAP,
    ...(options.codeMap ?? {}),
  }
  const defaultSuccessCode = options.defaultSuccessCode ?? DEFAULT_SUCCESS_CODE
  const defaultErrorCode = options.defaultErrorCode ?? DEFAULT_ERROR_CODE

  return new Elysia({
    name: 'response-format',
  })
    .decorate('format', <D = unknown>(
      data: D,
      code: RegisteredResponseCode = defaultSuccessCode,
      message = '',
    ): ResponseEnvelope<D> => ({
      code,
      data,
      message,
    }))
    .guard({
      schema: 'standalone',
    })
    .onAfterHandle((context) => {
      if (context.responseValue instanceof Response) { return }

      const raw = context.responseValue as ResponseEnvelope<unknown>
      const definition = resolveCodeDefinition(codeMap, raw.code, defaultErrorCode)

      const formattedResponse = {
        code: raw.code,
        data: raw.data,
        message: raw.message ?? '',
      } satisfies ResponseEnvelope
      context.set.status = definition.httpStatus

      return formattedResponse
    })
    .onError((context) => {
      const error = unwrapResponseCodeError(context.error)
      const code = context.code === 'NOT_FOUND' ? RESPONSE_CODES.NOT_FOUND : context.code === 'VALIDATION' && context.error.type !== 'response' ? RESPONSE_CODES.INVALID_INPUT : resolveErrorCode(codeMap, error, defaultErrorCode)
      const definition = resolveCodeDefinition(codeMap, code, defaultErrorCode)

      const response = {
        code,
        data: null,
        message: error instanceof Error ? error.message : '',
      } satisfies ResponseEnvelope

      return context.status(definition.httpStatus, response)
    })
    .as('scoped')
}

export function responseDTO<TSchema extends z.ZodType>(schema: TSchema) {
  return z.object({
    code: z.number().int().min(10000000).max(29999999),
    data: schema,
    message: z.string(),
  })
}
