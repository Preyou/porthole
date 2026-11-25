<script setup lang="ts">
import { Text } from '@ngt/ui/text'
import { isSignInAvailable } from '@/api/authContract'
import { startSignIn } from '@/api/authNavigation'
import { readAuthConfiguration } from '@/api/sysApi'
import AuthUnavailable from '@/features/auth/AuthUnavailable.vue'
import LocalSignInForm from '@/features/auth/LocalSignInForm.vue'

const { t } = useI18n()
const configuration = await readAuthConfiguration()
const canSignIn = isSignInAvailable(configuration)

onMounted(() => {
  if (canSignIn && configuration.mode === 'logto') { startSignIn() }
})
</script>

<template>
  <section class="w-full max-w-sm space-y-6 px-6 py-10">
    <AuthUnavailable v-if="!canSignIn" :mode="configuration.mode" />
    <template v-else-if="configuration.mode === 'local'">
      <Text as="h1" variant="title">
        {{ t('auth.signIn') }}
      </Text>
      <LocalSignInForm />
    </template>
    <p v-else role="status">
      {{ t('auth.redirecting') }}
    </p>
  </section>
</template>
