<script setup lang="ts">
import { NativeSelect } from '@ngt/ui/native-select'
import { localePreference, themePreference } from '@/app/preferences'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <NativeSelect v-model="localePreference" :aria-label="t('common.language')">
      <option value="system">
        {{ t('common.followSystem') }}
      </option>
      <option value="zh-CN">
        中文
      </option>
      <option value="en-US">
        English
      </option>
    </NativeSelect>
    <NativeSelect v-model="themePreference" :aria-label="t('common.theme')">
      <option value="system">
        {{ t('common.followSystem') }}
      </option>
      <option value="light">
        {{ t('common.colorMode.light') }}
      </option>
      <option value="dark">
        {{ t('common.colorMode.dark') }}
      </option>
    </NativeSelect>
  </div>
</template>
