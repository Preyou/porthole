import { useTheme } from '@ngt/ui/domains/theme'
import { useLocalStorage, usePreferredDark, usePreferredLanguages } from '@vueuse/core'
import { computed, watch } from 'vue'
import { global, resolveLocale } from '@/locales'

export type LocalePreference = 'system' | 'zh-CN' | 'en-US'
export type ThemePreference = 'system' | 'light' | 'dark'
export const localePreference = useLocalStorage<LocalePreference>('yuumi.locale-preference', 'system')
export const themePreference = useLocalStorage<ThemePreference>('yuumi.theme-preference', 'system')

export function initializeLocalePreferences() {
  const languages = usePreferredLanguages()
  watch([localePreference, languages], () => {
    global.locale.value = localePreference.value === 'system'
      ? languages.value.map(resolveLocale).find(Boolean) ?? 'zh-CN'
      : localePreference.value
  }, { immediate: true })
}

export function initializeAppPreferences() {
  const dark = usePreferredDark()
  const { setPreset } = useTheme()
  const preset = computed(() => (themePreference.value === 'system' ? dark.value : themePreference.value === 'dark') ? 'default.dark' : 'default')
  watch(preset, value => setPreset(value), { immediate: true })
}
