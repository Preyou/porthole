import type { RegisteredResponseCode } from '@/constants/responseCodeMap'
import { RESPONSE_CODE_MAP } from '@/constants/responseCodeMap'
import enUS from './en-US.json'
import zhCN from './zh-CN.json'

export const locales = { 'en-US': enUS, 'zh-CN': zhCN }
export interface LocaleDictionary { [key: string]: string | LocaleDictionary }

function leafKeys(dictionary: LocaleDictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) => typeof value === 'string' ? [`${prefix}${key}`] : leafKeys(value, `${prefix}${key}.`))
}

// 静态资源完整性检查在启动时执行，不按请求加载文件。
for (const dictionary of Object.values(locales)) {
  if (leafKeys(dictionary).sort().join('\n') !== Object.keys(RESPONSE_CODE_MAP).sort().join('\n')) {
    throw new Error('Locale dictionaries must match registered response codes')
  }
}

export function createI18n({ namespace = 'server', prefix = 'i18n' }: { namespace?: string, prefix?: string } = {}) {
  return {
    dictionaries: Object.fromEntries(Object.entries(locales).map(([locale, dictionary]) => [locale, namespace ? namespace.split('.').reduceRight<LocaleDictionary>((value, key) => ({ [key]: value }), dictionary) : dictionary])),
    i18n: (code: RegisteredResponseCode) => namespace ? `${namespace}.${code}` : `${code}`,
    namespace,
    prefix: `/${prefix.replace(/^\/+|\/+$/g, '')}`,
  }
}

export type I18n = ReturnType<typeof createI18n>
export const serverI18n = createI18n()
