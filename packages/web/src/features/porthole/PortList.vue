<script setup lang="ts">
import type { DiscoveredPort } from './contracts'
import { Badge } from '@ngt/ui/badge'
import { Button } from '@ngt/ui/button'
import { Card, CardContent, CardHeader } from '@ngt/ui/card'
import { ErrorState } from '@ngt/ui/error-state'
import { Icon } from '@ngt/ui/icon'
import { Input } from '@ngt/ui/input'
import { Skeleton } from '@ngt/ui/skeleton'
import { Text } from '@ngt/ui/text'
import { resolveRequestErrorMessage } from '@/api/sysApi'

const props = defineProps<{ domain: string, error?: unknown, loading: boolean, ports: DiscoveredPort[], ready: boolean }>()
const emit = defineEmits<{ create: [port: DiscoveredPort], refresh: [] }>()
const { t } = useI18n()
const portQuery = ref('')
const matchingPorts = computed(() => {
  const query = portQuery.value.trim()
  return query ? props.ports.filter(({ port }) => String(port).includes(query)) : props.ports
})
</script>

<template>
  <Card role="region" class="min-w-0 rounded-xl shadow-none" aria-labelledby="discovered-ports-title">
    <CardHeader>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <Text id="discovered-ports-title" as="h2" variant="heading">
            {{ t('porthole.ports.title') }}
          </Text>
          <Text as="p" variant="caption" class="text-muted-foreground">
            {{ t('porthole.ports.range') }}
          </Text>
        </div>
        <Button
          variant="outline"
          size="icon"
          :disabled="loading"
          :aria-label="t('porthole.refresh')"
          :title="t('porthole.refresh')"
          @click="emit('refresh')"
        >
          <Icon icon="lucide--refresh-cw" :class="{ 'motion-safe:animate-spin': loading }" aria-hidden="true" />
        </Button>
      </div>
      <Text
        v-if="domain"
        as="p"
        variant="caption"
        class="break-all text-muted-foreground"
      >
        *.{{ domain }}
      </Text>
    </CardHeader>

    <CardContent :aria-busy="loading">
      <ErrorState v-if="!ready && error" :title="t('porthole.ports.error')" :description="resolveRequestErrorMessage(error)">
        <template #actions>
          <Button size="sm" variant="outline" @click="emit('refresh')">
            {{ t('common.retry') }}
          </Button>
        </template>
      </ErrorState>
      <div
        v-else-if="!ready"
        class="space-y-2"
        role="status"
        :aria-label="t('common.loading')"
      >
        <Skeleton v-for="index in 3" :key="index" class="h-12 w-full" />
      </div>
      <template v-else>
        <Text
          v-if="error"
          as="p"
          variant="caption"
          class="mb-3 text-destructive"
          role="status"
        >
          {{ t('porthole.stale') }}
        </Text>
        <Input
          v-model="portQuery"
          type="search"
          inputmode="numeric"
          autocomplete="off"
          class="mb-4"
          :aria-label="t('porthole.ports.search')"
          :placeholder="t('porthole.ports.search')"
          @keydown.esc="portQuery = ''"
        />
        <div v-if="ports.length === 0" class="rounded-lg border border-dashed p-5">
          <Icon icon="lucide--unplug" class="mb-2 text-xl text-muted-foreground" aria-hidden="true" />
          <Text as="p" variant="label">
            {{ t('porthole.ports.empty') }}
          </Text>
          <Text as="p" variant="caption" class="mt-1 text-muted-foreground">
            {{ t('porthole.ports.emptyDetail') }}
          </Text>
        </div>
        <Text
          v-else-if="matchingPorts.length === 0"
          as="p"
          variant="caption"
          class="py-2 text-muted-foreground"
          role="status"
        >
          {{ t('porthole.ports.noMatches') }}
        </Text>
        <ul v-else class="divide-y xl:max-h-96 xl:overflow-y-auto">
          <li v-for="port in matchingPorts" :key="port.port" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div class="flex min-w-0 flex-col gap-0.5">
              <Text variant="label" class="font-mono tabular-nums">
                {{ port.port }}
              </Text>
              <Text
                v-if="port.address"
                variant="caption"
                class="truncate text-muted-foreground"
                :title="port.address"
              >
                {{ port.address }}
              </Text>
            </div>
            <Badge :variant="port.protocol ? 'secondary' : 'outline'" class="shrink-0">
              {{ port.protocol?.toUpperCase() ?? t('porthole.ports.unavailable') }}
            </Badge>
            <Button
              v-if="port.protocol"
              variant="outline"
              size="icon"
              :aria-label="t('porthole.ports.sharePort', { port: port.port })"
              :title="t('porthole.create')"
              @click="emit('create', port)"
            >
              <Icon icon="lucide--plus" aria-hidden="true" />
            </Button>
          </li>
        </ul>
      </template>
    </CardContent>
  </Card>
</template>
