import type { InferAlovaGenerics } from '@ngt/ui/domains/request'
import type { PathMap } from './auto'
import { axiosRequestAdapter } from '@alova/adapter-axios'
import { createApi } from '@ngt/ui/domains/request'
import { createAlova } from 'alova'
import { isAxiosError } from 'axios'
import { toast } from 'vue-sonner'
import { FALLBACK_LOCALE, global } from '@/locales'
import { serverI18nConfig } from '@/locales/serverConfig'
import { isSignInAvailable } from './authContract'
import { zGetAuthConfigResponse } from './auto'

interface ApiEnvelope {
  code: number
  data: unknown
  message: string
}

export class BusinessResponseError extends Error {
  // 响应保留与 Axios 一致的读取路径，诊断 message 不参与用户提示。
  response: { data: ApiEnvelope }

  constructor(data: ApiEnvelope) {
    super(data?.message)
    this.name = 'BusinessResponseError'
    this.response = { data }
  }
}

export function isBusinessSuccess(value: unknown): boolean {
  const response = value as ApiEnvelope | undefined
  return typeof response?.code === 'number' && /^2\d{7}$/.test(String(response.code))
}

export function resolveNotifyMessage(value: unknown, success = false): string {
  const code = (value as ApiEnvelope | undefined)?.code
  const key = serverI18nConfig.namespace ? `${serverI18nConfig.namespace}.${code}` : String(code)
  if (global.te(key)) { return global.t(key) }
  if (global.te(key, FALLBACK_LOCALE)) { return global.t(key, {}, { locale: FALLBACK_LOCALE }) }
  return global.t(success ? 'common.requestSucceeded' : 'common.requestFailed')
}

export function resolveRequestErrorMessage(error: unknown): string {
  if (error instanceof BusinessResponseError) { return resolveNotifyMessage(error.response.data) }
  if (isAxiosError(error)) {
    if (error.response) { return resolveNotifyMessage(error.response.data) }
    if (error.code === 'ECONNABORTED') { return global.t('common.requestTimedOut') }
  }
  return global.t('common.requestFailed')
}

export const alovaInstance = createAlova({
  baseURL: import.meta.env.VITE_SYS_API_BASE_URL,
  beforeRequest(method) {
    method.config.withCredentials = true
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(method.type.toUpperCase())
    const hasIdempotencyKey = Object.keys(method.config.headers ?? {}).some(key => key.toLowerCase() === 'idempotency-key')
    method.config.headers = {
      ...(method.config.headers ?? {}),
      Accept: 'application/json',
      ...(mutation && !hasIdempotencyKey ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    }
  },
  requestAdapter: axiosRequestAdapter(),
  responded: {
    async onError(error, method) {
      if (!isAxiosError(error) || error.response?.status !== 401
        || method.url === '/auth/config' || method.url === '/auth/login/local'
        || window.location.pathname === '/auth/sign-in') {
        throw error
      }

      // 认证切换后旧页面仍可能收到 401，跳转前以当前服务端状态为准。
      try {
        const configuration = await readAuthConfiguration()
        if (isSignInAvailable(configuration)) { window.location.replace('/auth/sign-in') }
      }
      catch { throw error }
      throw error
    },
    onSuccess: ({ data }) => {
      if (!isBusinessSuccess(data)) { throw new BusinessResponseError(data as ApiEnvelope) }
      return data
    },
  },
  timeout: import.meta.env.VITE_SYS_API_TIMEOUT,
})

export const sysApi = createApi<PathMap, InferAlovaGenerics<typeof alovaInstance>>(alovaInstance, {
  notify: {
    defaultError: true,
    defaultSuccess: ({ method }) => {
      const normalizedMethod = method.toLowerCase()
      return normalizedMethod !== 'get' && normalizedMethod !== 'head' && normalizedMethod !== 'options'
    },
    getErrorMessage(response, error) {
      if (response) { return resolveNotifyMessage(response) }
      return global.t(isAxiosError(error) && error.code === 'ECONNABORTED' ? 'common.requestTimedOut' : 'common.requestFailed')
    },
    getSuccessMessage(response) {
      return resolveNotifyMessage(response, true)
    },
    isBusinessSuccess,
    onError(message) {
      toast.error(message)
    },
    onSuccess(message) {
      toast.success(message)
    },
  },
})

export function readAuthConfiguration() {
  return sysApi('/auth/config').get({
    cacheFor: 0,
    notify: false,
    transform: response => zGetAuthConfigResponse.parse(response).data,
  })
}
