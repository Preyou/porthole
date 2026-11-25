<script setup lang="ts">
import type { Share, ShareRecordAction } from '@/features/porthole/contracts'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@ngt/ui/alert-dialog'
import { Button } from '@ngt/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ngt/ui/dialog'
import { Icon } from '@ngt/ui/icon'
import { Text } from '@ngt/ui/text'
import { useClipboard, useTimestamp } from '@vueuse/core'
import { toast } from 'vue-sonner'
import PortList from '@/features/porthole/PortList.vue'
import ShareCodeDialog from '@/features/porthole/ShareCodeDialog.vue'
import ShareEditor from '@/features/porthole/ShareEditor.vue'
import ShareRecords from '@/features/porthole/ShareRecords.vue'
import { shareStatus } from '@/features/porthole/shareStatus'
import { useShareDashboard } from '@/features/porthole/useShareDashboard'

definePage({ meta: { titleKey: 'porthole.title' } })
const { locale, t } = useI18n()
const now = useTimestamp({ interval: 15_000 })
const { copy, isSupported } = useClipboard({ legacy: true })
const qrShare = shallowRef<Share>()
const dialogSizing = 'max-h-(--share-dialog-height) [--share-dialog-height:calc(100dvh-2rem)] overflow-y-auto overscroll-contain'
const {
  askConfirmation,
  busyShareId,
  closeEditor,
  confirmation,
  confirmationError,
  discovered: { data: snapshot, error: portsError, loading: portsLoading },
  domain,
  editor,
  editorBusy,
  editorError,
  editShare,
  exposures: { data: shares, error: sharesError, loading: sharesLoading },
  openEditor,
  ports,
  readyPorts,
  refreshPorts,
  refreshShares,
  revealed,
  runAction,
  submit,
} = useShareDashboard()
const overview = computed(() => {
  const statuses = shares.value?.map(share => shareStatus(share, now.value))
  return [
    { icon: 'lucide--circle-check', name: 'active', value: statuses?.filter(status => status === 'active').length },
    { icon: 'lucide--triangle-alert', name: 'attention', value: statuses?.filter(status => status === 'changed' || status === 'offline').length },
    { icon: 'lucide--server', name: 'ports', value: snapshot.value === undefined ? undefined : readyPorts.value.length },
  ]
})

async function copyText(text: string, key = false) {
  if (!isSupported.value) {
    toast.error(t('porthole.copyFailed'))
    return
  }
  try {
    await copy(text)
    toast.success(t(key ? 'porthole.keyCopied' : 'porthole.copied'))
  }
  catch { toast.error(t('porthole.copyFailed')) }
}

function copyDetails(share: Share) {
  const expiration = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(share.expiresAt)
  return copyText(t('porthole.detailsText', { expiration, name: share.name, url: share.url }))
}

function handleRecordAction(action: ShareRecordAction, share: Share) {
  switch (action) {
    case 'copy': return copyText(share.url)
    case 'details': return copyDetails(share)
    case 'edit': return editShare(share)
    case 'extend': return runAction(share, action)
    case 'qr': qrShare.value = share; break
    default: askConfirmation(share, action)
  }
}
</script>

<template>
  <section class="space-y-4 sm:space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <Text as="h1" variant="title">
          {{ t('porthole.title') }}
        </Text>
        <Text as="p" variant="caption" class="text-muted-foreground">
          {{ t('porthole.description') }}
        </Text>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button as-child variant="outline" class="xl:hidden">
          <a href="#discovered-ports-title">
            <Icon icon="lucide--server" aria-hidden="true" />
            {{ t('porthole.viewPorts') }}
          </a>
        </Button>
        <Button :disabled="readyPorts.length === 0" @click="openEditor()">
          <Icon icon="lucide--plus" aria-hidden="true" />
          {{ t('porthole.create') }}
        </Button>
      </div>
    </header>

    <dl class="grid grid-cols-3 gap-2 sm:gap-3">
      <div v-for="item in overview" :key="item.name" class="flex min-w-0 flex-col justify-between gap-2 rounded-xl border bg-card p-3 sm:p-4">
        <dt class="flex items-center gap-2">
          <Icon :icon="item.icon" class="hidden shrink-0 text-muted-foreground sm:inline-block" aria-hidden="true" />
          <Text variant="caption" class="text-muted-foreground">
            {{ t(`porthole.summary.${item.name}`) }}
          </Text>
        </dt>
        <dd>
          <Text variant="heading" class="tabular-nums">
            {{ item.value ?? '—' }}
          </Text>
        </dd>
      </div>
    </dl>

    <div class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <ShareRecords
        class="xl:flex-1"
        :shares="shares"
        :now="now"
        :busy-share-id="busyShareId"
        :error="sharesError"
        :loading="sharesLoading"
        @refresh="refreshShares"
        @action="handleRecordAction"
      />
      <PortList
        class="xl:w-68 xl:shrink-0"
        :domain="domain"
        :error="portsError"
        :loading="portsLoading"
        :ports="ports"
        :ready="snapshot !== undefined"
        @create="openEditor"
        @refresh="refreshPorts"
      />
    </div>
    <Dialog :open="!!editor" @update:open="!$event && closeEditor()">
      <DialogContent
        v-if="editor"
        :show-close-button="!editorBusy"
        :class="dialogSizing"
        @escape-key-down="editorBusy && $event.preventDefault()"
      >
        <DialogHeader>
          <DialogTitle>{{ t(editor.share ? 'porthole.edit' : 'porthole.create') }}</DialogTitle>
          <DialogDescription>{{ t(editor.share ? 'porthole.editDetail' : 'porthole.createDetail') }}</DialogDescription>
        </DialogHeader>
        <ShareEditor
          :key="editor.share?.id ?? 'new'"
          :port="editor.port"
          :ports="readyPorts"
          :domain="domain"
          :share="editor.share"
          :busy="editorBusy"
          :error="editorError"
          @submit="submit"
          @cancel="closeEditor"
        />
      </DialogContent>
    </Dialog>
    <Dialog :open="!!revealed" @update:open="!$event && (revealed = undefined)">
      <DialogContent v-if="revealed?.accessKey">
        <DialogHeader>
          <DialogTitle>{{ t('porthole.accessKey') }}</DialogTitle>
          <DialogDescription>{{ t('porthole.keyReveal') }}</DialogDescription>
        </DialogHeader>
        <code class="block select-all break-all rounded-lg bg-muted p-3">{{ revealed.accessKey }}</code>
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="outline" @click="copyText(revealed.share.url)">
            {{ t('porthole.copyLink') }}
          </Button>
          <Button @click="copyText(revealed.accessKey, true)">
            {{ t('porthole.copyKey') }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <ShareCodeDialog :share="qrShare" @close="qrShare = undefined" @copy="copyText" />
    <AlertDialog :open="!!confirmation" @update:open="!$event && !busyShareId && (confirmation = undefined)">
      <AlertDialogContent v-if="confirmation" :class="dialogSizing" @escape-key-down="busyShareId && $event.preventDefault()">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t(`porthole.${confirmation.action}`) }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t(`porthole.confirm.${confirmation.action}`, { name: confirmation.share.name }) }}</AlertDialogDescription>
        </AlertDialogHeader>
        <Text
          v-if="confirmationError"
          as="p"
          variant="caption"
          class="text-destructive"
          role="alert"
        >
          {{ confirmationError }}
        </Text>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="!!busyShareId">
            {{ t('common.cancel') }}
          </AlertDialogCancel>
          <Button
            :variant="confirmation.action === 'reconnect' ? 'default' : 'destructive'"
            :loading="!!busyShareId"
            :disabled="!!busyShareId"
            @click="runAction(confirmation.share, confirmation.action)"
          >
            {{ t(`porthole.${confirmation.action}`) }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
