import type { LocaleMessageDictionary } from 'vue-i18n'
import { sysApi } from '@/api/sysApi'
import { global, resolveLocale } from '@/locales'

export function createServerLocaleLoader({ load, merge, setLocale }: {
  load: (locale: string) => Promise<LocaleMessageDictionary<Record<string, unknown>>>
  merge: (locale: string, messages: LocaleMessageDictionary<Record<string, unknown>>) => void
  setLocale: (locale: string) => void
}) {
  let selection = 0

  async function ensureServerLocale(locale: string): Promise<void> {
    // 响应缓存及同 key 在途共享交给 sysApi，只在这里合并语言资源。
    const messages = await load(locale)
    merge(locale, messages)
  }

  async function changeLocale(locale: string) {
    const currentSelection = ++selection
    setLocale(locale)
    try { await ensureServerLocale(locale) }
    catch (error) {
      // 过时请求的失败不影响当前语言；当前失败交给切换交互提供重试。
      if (currentSelection === selection) { throw error }
      return false
    }
    if (currentSelection !== selection) { return false }
    return true
  }

  return { changeLocale, ensureServerLocale }
}

export const { changeLocale, ensureServerLocale } = createServerLocaleLoader({
  async load(locale) {
    const normalized = resolveLocale(locale)
    if (normalized !== 'zh-CN' && normalized !== 'en-US') { throw new Error(`Unsupported locale: ${locale}`) }
    const { data } = await sysApi(normalized === 'zh-CN' ? '/i18n/zh-CN' : '/i18n/en-US').get({
      cacheFor: 5 * 60_000,
      notify: false,
    })
    return data
  },
  merge: (locale, messages) => global.mergeLocaleMessage(locale, messages),
  setLocale: locale => global.locale.value = locale,
})
