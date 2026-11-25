import type { DiscoveredPort, Share, ShareChange, ShareConfirmationAction, ShareCreate, ShareResult, UpstreamAction } from './contracts'
import { computed, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { resolveRequestErrorMessage } from '@/api/sysApi'
import { useRequest } from '@/api/useRequest'
import { global } from '@/locales'

interface EditDialog {
  port: number
  share?: Share
}

export function useShareDashboard() {
  const discovered = useRequest('/porthole/ports', 'get', response => response.data, { cacheFor: 0, notify: false, polling: 30_000 })
  const exposures = useRequest('/porthole/shares', 'get', response => response.data, {
    cacheFor: 0,
    name: 'porthole-shares',
    notify: false,
    polling: 30_000,
  })
  const create = useRequest('/porthole/shares', 'post', { cacheFor: 0, notify: false, refreshTargets: 'porthole-shares' })
  const change = useRequest('/porthole/shares/{id}', 'patch', { cacheFor: 0, notify: false, refreshTargets: 'porthole-shares' })
  const remove = useRequest('/porthole/shares/{id}', 'delete', { cacheFor: 0, notify: false, refreshTargets: 'porthole-shares' })
  const editor = shallowRef<EditDialog>()
  const confirmation = shallowRef<{ action: ShareConfirmationAction, share: Share }>()
  const confirmationError = shallowRef<string>()
  const editorError = shallowRef<string>()
  const busyShareId = shallowRef<string>()
  const revealed = shallowRef<ShareResult>()
  const ports = computed(() => discovered.data.value?.ports ?? [])
  const domain = computed(() => discovered.data.value?.domain ?? '')
  const readyPorts = computed(() => ports.value.filter(port => port.protocol !== null))
  const editorBusy = computed(() => create.loading.value || (editor.value?.share?.id !== undefined && busyShareId.value === editor.value.share.id))

  function refreshPorts() {
    void discovered.refresh().catch(() => { /* 错误由发现列表展示。 */ })
  }

  function refreshShares() {
    void exposures.refresh().catch(() => { /* 错误由分享列表展示。 */ })
  }

  function openEditor(port?: DiscoveredPort) {
    const target = port ?? readyPorts.value[0]
    if (!target?.protocol) { return }
    editorError.value = undefined
    editor.value = { port: target.port }
  }

  function editShare(share: Share) {
    editorError.value = undefined
    editor.value = { port: share.port, share }
  }

  function closeEditor() {
    if (!editorBusy.value) { editor.value = undefined }
  }

  async function submit(input: ShareCreate | Extract<ShareChange, { action: 'edit' }>) {
    if (editorBusy.value || busyShareId.value) { return }
    editorError.value = undefined
    const editing = editor.value?.share
    if ('action' in input && editing) { busyShareId.value = editing.id }
    try {
      const response = 'action' in input
        ? await change.run({ data: input, path: { id: editing?.id ?? '' } })
        : await create.run({ data: input })
      editor.value = undefined
      if (response.data.accessKey) { revealed.value = response.data }
      else { toast.success(global.t('porthole.saved')) }
    }
    catch (error) {
      editorError.value = resolveRequestErrorMessage(error)
    }
    finally { busyShareId.value = undefined }
  }

  function askConfirmation(share: Share, action: ShareConfirmationAction) {
    confirmationError.value = undefined
    confirmation.value = { action, share }
  }

  async function runAction(share: Share, action: UpstreamAction | 'delete') {
    if (busyShareId.value || editorBusy.value) { return }
    busyShareId.value = share.id
    confirmationError.value = undefined
    const path = { id: share.id }
    try {
      if (action === 'delete') { await remove.run({ path }) }
      else { await change.run({ data: { action }, path }) }
      confirmation.value = undefined
      toast.success(global.t(`porthole.feedback.${action}`))
    }
    catch (error) {
      const message = resolveRequestErrorMessage(error)
      if (confirmation.value?.share.id === share.id) { confirmationError.value = message }
      else { toast.error(message) }
    }
    finally { busyShareId.value = undefined }
  }

  return {
    askConfirmation,
    busyShareId,
    closeEditor,
    confirmation,
    confirmationError,
    discovered,
    domain,
    editor,
    editorBusy,
    editorError,
    editShare,
    exposures,
    openEditor,
    ports,
    readyPorts,
    refreshPorts,
    refreshShares,
    revealed,
    runAction,
    submit,
  }
}
