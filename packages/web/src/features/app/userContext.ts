import type { ComputedRef } from 'vue'
import type { GetUsersMeResponse } from '@/api/auto'
import { createContext } from '@ngt/ui/utils'
import { computed, readonly, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { sysApi } from '@/api/sysApi'
import { FALLBACK_LOCALE, global } from '@/locales'
import { ensureServerLocale } from '@/locales/server'

export type CurrentUser = Readonly<GetUsersMeResponse['data']>

interface UserContext {
  user: ComputedRef<CurrentUser | undefined>
  refresh: () => Promise<void>
}

const { provideContext, useContext: useUserContext } = createContext<Readonly<UserContext>>()
export { useUserContext }

export async function provideUserContext() {
  const currentUser = shallowRef<CurrentUser>()
  const context: Readonly<UserContext> = Object.freeze({
    async refresh() {
      const response = await sysApi('/users/me').get({ forceRequest: true })
      currentUser.value = readonly(response.data)
    },
    user: computed(() => currentUser.value),
  })
  // 注入在首次 await 前完成，Suspense 会等待首个用户请求后再挂载后代组件。
  provideContext(context)
  // 字典在受保护区域内加载，欢迎页不依赖服务端。
  const loadLocale = async (locale: string) => {
    try { await ensureServerLocale(locale) }
    catch { toast.error(global.t('common.localeLoadFailed'), { action: { label: global.t('common.retry'), onClick: () => void loadLocale(locale) } }) }
  }
  void loadLocale(FALLBACK_LOCALE)
  watch(() => String(global.locale.value), (locale) => {
    if (locale !== FALLBACK_LOCALE) { void loadLocale(locale) }
  }, { immediate: true })
  await context.refresh()
  return context
}
