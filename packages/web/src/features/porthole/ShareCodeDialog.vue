<script setup lang="ts">
import type { Share } from './contracts'
import { Button } from '@ngt/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ngt/ui/dialog'
import { Text } from '@ngt/ui/text'

const props = defineProps<{ share?: Share }>()
const emit = defineEmits<{ close: [], copy: [url: string] }>()
const { t } = useI18n()
const code = shallowRef<string>()
const failed = ref(false)

watch(() => props.share?.url, async (url, _previous, onCleanup) => {
  code.value = undefined
  failed.value = false
  if (!url) { return }
  let stale = false
  onCleanup(() => { stale = true })
  try {
    const { toDataURL } = await import('qrcode')
    const value = await toDataURL(url, { margin: 2, width: 256 })
    if (!stale) { code.value = value }
  }
  catch {
    if (!stale) { failed.value = true }
  }
}, { immediate: true })
</script>

<template>
  <Dialog :open="!!share" @update:open="!$event && emit('close')">
    <DialogContent v-if="share">
      <DialogHeader>
        <DialogTitle>{{ t('porthole.qr') }}</DialogTitle>
        <DialogDescription>{{ t('porthole.qrDetail') }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col items-center gap-3">
        <img
          v-if="code"
          :src="code"
          width="256"
          height="256"
          class="max-w-full rounded-lg border"
          :alt="t('porthole.qrAlt', { name: share.name })"
        >
        <Text
          v-else-if="failed"
          as="p"
          class="text-destructive"
          role="alert"
        >
          {{ t('porthole.qrFailed') }}
        </Text>
        <Text
          v-else
          as="p"
          variant="caption"
          role="status"
        >
          {{ t('common.loading') }}
        </Text>
        <Text as="p" variant="caption" class="break-all text-center text-muted-foreground">
          {{ share.url }}
        </Text>
        <Button type="button" variant="outline" @click="emit('copy', share.url)">
          {{ t('porthole.copyLink') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
