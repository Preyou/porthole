import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import {
  injectHttp404Routes,
  injectRouteGroupMeta,
} from '@ngt/ui/utils'
import annotations from '@ngt/vite-plugin-annotations'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import { envParse } from 'vite-plugin-env-parse'
import lucidePreprocess from 'vite-plugin-lucide-preprocess'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'

function resolveDevServer(env: Record<string, string>) {
  const port = Number(env.DEV_WEB_PORT?.trim() || '1282')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DEV_WEB_PORT must be an integer between 1 and 65535')
  }
  const target = new URL(env.DEV_API_ORIGIN?.trim() || env.API_ORIGIN?.trim() || 'http://127.0.0.1:3100')
  if (!['http:', 'https:'].includes(target.protocol) || target.href !== `${target.origin}/`) {
    throw new Error('The proxy target (DEV_API_ORIGIN or API_ORIGIN) must be an HTTP(S) origin without credentials or a path')
  }
  return {
    host: env.DEV_WEB_HOST?.trim() || undefined,
    port,
    proxy: { '^/api(?:/|\\?|$)': { changeOrigin: true, target: target.origin } },
    strictPort: true,
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, 'env', '')
  const appName = env.APP_NAME?.trim() || 'app'
  const appRoot = dirname(fileURLToPath(import.meta.url))
  const server = resolveDevServer(env)
  return {
    define: {
      'import.meta.env.APP_NAME': JSON.stringify(appName),
    },
    envDir: 'env',
    optimizeDeps: {
      exclude: ['@ngt/ui', '@ngt/ui/utils', '@ngt/ui/lib/utils', '@lucide/vue'],
    },
    plugins: [
      lucidePreprocess(),
      VueRouter({
        beforeWriteFiles(root) {
          injectRouteGroupMeta(root)
          injectHttp404Routes(root)
        },
        dts: './types/auto/typed-router.d.ts',
        extensions: ['.vue'],
        importMode: 'async',
        routesFolder: [
          {
            path: '',
            src: 'src/views',
          },
        ],
      }),
      annotations({
        projectId: env.ANNOTATIONS_PROJECT_ID?.trim() || 'ngt-starter',
        review: { buildId: env.ANNOTATIONS_BUILD_ID?.trim() || undefined },
        serverUrl: env.ANNOTATIONS_SERVER_URL?.trim() || 'http://localhost:3110',
      }),
      vue(),
      vueJsx(),
      vueDevTools(),
      tailwindcss(),
      VueI18nPlugin({
        include: resolve(appRoot, './src/locales/*.json'),
      }),
      envParse({
        build: true,
        dtsPath: './types/auto/import-meta.d.ts',
      }),
      Components({
        dts: './types/auto/components.d.ts',
        resolvers: [
          (componentName) => {
            if (componentName.startsWith('Ngt')) {
              return {
                from: '@ngt/ui',
                name: componentName.slice(3),
              }
            }
          },
        ],
      }),
      AutoImport({
        dts: './types/auto/auto-imports.d.ts',
        imports: [
          'vue',
          '@vueuse/core',
          {
            '@/api/sysApi': [['sysApi', '$api']],
            '@/api/useRequest': [['useRequest', '$req']],
            '@/loadingBar': [['loadingBar', '$loadingBar']],
            '@/locales': [['global', '$i18n']],
            '@ngt/ui/lib/utils': [['cn', '$cn']],
            'vue-i18n': ['useI18n'],
            'vue-sonner': [['toast', '$toast']],
            'zod': [['*', 'z']],
          },
          VueRouterAutoImports,
        ],
      }),
    ],
    preview: mode === 'review' ? undefined : { port: server.port },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server,
  }
})
