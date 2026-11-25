<script setup lang="ts">
import { Icon } from '@ngt/ui/icon'
import { isSignInAvailable } from '@/api/authContract'
import { readAuthConfiguration } from '@/api/sysApi'
import UserMenu from '@/features/app/HomeUserMenu.vue'
import { provideUserContext } from '@/features/app/userContext'
import AuthUnavailable from '@/features/auth/AuthUnavailable.vue'

const appName = import.meta.env.APP_NAME
definePage({ redirect: '/app/shares' })
const configuration = await readAuthConfiguration()
const context = isSignInAvailable(configuration) ? await provideUserContext() : undefined
</script>

<template>
  <div v-if="context?.user.value" class="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
    <header class="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex items-center gap-4">
        <RouterLink class="inline-flex items-center gap-2 font-semibold" to="/app/shares">
          <Icon icon="lucide--network" class="text-primary" aria-hidden="true" />
          {{ appName }}
        </RouterLink>
      </div>
      <UserMenu />
    </header>
    <main class="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-3 py-5 sm:px-6 lg:px-8 lg:py-7">
      <RouterView />
    </main>
  </div>
  <main v-else class="flex min-h-svh items-center justify-center px-6">
    <AuthUnavailable :mode="configuration.mode" />
  </main>
</template>
