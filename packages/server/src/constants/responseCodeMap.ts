export interface ResponseCodeDefinition { httpStatus: number }
export type ResponseCodeMap = Record<number, ResponseCodeDefinition>

export const RESPONSE_CODES = {
  AUTH_IDENTITY_NOT_PROVISIONED: 10000014,
  AUTH_PROVIDER_NOT_CONFIGURED: 10000015,
  AUTH_TOO_MANY_ATTEMPTS: 10000429,
  BAD_REQUEST: 10000400,
  CONFLICT: 10000409,
  CREATED: 20000001,
  FORBIDDEN: 10000403,
  INTERNAL_ERROR: 10000000,
  INVALID_INPUT: 10000422,
  INVALID_SORT_FIELD: 10000011,
  INVALID_SORT_ORDER: 10000013,
  NOT_FOUND: 10000404,
  SERVICE_UNAVAILABLE: 10000503,
  SORT_FIELD_REQUIRED: 10000012,
  SUCCESS: 20000000,
  UNAUTHORIZED: 10000401,
  UNKNOWN_QUERY_KEYS: 10000010,
} as const

export const RESPONSE_CODE_SCOPE_RULES = { failure: '1xxxxxxx', success: '2xxxxxxx' } as const

export const SUCCESS_RESPONSE_CODE_MAP = {
  [RESPONSE_CODES.CREATED]: { httpStatus: 201 },
  [RESPONSE_CODES.SUCCESS]: { httpStatus: 200 },
} as const satisfies ResponseCodeMap

export const BUSINESS_ERROR_RESPONSE_CODE_MAP = {
  [RESPONSE_CODES.AUTH_IDENTITY_NOT_PROVISIONED]: { httpStatus: 403 },
  [RESPONSE_CODES.AUTH_TOO_MANY_ATTEMPTS]: { httpStatus: 429 },
  [RESPONSE_CODES.BAD_REQUEST]: { httpStatus: 400 },
  [RESPONSE_CODES.CONFLICT]: { httpStatus: 409 },
  [RESPONSE_CODES.FORBIDDEN]: { httpStatus: 403 },
  [RESPONSE_CODES.INVALID_INPUT]: { httpStatus: 422 },
  [RESPONSE_CODES.INVALID_SORT_FIELD]: { httpStatus: 400 },
  [RESPONSE_CODES.INVALID_SORT_ORDER]: { httpStatus: 400 },
  [RESPONSE_CODES.NOT_FOUND]: { httpStatus: 404 },
  [RESPONSE_CODES.SORT_FIELD_REQUIRED]: { httpStatus: 400 },
  [RESPONSE_CODES.UNAUTHORIZED]: { httpStatus: 401 },
  [RESPONSE_CODES.UNKNOWN_QUERY_KEYS]: { httpStatus: 400 },
} as const satisfies ResponseCodeMap

export const SYSTEM_ERROR_RESPONSE_CODE_MAP = {
  [RESPONSE_CODES.AUTH_PROVIDER_NOT_CONFIGURED]: { httpStatus: 503 },
  [RESPONSE_CODES.INTERNAL_ERROR]: { httpStatus: 500 },
  [RESPONSE_CODES.SERVICE_UNAVAILABLE]: { httpStatus: 503 },
} as const satisfies ResponseCodeMap

export const RESPONSE_CODE_MAP = { ...SUCCESS_RESPONSE_CODE_MAP, ...BUSINESS_ERROR_RESPONSE_CODE_MAP, ...SYSTEM_ERROR_RESPONSE_CODE_MAP } as const satisfies ResponseCodeMap
export type SuccessResponseCode = keyof typeof SUCCESS_RESPONSE_CODE_MAP
export type BusinessErrorResponseCode = keyof typeof BUSINESS_ERROR_RESPONSE_CODE_MAP
export type SystemErrorResponseCode = keyof typeof SYSTEM_ERROR_RESPONSE_CODE_MAP
export type FailureResponseCode = BusinessErrorResponseCode | SystemErrorResponseCode
export type RegisteredResponseCode = SuccessResponseCode | FailureResponseCode
export const DEFAULT_SUCCESS_CODE = RESPONSE_CODES.SUCCESS
export const DEFAULT_ERROR_CODE = RESPONSE_CODES.INTERNAL_ERROR
