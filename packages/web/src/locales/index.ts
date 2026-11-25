import messages from '@intlify/unplugin-vue-i18n/messages'
import { registerUiLocales } from '@ngt/ui/locales'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import * as z from 'zod'

const DEFAULT_LOCALE = 'zh-CN'
export const FALLBACK_LOCALE = 'en-US'
const availableLocales = Object.keys(messages ?? {})

export function resolveLocale(candidate: string | null | undefined): string | null {
  const normalizedCandidate = candidate?.trim().toLowerCase()
  if (!normalizedCandidate) {
    return null
  }

  const exactMatch = availableLocales.find(locale => locale.toLowerCase() === normalizedCandidate)
  if (exactMatch) {
    return exactMatch
  }

  const language = normalizedCandidate.split('-')[0]
  if (!language) {
    return null
  }

  return availableLocales.find(locale => locale.toLowerCase().startsWith(`${language}-`)) ?? null
}

function getBrowserLocale(): string | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  for (const language of navigator.languages) {
    const resolvedLocale = resolveLocale(language)
    if (resolvedLocale) {
      return resolvedLocale
    }
  }

  return resolveLocale(navigator.language)
}

const initialLocale = getBrowserLocale()
  ?? DEFAULT_LOCALE

export const i18n = createI18n({
  fallbackLocale: FALLBACK_LOCALE,
  legacy: false,
  locale: initialLocale,
  messages,
})

registerUiLocales(i18n)

export const global = i18n.global

watch(
  global.locale,
  (locale) => {
    const resolvedLocale = resolveLocale(String(locale)) ?? DEFAULT_LOCALE
    if (locale !== resolvedLocale) {
      global.locale.value = resolvedLocale
      return
    }

    const normalizedLocale = resolvedLocale.toLowerCase()
    z.config(
      normalizedLocale.startsWith('zh-cn')
        ? z.locales.zhCN()
        : normalizedLocale.startsWith('zh-tw')
          ? z.locales.zhTW()
          : z.locales.en(),
    )

    if (typeof document !== 'undefined') {
      document.documentElement.lang = resolvedLocale
    }
  },
  { immediate: true },
)
