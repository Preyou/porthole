import { useTitle } from '@vueuse/core'
import { createRouter, createWebHistory } from 'vue-router'
import { handleHotUpdate, routes } from 'vue-router/auto-routes'
import { global } from '@/locales'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

useTitle(() => {
  const { title, titleKey } = router.currentRoute.value.meta
  const routeTitle = typeof titleKey === 'string' && titleKey.length > 0
    ? global.t(titleKey)
    : typeof title === 'string' && title.length > 0
      ? title
      : null

  return routeTitle
    ? `${routeTitle} · ${import.meta.env.APP_NAME}`
    : import.meta.env.APP_NAME
})

if (import.meta.hot) {
  handleHotUpdate(router)
}
