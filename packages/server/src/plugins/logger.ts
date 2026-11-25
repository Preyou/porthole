import type { DestinationStream } from 'pino'
import process from 'node:process'
import { wrap } from '@bogeychan/elysia-logger'
import { Elysia, ValidationError } from 'elysia'
import { getStream } from 'file-stream-rotator'
import pino from 'pino'
import { configure } from 'safe-stable-stringify'
import env from '@/env'

export const LogBits = {
  ERROR: 1 << 6,
  ERROR_REQUEST: 1 << 11,
  ERROR_RESPONSE: 1 << 12,
  MANUAL: 1 << 9,
  REQUEST: 1 << 0,
  REQUEST_BODY: 1 << 1,
  REQUEST_HEADERS: 1 << 2,
  RESPONSE: 1 << 3,
  RESPONSE_BODY: 1 << 4,
  RESPONSE_HEADERS: 1 << 5,
  // 0 is reserved as an explicit silent sentinel.
  SILENT: 0,
  TIMING: 1 << 7,
  TRACE_STEP: 1 << 8,
  WRITE_FILE: 1 << 10,
} as const

export type LogBitMask = number
export type UseLoggerOption = LogBitMask | boolean

const KNOWN_LOG_MASK = (
  LogBits.ERROR
  | LogBits.ERROR_REQUEST
  | LogBits.ERROR_RESPONSE
  | LogBits.MANUAL
  | LogBits.REQUEST
  | LogBits.REQUEST_BODY
  | LogBits.REQUEST_HEADERS
  | LogBits.RESPONSE
  | LogBits.RESPONSE_BODY
  | LogBits.RESPONSE_HEADERS
  | LogBits.TIMING
  | LogBits.TRACE_STEP
  | LogBits.WRITE_FILE
)

export const LOG_BITS_PROTOCOL = {
  // Frozen allocation map: bits 0-12 are assigned, bits 13-30 reserved for future use.
  reservedFromBit: 13,
  reservedToBit: 30,
  version: 1,
} as const

const MASK_INFO = (
  LogBits.REQUEST
  | LogBits.REQUEST_BODY
  | LogBits.RESPONSE
  | LogBits.RESPONSE_BODY
  | LogBits.ERROR
  | LogBits.TIMING
  | LogBits.MANUAL
)

const MASK_TRACE = (
  LogBits.REQUEST
  | LogBits.REQUEST_BODY
  | LogBits.REQUEST_HEADERS
  | LogBits.RESPONSE
  | LogBits.RESPONSE_BODY
  | LogBits.RESPONSE_HEADERS
  | LogBits.ERROR
  | LogBits.TIMING
  | LogBits.TRACE_STEP
  | LogBits.MANUAL
)

const MASK_ERROR_CONTEXT = (
  LogBits.ERROR
  | LogBits.ERROR_REQUEST
  | LogBits.ERROR_RESPONSE
  | LogBits.TIMING
  | LogBits.MANUAL
)

export const LogMasks = {
  DEV_DEFAULT: MASK_INFO,
  ERROR_CONTEXT: MASK_ERROR_CONTEXT,
  FILE_ERROR_CONTEXT: MASK_ERROR_CONTEXT | LogBits.WRITE_FILE,
  FILE_INFO: MASK_INFO | LogBits.WRITE_FILE,
  FILE_TRACE: MASK_TRACE | LogBits.WRITE_FILE,
  INFO: MASK_INFO,
  MANUAL_ONLY: LogBits.MANUAL,
  PROD_DEFAULT: MASK_ERROR_CONTEXT | LogBits.WRITE_FILE,
  SILENT: LogBits.SILENT,
  TRACE: MASK_TRACE,
} as const

export interface LoggerPluginOptions {
  logsDir?: string
  logsMaxBytes?: number
  logsRetentionDays?: number
  mask?: LogBitMask
  traceIdHeader?: string
  redactKeys?: readonly string[]
  redactPlaceholder?: string
  stream?: DestinationStream
}

export function bits(...values: number[]) {
  return values.reduce((mask, value) => mask | value, 0)
}

export function createLoggerPlugin({
  logsDir = env.logFileDir,
  logsMaxBytes = env.logFileMaxBytes ?? 100 * 1024,
  logsRetentionDays = env.logFileRetentionDays,
  mask: configuredMask = env.logMask ?? (env.nodeEnv === 'development' ? LogMasks.DEV_DEFAULT : LogMasks.PROD_DEFAULT),
  redactKeys = [],
  redactPlaceholder = '[REDACTED]',
  stream = process.stdout,
  traceIdHeader = 'x-trace-id',
}: LoggerPluginOptions = {}) {
  const mask = configuredMask & KNOWN_LOG_MASK
  const secrets = new Set(['accessToken', 'authorization', 'cookie', 'jwt', 'password', 'policy', 'refreshToken', 'secret', 'set-cookie', 'token', 'x-amz-credential', 'x-amz-security-token', 'x-amz-signature', ...redactKeys].map(key => key.toLowerCase()))
  const stringify = configure({ maximumBreadth: 100, maximumDepth: 8 })
  const options = {
    formatters: {
      log(value: Record<string, unknown>) {
        // 深层脱敏是项目策略；循环引用与遍历限额交给成熟序列化库。
        return JSON.parse(stringify(value, (key, item) => {
          if (secrets.has(key.toLowerCase())) { return redactPlaceholder }
          if (item instanceof ValidationError) { return { message: `${item.type} validation failed`, name: item.name } }
          if (item instanceof Error) { return pino.stdSerializers.err(item) }
          return item
        }) as string)
      },
    },
    level: 'trace',
  }
  const consoleLogger = pino(options, stream)
  let fileStream: ReturnType<typeof getStream> | undefined
  let fileLogger: typeof consoleLogger | undefined
  let warnedMissingDir = false
  const requests = new WeakMap<Request, { mask: number, startedAt: number, traceId: string }>()

  function requestState(request: Request) {
    let state = requests.get(request)
    if (!state) {
      const incoming = request.headers.get(traceIdHeader)?.trim()
      state = {
        mask,
        startedAt: performance.now(),
        traceId: incoming && /^(?!0{32})[\da-f]{32}$/i.test(incoming)
          ? incoming.toLowerCase()
          : request.headers.get('traceparent')?.match(/^(?!ff)[\da-f]{2}-((?!0{32})[\da-f]{32})-(?!0{16})[\da-f]{16}-[\da-f]{2}$/i)?.[1]?.toLowerCase() ?? crypto.randomUUID().replaceAll('-', ''),
      }
      requests.set(request, state)
    }
    return state
  }

  function requestLogger(request: Request) {
    const state = requestState(request)
    if ((state.mask & LogBits.WRITE_FILE) && !fileLogger) {
      if (logsDir) {
        fileStream = getStream({
          audit_file: `${logsDir}/.rotation-audit.json`,
          date_format: 'YYYY-MM-DD',
          end_stream: true,
          extension: '.log',
          filename: `${logsDir}/%DATE%`,
          frequency: 'daily',
          max_logs: logsRetentionDays === undefined ? undefined : `${logsRetentionDays}d`,
          size: `${logsMaxBytes / 1024}k`,
        })
        fileStream.on('error', (error) => {
          consoleLogger.fatal({ err: error }, '日志文件写入失败')
          process.exit(1)
        })
        fileLogger = pino(options, pino.multistream([{ level: 'trace', stream }, { level: 'trace', stream: fileStream }]))
      }
      else if (!warnedMissingDir) {
        warnedMissingDir = true
        consoleLogger.warn('WRITE_FILE 已启用，但未配置 LOG_FILE_DIR')
      }
    }
    return ((state.mask & LogBits.WRITE_FILE) && fileLogger ? fileLogger : consoleLogger).child({
      method: request.method,
      path: new URL(request.url).pathname,
      traceId: state.traceId,
    }, { level: state.mask === 0 ? 'silent' : 'trace' })
  }

  return new Elysia({ name: 'logger-plugin' })
    .onRequest(({ request, set }) => {
      set.headers[traceIdHeader] = requestState(request).traceId
    })
    .use(wrap(consoleLogger, { autoLogging: false }))
    .derive({ as: 'global' }, ({ request }) => ({ traceId: requestState(request).traceId }))
    .macro({
      useLogger: (routeOptions: UseLoggerOption = true) => ({
        transform({ request }) {
          requestState(request).mask = routeOptions === true ? mask : routeOptions === false ? 0 : routeOptions & KNOWN_LOG_MASK
        },
      }),
    })
    .resolve(({ request }) => ({
      log: requestLogger(request).child({}, { level: requestState(request).mask & LogBits.MANUAL ? 'trace' : 'silent' }),
    }))
    .onBeforeHandle(({ body, params, query, request }) => {
      const state = requestState(request)
      if (state.mask & LogBits.TRACE_STEP) { requestLogger(request).trace({ stage: 'handler:start' }) }
      if (state.mask & (LogBits.REQUEST | LogBits.REQUEST_BODY | LogBits.REQUEST_HEADERS)) {
        requestLogger(request).info({
          ...(state.mask & LogBits.REQUEST ? { params, query } : {}),
          ...(state.mask & LogBits.REQUEST_BODY ? { body } : {}),
          ...(state.mask & LogBits.REQUEST_HEADERS ? { headers: Object.fromEntries(request.headers) } : {}),
        }, '请求')
      }
    })
    .onAfterHandle(({ request, responseValue, set }) => {
      const state = requestState(request)
      if (state.mask & (LogBits.RESPONSE | LogBits.RESPONSE_BODY | LogBits.RESPONSE_HEADERS)) {
        requestLogger(request).info({
          status: set.status,
          ...(state.mask & LogBits.TIMING ? { durationMs: performance.now() - state.startedAt } : {}),
          ...(state.mask & LogBits.RESPONSE_BODY ? { response: responseValue } : {}),
          ...(state.mask & LogBits.RESPONSE_HEADERS ? { responseHeaders: set.headers } : {}),
        }, '响应')
      }
      if (state.mask & LogBits.TRACE_STEP) { requestLogger(request).trace({ stage: 'handler:end' }) }
    })
    .onError(({ body, code, error, params, query, request, set }) => {
      const state = requestState(request)
      if (state.mask & LogBits.ERROR) {
        requestLogger(request).error({
          code,
          err: error,
          status: set.status,
          ...(state.mask & LogBits.TIMING ? { durationMs: performance.now() - state.startedAt } : {}),
          ...(state.mask & LogBits.ERROR_REQUEST ? { body, params, query } : {}),
          // 响应校验异常携带原始 found；不能将不符合契约的响应当作错误上下文输出。
          ...(state.mask & LogBits.ERROR_RESPONSE ? { response: { code, message: error instanceof ValidationError ? `${error.type} validation failed` : 'message' in error ? error.message : String(error) } } : {}),
        }, '请求失败')
      }
      if (state.mask & LogBits.TRACE_STEP) { requestLogger(request).trace({ stage: 'handler:error' }) }
    })
    .onStop(() => { fileStream?.end('') })
    .as('scoped')
}

export default createLoggerPlugin
