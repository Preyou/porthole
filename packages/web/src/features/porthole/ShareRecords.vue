<script setup lang="ts">
import type { Share, ShareRecordAction, ShareStatus } from './contracts'
import { Button } from '@ngt/ui/button'
import { ErrorState } from '@ngt/ui/error-state'
import { Icon } from '@ngt/ui/icon'
import { Input } from '@ngt/ui/input'
import { Select } from '@ngt/ui/select'
import { Skeleton } from '@ngt/ui/skeleton'
import { Text } from '@ngt/ui/text'
import { resolveRequestErrorMessage } from '@/api/sysApi'
import ShareRow from './ShareRow.vue'
import { shareStatus } from './shareStatus'

const props = defineProps<{ busyShareId?: string, error?: unknown, loading: boolean, now: number, shares?: Share[] }>()
const emit = defineEmits<{ action: [action: ShareRecordAction, share: Share], refresh: [] }>()
const { t } = useI18n()
const search = ref('')
const status = ref<ShareStatus | 'all'>('all')
const protocol = ref<Share['protocol'] | 'all'>('all')
const statusValues = ['active', 'changed', 'offline', 'exhausted', 'expired', 'revoked'] as const satisfies readonly ShareStatus[]
const statusOptions = computed(() => [
  { label: t('porthole.filters.allStatuses'), value: 'all' },
  ...statusValues.map(value => ({ label: t(`porthole.status.${value}`), value })),
])
const protocolOptions = computed(() => [
  { label: t('porthole.filters.allProtocols'), value: 'all' },
  { label: 'HTTP', value: 'http' },
  { label: 'HTTPS', value: 'https' },
])
const query = computed(() => search.value.trim().toLocaleLowerCase())
const hasFilters = computed(() => Boolean(query.value) || status.value !== 'all' || protocol.value !== 'all')
const records = computed(() => (props.shares ?? []).filter((share) => {
  if (status.value !== 'all' && shareStatus(share, props.now) !== status.value) { return false }
  if (protocol.value !== 'all' && share.protocol !== protocol.value) { return false }
  return !query.value || [share.name, share.description, share.url, String(share.port)]
    .some(field => field?.toLocaleLowerCase().includes(query.value))
}))

function clearFilters() {
  search.value = ''
  status.value = 'all'
  protocol.value = 'all'
}
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-xl border bg-card" aria-labelledby="shares-title">
    <div class="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <div class="min-w-0 space-y-1">
        <Text id="shares-title" as="h2" variant="heading">
          {{ t('porthole.sharesTitle') }}
        </Text>
        <Text
          v-if="shares"
          as="p"
          variant="caption"
          class="text-muted-foreground"
          role="status"
        >
          {{ hasFilters ? t('porthole.filters.matchCount', { count: records.length, total: shares.length }) : t('porthole.shareCount', { count: shares.length }) }}
        </Text>
      </div>
      <Button
        variant="outline"
        size="icon"
        class="shrink-0"
        :disabled="loading"
        :aria-label="t('porthole.refreshShares')"
        :title="t('porthole.refreshShares')"
        @click="emit('refresh')"
      >
        <Icon icon="lucide--refresh-cw" :class="{ 'motion-safe:animate-spin': loading }" aria-hidden="true" />
      </Button>
    </div>

    <div v-if="shares?.length || hasFilters" class="grid grid-cols-2 gap-2 border-y px-4 py-3 sm:grid-cols-(--filter-columns) [--filter-columns:minmax(0,1fr)_10rem_8rem] sm:px-5">
      <div class="relative col-span-2 min-w-0 sm:col-span-1">
        <Icon icon="lucide--search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          v-model="search"
          type="search"
          autocomplete="off"
          class="pl-9"
          :aria-label="t('porthole.filters.search')"
          :placeholder="t('porthole.filters.searchPlaceholder')"
          @keydown.esc="search = ''"
        />
      </div>
      <Select
        v-model="status"
        :options="statusOptions"
        class="w-full min-w-0"
        :aria-label="t('porthole.filters.status')"
      />
      <Select
        v-model="protocol"
        :options="protocolOptions"
        class="w-full min-w-0"
        :aria-label="t('porthole.filters.protocol')"
      />
    </div>

    <div :aria-busy="loading">
      <ErrorState
        v-if="error && !shares"
        class="m-4"
        :title="t('porthole.sharesError')"
        :description="resolveRequestErrorMessage(error)"
      >
        <template #actions>
          <Button size="sm" variant="outline" @click="emit('refresh')">
            {{ t('common.retry') }}
          </Button>
        </template>
      </ErrorState>
      <div
        v-else-if="!shares"
        class="space-y-2 border-t p-4"
        role="status"
        :aria-label="t('common.loading')"
      >
        <Skeleton v-for="index in 3" :key="index" class="h-16 w-full" />
      </div>

      <template v-else>
        <Text
          v-if="error"
          as="p"
          variant="caption"
          class="px-4 pt-3 text-destructive sm:px-5"
          role="status"
        >
          {{ t('porthole.stale') }}
        </Text>

        <div v-if="records.length === 0" class="grid justify-items-center gap-2 px-5 py-12 text-center">
          <Icon :icon="hasFilters ? 'lucide--search' : 'lucide--link-2'" class="mb-1 text-2xl text-muted-foreground" aria-hidden="true" />
          <Text as="p" variant="label">
            {{ t(hasFilters ? 'porthole.filters.noMatches' : 'porthole.empty') }}
          </Text>
          <Button
            v-if="hasFilters"
            size="sm"
            variant="outline"
            class="mt-1"
            @click="clearFilters"
          >
            {{ t('porthole.filters.clear') }}
          </Button>
          <Text
            v-else
            as="p"
            variant="caption"
            class="text-muted-foreground"
          >
            {{ t('porthole.emptyDetail') }}
          </Text>
        </div>

        <div v-else class="[--share-columns:minmax(0,1.6fr)_minmax(5.5rem,.7fr)_minmax(4.25rem,.55fr)_minmax(6.75rem,.9fr)_5rem]">
          <div class="hidden grid-cols-(--share-columns) items-center gap-3 border-b bg-muted/40 px-5 py-2.5 text-muted-foreground lg:grid" aria-hidden="true">
            <Text v-for="column in ['share', 'status', 'port', 'access', 'actions']" :key="column" variant="caption">
              {{ t(`porthole.columns.${column}`) }}
            </Text>
          </div>
          <ul class="grid gap-3 p-3 sm:p-4 lg:block lg:divide-y lg:p-0">
            <li v-for="share in records" :key="share.id" class="min-w-0 rounded-lg border lg:rounded-none lg:border-0">
              <ShareRow
                :share="share"
                :now="now"
                :busy="busyShareId === share.id"
                @action="emit('action', $event, share)"
              />
            </li>
          </ul>
        </div>
      </template>
    </div>
  </section>
</template>
