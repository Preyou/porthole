<script setup lang="ts">
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@ngt/ui/avatar'
import { Button } from '@ngt/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@ngt/ui/dropdown-menu'
import { Icon } from '@ngt/ui/icon'
import { ref } from 'vue'
import { startSignOut } from '@/api/authNavigation'
import {
  localePreference,
  themePreference,
} from '@/app/preferences'
import { useUserContext } from './userContext'

const { t } = useI18n()
const { user } = useUserContext()

const signingOut = ref(false)
function logout() {
  signingOut.value = true
  startSignOut()
}
</script>

<template>
  <DropdownMenu v-if="user">
    <DropdownMenuTrigger as-child>
      <Button
        :aria-label="t('common.userMenu')"
        class="rounded-full"
        size="icon-sm"
        :title="t('common.userMenu')"
        variant="ghost"
      >
        <Avatar class="size-7">
          <AvatarImage
            alt=""
            :src="user.image || ''"
          />
          <AvatarFallback>{{ user.name?.slice(0, 2) || 'Y' }}</AvatarFallback>
        </Avatar>
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" side="right" :side-offset="8">
      <DropdownMenuLabel>
        {{ user.name || user.email || t('auth.signedInUser') }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon icon="lucide--sun-moon" />
          {{ t('common.theme') }}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup v-model="themePreference">
            <DropdownMenuRadioItem value="system">
              {{ t('common.followSystem') }}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
              {{ t('common.colorMode.light') }}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              {{ t('common.colorMode.dark') }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon icon="lucide--languages" />
          {{ t('common.language') }}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup v-model="localePreference">
            <DropdownMenuRadioItem value="system">
              {{ t('common.followSystem') }}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="zh-CN">
              {{ t('common.locale.zhCN') }}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en-US">
              {{ t('common.locale.enUS') }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem :disabled="signingOut" @select="logout">
        <Icon icon="lucide--log-out" />
        {{ t('auth.signOut') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
