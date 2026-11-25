/// <reference types="vite/client" />

import 'vue'
import 'vue-router'
import 'vue-router/auto-routes'
import 'vue-component-type-helpers'
import '@vueuse/core'
import 'reka-ui'
import 'type-fest'
import 'zod'

declare module '@ngt/ui/styles'

interface ImportMetaEnv {
  readonly APP_NAME: string
}

declare global {
  namespace VueUse {
    export type * from '@vueuse/core'
  }

  namespace Reka {
    export * from 'reka-ui'
  }

  namespace TypeFest {
    export type * from 'type-fest'
  }

  namespace Vue {
    export type * from 'vue'
    export type * from 'vue-component-type-helpers'
  }

  namespace VueRouter {
    export type * from 'vue-router'
    export type * from 'vue-router/auto-routes'
  }

  namespace Z {
    export type * from 'zod'
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    group?: string
    icon?: string
    order?: number
    title?: string
    titleKey?: string
    type?: string
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: typeof import('../src/api/sysApi')['sysApi']
    $cn: typeof import('@ngt/ui/lib/utils')['cn']
    $loadingBar: typeof import('../src/loadingBar')['loadingBar']
    $req: typeof import('../src/api/useRequest')['useRequest']
    $toast: typeof import('vue-sonner')['toast']
  }

  interface AttributifyAttributes {
    [key: `data-${string}`]: boolean | number | string | undefined | null
  }

  interface HTMLAttributes extends AttributifyAttributes {}
}

export {}
