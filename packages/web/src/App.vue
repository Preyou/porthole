<script setup lang="ts">
import { Button } from '@ngt/ui/button'
import { ThemeProvider, useTheme } from '@ngt/ui/domains/theme'
import { Toaster } from '@ngt/ui/sonner'
import { Text } from '@ngt/ui/text'
import { ConfigProvider } from 'reka-ui'
import { resolveRequestErrorMessage } from '@/api/sysApi'
import { initializeAppPreferences } from '@/app/preferences'
import { appThemes } from '@/assets/themes'
import 'vue-sonner/style.css'

const { registerThemes, theme } = useTheme()
registerThemes(appThemes, { overwrite: true })
initializeAppPreferences()

const { locale, t } = useI18n({ useScope: 'global' })
const routeError = shallowRef<unknown>()
const route = useRoute()
onErrorCaptured((error) => {
  routeError.value = error
  return false
})
watch(() => route.fullPath, () => { routeError.value = undefined })
function retryRoute() { window.location.reload() }

// 部署配置来自运行时边界，在应用入口统一收窄为 Sonner 支持的值。
const toastPosition = z.enum([
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]).catch('top-right').parse(import.meta.env.VITE_TOAST_POSITION)
const toastDuration = z.coerce.number().positive().catch(4000).parse(import.meta.env.VITE_TOAST_DURATION_MS)
</script>

<template>
  <ConfigProvider :locale="String(locale)">
    <ThemeProvider :theme="theme" global>
      <main v-if="routeError" role="alert" class="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-4 px-6">
        <Text>{{ resolveRequestErrorMessage(routeError) }}</Text>
        <Button variant="outline" @click="retryRoute">
          {{ t('common.retry') }}
        </Button>
      </main>
      <RouterView v-else v-slot="{ Component }">
        <Suspense :timeout="0">
          <component :is="Component" />
          <template #fallback>
            <main aria-busy="true" class="flex h-full min-w-0 flex-1 items-center justify-center">
              <Text role="status">
                {{ t('common.loading') }}
              </Text>
            </main>
          </template>
        </Suspense>
      </RouterView>
      <Toaster :duration="toastDuration" :position="toastPosition" />
    </ThemeProvider>
  </ConfigProvider>
</template>
