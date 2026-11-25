<script setup lang="ts">
import { Button } from '@ngt/ui/button'
import { Icon } from '@ngt/ui/icon'
import { Text } from '@ngt/ui/text'
import Preferences from '@/components/Preferences.vue'

const { t } = useI18n()
const appName = import.meta.env.APP_NAME
</script>

<template>
  <main class="flex h-full min-w-0 flex-1 flex-col overflow-auto bg-background text-foreground">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
      <span class="text-lg font-semibold">{{ appName }}</span>
      <Preferences />
    </header>
    <section class="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6 py-16">
      <div class="rounded-xl border bg-card p-4 text-primary">
        <Icon icon="lucide--network" class="text-3xl" aria-hidden="true" />
      </div>
      <Text as="h1" variant="title">
        {{ t('welcome.title') }}
      </Text>
      <Text as="p" class="text-muted-foreground">
        {{ t('welcome.description') }}
      </Text>
      <Button as-child size="lg">
        <RouterLink to="/app/shares">{{ t('welcome.enter') }}</RouterLink>
      </Button>
    </section>
  </main>
</template>
