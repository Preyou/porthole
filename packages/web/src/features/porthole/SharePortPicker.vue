<script setup lang="ts">
import type { DiscoveredPort } from './contracts'
import { Badge } from '@ngt/ui/badge'
import { Button } from '@ngt/ui/button'
import { Combobox, ComboboxAnchor, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxItemIndicator, ComboboxList, ComboboxTrigger, ComboboxViewport } from '@ngt/ui/combobox'
import { Icon } from '@ngt/ui/icon'
import { useSetFieldValue } from 'vee-validate'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  disabled?: boolean
  id?: string
  modelValue?: string
  ports: DiscoveredPort[]
  suggestName: boolean
}>()
const emit = defineEmits<{
  'blur': [event: FocusEvent]
  'update:modelValue': [port: string]
}>()

const { t } = useI18n()
const setServiceName = useSetFieldValue<string>('name')
const protocol = computed(() => props.ports
  .find(({ port }) => String(port) === props.modelValue)
  ?.protocol
  ?.toUpperCase())

function choosePort(value: unknown) {
  if (typeof value !== 'string' || value === props.modelValue) { return }
  emit('update:modelValue', value)
  if (props.suggestName) { setServiceName(value) }
}
</script>

<template>
  <Combobox :model-value="modelValue" :disabled="disabled" @update:model-value="choosePort">
    <ComboboxAnchor class="w-full">
      <ComboboxTrigger as-child>
        <Button
          :id="id"
          type="button"
          variant="outline"
          class="w-full justify-between border-input bg-transparent px-3 font-normal dark:bg-input/30"
          :aria-label="`${t('porthole.fields.port')} ${modelValue ?? ''} ${protocol ?? ''}`.trim()"
          :aria-invalid="$attrs['aria-invalid'] === true"
          @blur="emit('blur', $event)"
        >
          <span class="inline-flex min-w-0 items-center gap-2 tabular-nums">
            {{ modelValue }}
            <Badge v-if="protocol" variant="secondary">
              {{ protocol }}
            </Badge>
          </span>
          <Icon icon="lucide--chevron-down" class="text-muted-foreground" aria-hidden="true" />
        </Button>
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxList class="w-(--reka-combobox-trigger-width)">
      <ComboboxInput
        :display-value="() => ''"
        :aria-label="t('porthole.ports.search')"
        :placeholder="t('porthole.ports.search')"
        inputmode="numeric"
      />
      <ComboboxEmpty>{{ t('porthole.ports.noMatches') }}</ComboboxEmpty>
      <ComboboxViewport class="max-h-56 p-1">
        <ComboboxItem
          v-for="{ port, protocol: portProtocol } in ports"
          :key="port"
          :value="String(port)"
          :text-value="String(port)"
        >
          <span class="inline-flex items-center gap-2 tabular-nums">
            {{ port }}
            <Badge v-if="portProtocol" variant="secondary">
              {{ portProtocol.toUpperCase() }}
            </Badge>
          </span>
          <ComboboxItemIndicator>
            <Icon icon="lucide--check" aria-hidden="true" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
