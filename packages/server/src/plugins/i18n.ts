import type { I18n, LocaleDictionary } from '@/locales'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { createI18n, serverI18n } from '@/locales'
import { createFormatResponsePlugin, responseDTO } from './formatResponse'
import { createPublicAuthPlugin } from './sessionAuth'

export { createI18n } from '@/locales'

// 用静态字典展开具体 schema，避免递归 $defs 引用无法被前端 OpenAPI 生成器解析。
function dictionarySchema(dictionary: LocaleDictionary): z.ZodType {
  return z.object(Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key, typeof value === 'string' ? z.string() : dictionarySchema(value)])))
}

export function createI18nPlugin(options: Parameters<typeof createI18n>[0] | I18n = {}) {
  const instance = 'i18n' in options ? options : createI18n(options)
  return new Elysia({ name: 'i18n', seed: [instance.namespace, instance.prefix] })
    .decorate('i18n', instance.i18n)
    .use(createPublicAuthPlugin())
    .use(createFormatResponsePlugin())
    .group(instance.prefix, app => Object.entries(instance.dictionaries).reduce((app, [locale, dictionary]) => app.get(`/${locale}`, ({ format }) => format(dictionary), {
      detail: { tags: ['i18n'] },
      response: { 200: responseDTO(dictionarySchema(dictionary)) },
      useAuth: false,
    }), app).get('/:locale', ({ format }) => format(null, RESPONSE_CODES.NOT_FOUND), {
      detail: { tags: ['i18n'] },
      response: { 404: responseDTO(z.null()) },
      useAuth: false,
    }))
}

export const i18nPlugin = createI18nPlugin(serverI18n)
