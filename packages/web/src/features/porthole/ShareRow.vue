<script setup lang="ts">
import type { Share, ShareRecordAction } from './contracts'
import { Badge } from '@ngt/ui/badge'
import { Button } from '@ngt/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@ngt/ui/dropdown-menu'
import { Icon } from '@ngt/ui/icon'
import { Text } from '@ngt/ui/text'
import { shareStatus } from './shareStatus'

const { now, share } = defineProps<{ busy: boolean, now: number, share: Share }>()
const emit = defineEmits<{ action: [action: ShareRecordAction] }>()
const { locale, t } = useI18n()
const status = computed(() => shareStatus(share, now))
const ended = computed(() => status.value === 'expired' || status.value === 'revoked')
const remaining = computed(() => Math.max(0, Math.ceil((share.expiresAt - now) / 60_000)))
const hostname = computed(() => new URL(share.url).host)
const expiresAt = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(share.expiresAt))
const statusDisplay = {
  active: { color: 'border-success/30 bg-success/10 text-success', icon: 'lucide--circle-check' },
  changed: { color: 'border-warning/30 bg-warning/10 text-warning', icon: 'lucide--triangle-alert' },
  exhausted: { color: 'border-warning/30 bg-warning/10 text-warning', icon: 'lucide--users' },
  expired: { color: 'text-muted-foreground', icon: 'lucide--clock' },
  offline: { color: 'border-warning/30 bg-warning/10 text-warning', icon: 'lucide--unplug' },
  revoked: { color: 'border-destructive/30 bg-destructive/10 text-destructive', icon: 'lucide--ban' },
} as const
const duration = computed(() => remaining.value >= 60
  ? t('porthole.hoursLeft', { hours: Math.floor(remaining.value / 60), minutes: remaining.value % 60 })
  : t('porthole.minutesLeft', { minutes: remaining.value }))
</script>

<template>
  <article class="grid min-w-0 grid-cols-(--compact-share-columns) [--compact-share-columns:minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 p-3.5 sm:px-4 lg:grid-cols-(--share-columns) lg:items-center lg:px-5">
    <div class="min-w-0 space-y-1">
      <Text as="h3" variant="label" class="wrap-break-word">
        {{ share.name }}
      </Text>
      <Text as="p" variant="caption" class="break-all text-muted-foreground">
        {{ hostname }}
      </Text>
      <Text
        v-if="share.description"
        as="p"
        variant="caption"
        class="wrap-break-word whitespace-pre-line text-muted-foreground"
      >
        {{ share.description }}
      </Text>
    </div>

    <div class="grid justify-items-end gap-1.5 lg:justify-items-start">
      <Badge variant="outline" :class="statusDisplay[status].color">
        <Icon :icon="statusDisplay[status].icon" aria-hidden="true" />
        {{ t(`porthole.status.${status}`) }}
      </Badge>
      <Text v-if="share.hasKey" variant="caption" class="inline-flex items-center gap-1 text-muted-foreground">
        <Icon icon="lucide--lock-keyhole" aria-hidden="true" />
        {{ t('porthole.protected') }}
      </Text>
    </div>

    <div class="col-span-2 flex flex-wrap items-center gap-1.5 lg:col-span-1">
      <span class="sr-only">{{ t('porthole.columns.port') }}</span>
      <Text variant="label" class="font-mono tabular-nums">
        {{ share.port }}
      </Text>
      <Badge variant="secondary">
        {{ share.protocol.toUpperCase() }}
      </Badge>
    </div>

    <div class="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 lg:col-span-1 lg:grid lg:gap-1">
      <Text variant="caption" class="flex items-center gap-1.5 text-muted-foreground">
        <Icon icon="lucide--clock-3" aria-hidden="true" />
        <time :datetime="new Date(share.expiresAt).toISOString()" :title="expiresAt">{{ ended ? expiresAt : duration }}</time>
      </Text>
      <Text variant="caption" class="flex items-center gap-1.5 text-muted-foreground">
        <Icon icon="lucide--users" aria-hidden="true" />
        {{ share.maxVisits === null ? t('porthole.unlimited') : t('porthole.quota', { visits: share.visits, max: share.maxVisits }) }}
      </Text>
    </div>

    <div class="col-span-2 flex items-center justify-end gap-2 border-t pt-2 lg:col-span-1 lg:gap-1 lg:border-0 lg:pt-0">
      <Button
        v-if="!ended"
        size="sm"
        variant="outline"
        class="min-h-11 lg:min-h-0 lg:px-2"
        :aria-label="t('porthole.copyLinkFor', { name: share.name })"
        :title="t('porthole.copyLink')"
        @click="emit('action', 'copy')"
      >
        <Icon icon="lucide--copy" aria-hidden="true" />
        <span class="lg:sr-only">{{ t('porthole.copyLink') }}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="sm"
            variant="outline"
            class="min-h-11 lg:min-h-0 lg:px-2"
            :disabled="busy"
            :aria-label="t('porthole.manage', { name: share.name })"
            :title="t('porthole.actions')"
          >
            <Icon icon="lucide--ellipsis" aria-hidden="true" />
            <span class="lg:sr-only">{{ t('porthole.actions') }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem v-if="status !== 'revoked'" @select="emit('action', 'edit')">
            <Icon icon="lucide--pencil" aria-hidden="true" />
            {{ t('common.edit') }}
          </DropdownMenuItem>
          <template v-if="!ended">
            <DropdownMenuItem as-child>
              <a :href="share.url" target="_blank" rel="noopener noreferrer">
                <Icon icon="lucide--external-link" aria-hidden="true" />
                {{ t('porthole.open') }}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem @select="emit('action', 'qr')">
              <Icon icon="lucide--qr-code" aria-hidden="true" />
              {{ t('porthole.qr') }}
            </DropdownMenuItem>
            <DropdownMenuItem @select="emit('action', 'extend')">
              <Icon icon="lucide--clock-plus" aria-hidden="true" />
              {{ t('porthole.extend') }}
            </DropdownMenuItem>
            <DropdownMenuItem @select="emit('action', 'details')">
              <Icon icon="lucide--clipboard-list" aria-hidden="true" />
              {{ t('porthole.copyDetails') }}
            </DropdownMenuItem>
          </template>
          <DropdownMenuItem v-if="status === 'changed'" @select="emit('action', 'reconnect')">
            <Icon icon="lucide--refresh-cw" aria-hidden="true" />
            {{ t('porthole.reconnect') }}
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="status !== 'revoked'" />
          <DropdownMenuItem v-if="status !== 'revoked'" class="text-destructive" @select="emit('action', 'revoke')">
            <Icon icon="lucide--ban" aria-hidden="true" />
            {{ t('porthole.revoke') }}
          </DropdownMenuItem>
          <DropdownMenuItem class="text-destructive" @select="emit('action', 'delete')">
            <Icon icon="lucide--trash-2" aria-hidden="true" />
            {{ t('porthole.delete') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <Text
      v-if="status === 'changed' || status === 'offline'"
      as="p"
      variant="caption"
      class="col-span-full text-warning"
    >
      {{ t(`porthole.statusHelp.${status}`) }}
    </Text>
  </article>
</template>
