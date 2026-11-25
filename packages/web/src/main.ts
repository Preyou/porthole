import { cn } from '@ngt/ui/lib/utils'
import { createApp } from 'vue'
import { toast } from 'vue-sonner'
import { sysApi } from './api/sysApi'
import { useRequest } from './api/useRequest'
import App from './App.vue'
import { initializeLocalePreferences } from './app/preferences'
import { loadingBar } from './loadingBar'
import { i18n } from './locales'
import { router } from './router'
import './assets/css/index.css'

initializeLocalePreferences()

const app = createApp(App)
app.use(router).use(i18n)

app.config.globalProperties.$api = sysApi
app.config.globalProperties.$cn = cn
app.config.globalProperties.$loadingBar = loadingBar
app.config.globalProperties.$req = useRequest
app.config.globalProperties.$toast = toast

async function bootstrap() {
  if (import.meta.env.NGT_ANNOTATIONS_ENABLED) {
    const [{ installAnnotations }, { default: config }] = await Promise.all([
      import('@ngt/vite-plugin-annotations/client'),
      import('virtual:ngt-annotations'),
    ])
    installAnnotations(app, { config, router })
    await router.isReady()
  }
  app.mount('#app')
}
void bootstrap()
