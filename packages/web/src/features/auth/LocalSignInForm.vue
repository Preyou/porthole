<script setup lang="ts">
import type { PostAuthLoginLocalData } from '@/api/auto'
import { Button } from '@ngt/ui/button'
import { createSchemaForm, SchemaField } from '@ngt/ui/schema-form'
import { zPostAuthLoginLocalData } from '@/api/auto'
import { useRequest } from '@/api/useRequest'
import { localSignInErrorKey } from './localSignIn'

const { t } = useI18n()
const loginSchema = zPostAuthLoginLocalData.shape.body
const LoginSchemaForm = createSchemaForm<typeof loginSchema>()
const { error, loading, run } = useRequest('/auth/login/local', 'post', {
  cacheFor: 0,
  immediate: false,
  notify: false,
  shareRequest: false,
})

async function submit({ values }: { values: PostAuthLoginLocalData['body'] }) {
  if (loading.value) { return }
  try {
    await run({ data: values })
    // 登录后重新载入应用，初始化用户上下文与请求缓存。
    window.location.replace('/app/shares')
  }
  catch {
    // 请求实例保留错误，由表单内的状态统一展示。
  }
}
</script>

<template>
  <LoginSchemaForm
    :schema="loginSchema"
    :initial-values="{ username: '', password: '' }"
    :disabled="loading"
    :aria-busy="loading"
    label-i18n-prefix="auth.fields"
    @submit="submit"
  >
    <template #default="{ username, password }">
      <SchemaField v-bind="username" :control-props="{ autocomplete: 'username' }" />
      <SchemaField v-bind="password" :control-props="{ autocomplete: 'current-password', type: 'password' }" />
      <p v-if="error" role="alert" class="text-destructive">
        {{ t(localSignInErrorKey(error)) }}
      </p>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Button type="submit" :disabled="loading">
          {{ t(loading ? 'auth.signingIn' : 'auth.signIn') }}
        </Button>
        <Button as-child variant="ghost">
          <RouterLink to="/">{{ t('auth.backHome') }}</RouterLink>
        </Button>
      </div>
    </template>
  </LoginSchemaForm>
</template>
