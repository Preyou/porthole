<script setup lang="ts">
import type { AuthConfiguration } from '@/api/authContract'
import { Button } from '@ngt/ui/button'
import { ErrorState } from '@ngt/ui/error-state'

defineProps<{ mode: AuthConfiguration['mode'] }>()
const { t } = useI18n()
</script>

<template>
  <ErrorState
    :title="t(mode === 'off' ? 'auth.disabled' : 'auth.pending')"
    :description="t(mode === 'off' ? 'auth.disabledDetail' : mode === 'logto' ? 'auth.pendingLogto' : 'common.requestFailed')"
  >
    <template #actions>
      <Button as-child variant="outline">
        <RouterLink to="/">{{ t('auth.backHome') }}</RouterLink>
      </Button>
    </template>
  </ErrorState>
</template>
