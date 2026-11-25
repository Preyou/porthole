<script setup lang="ts">
import type { DiscoveredPort, Share, ShareCreate, ShareEdit } from './contracts'
import { Button } from '@ngt/ui/button'
import { Input } from '@ngt/ui/input'
import { createSchemaForm, SchemaField } from '@ngt/ui/schema-form'
import { Select } from '@ngt/ui/select'
import { Text } from '@ngt/ui/text'
import { Textarea } from '@ngt/ui/textarea'
import { z } from 'zod'
import SharePortPicker from './SharePortPicker.vue'

const props = defineProps<{
  busy: boolean
  domain: string
  error?: string
  port: number
  ports: DiscoveredPort[]
  share?: Share
}>()
const emit = defineEmits<{ cancel: [], submit: [input: ShareCreate | ShareEdit] }>()
const { t } = useI18n()
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const editable = computed(() => props.share !== undefined)
const nameEdited = ref(false)
const durationHelpId = useId()
const quotaHelpId = useId()
const keyModes = ['keep', 'generate', 'none', 'custom'] as const
const upstreamHostModes = ['original', 'local'] as const satisfies readonly Share['upstreamHostMode'][]
const upstreamHostOptions = computed(() => upstreamHostModes.map(value => ({ label: t(`porthole.upstreamHostModes.${value}`), value })))
const keyOptions = computed(() => keyModes
  .filter(mode => mode !== 'keep' || editable.value)
  .map(value => ({ label: t(`porthole.keys.${value}`), value })))
const schema = computed(() => z.object({
  description: z.string().trim().max(500, { error: t('porthole.descriptionLength') }),
  duration: z.number().int().min(editable.value ? 0 : 1).max(43_200),
  keyMode: z.enum(editable.value ? keyModes : ['generate', 'none', 'custom']),
  name: z.string().trim().min(1, { error: t('porthole.nameRequired') }).max(100),
  port: z.enum(editable.value ? [String(props.port)] : props.ports.map(({ port }) => String(port))),
  quota: z.number().int().min(0).max(1_000_000),
  secret: z.string().trim().default(''),
  slug: z.string().trim().toLowerCase().refine(value => value === '' || slugPattern.test(value), { error: t('porthole.slugInvalid') }),
  upstreamHostMode: z.enum(upstreamHostModes),
}).superRefine(({ keyMode, secret }, context) => {
  if (keyMode !== 'custom') { return }
  if (secret.length < 8 || secret.length > 128) {
    context.addIssue({ code: 'custom', message: t('porthole.keyInvalid'), path: ['secret'] })
  }
}))
type FormValues = z.infer<typeof schema.value>
const ShareSchemaForm = createSchemaForm<typeof schema.value>()
const initialValues = {
  description: props.share?.description ?? '',
  duration: props.share && props.share.expiresAt > Date.now() ? 0 : 60,
  keyMode: props.share ? 'keep' : 'generate',
  name: props.share?.name ?? String(props.port),
  port: String(props.port),
  quota: props.share?.maxVisits ?? 0,
  secret: '',
  slug: props.share?.slug ?? '',
  upstreamHostMode: props.share?.upstreamHostMode ?? 'original',
} satisfies FormValues

function submit({ values }: { values: FormValues }) {
  const { description, duration, keyMode, name, port, quota, secret, slug, upstreamHostMode } = values
  const maxVisits = quota === 0 ? null : quota
  const key = keyMode === 'keep'
    ? undefined
    : keyMode === 'custom'
      ? { mode: keyMode, value: secret }
      : { mode: keyMode }
  if (editable.value) {
    emit('submit', { action: 'edit', description: description || null, durationMinutes: duration || undefined, key, maxVisits, name, upstreamHostMode })
  }
  else {
    emit('submit', { description: description || null, durationMinutes: duration, key: key ?? { mode: 'generate' }, maxVisits, name, port: Number(port), slug: slug || undefined, upstreamHostMode })
  }
}
</script>

<template>
  <ShareSchemaForm
    :schema="schema"
    :initial-values="initialValues"
    :disabled="busy"
    label-i18n-prefix="porthole.fields"
    @submit="submit"
  >
    <template #default="{ port: portField, name, slug, duration, quota, description, keyMode, secret, upstreamHostMode, $form }">
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <SchemaField v-bind="name" :class="{ 'sm:col-span-2': editable }">
            <template #control="{ bind }">
              <Input v-bind="bind" @update:model-value="nameEdited = true" />
            </template>
          </SchemaField>
          <SchemaField v-if="!editable" v-bind="portField">
            <template #control="{ bind }">
              <SharePortPicker v-bind="bind" :ports="ports" :suggest-name="!nameEdited" />
            </template>
          </SchemaField>
        </div>
        <SchemaField v-bind="description" :required="false">
          <template #control="{ bind }">
            <Textarea
              v-bind="bind"
              :placeholder="t('porthole.descriptionPlaceholder')"
              :maxlength="500"
              :rows="2"
            />
          </template>
        </SchemaField>
        <SchemaField
          v-if="!editable"
          v-bind="slug"
          :description="t('porthole.slugHelp', { domain })"
          :placeholder="t('porthole.slugPlaceholder')"
        />
        <SchemaField v-bind="upstreamHostMode" :description="t('porthole.upstreamHostHelp')">
          <template #control="{ bind }">
            <Select v-bind="bind" :options="upstreamHostOptions" />
          </template>
        </SchemaField>
        <div class="grid items-start gap-4 sm:grid-cols-2">
          <SchemaField v-bind="duration" :control-props="editable ? { 'aria-describedby': durationHelpId } : undefined">
            <template #description>
              <Text
                v-if="editable"
                :id="durationHelpId"
                as="p"
                variant="caption"
                class="order-last text-muted-foreground"
              >
                {{ t('porthole.durationEditHelp') }}
              </Text>
            </template>
          </SchemaField>
          <SchemaField v-bind="quota" :control-props="{ 'aria-describedby': quotaHelpId }">
            <template #description>
              <Text
                :id="quotaHelpId"
                as="p"
                variant="caption"
                class="order-last text-muted-foreground"
              >
                {{ t('porthole.quotaHelp') }}
              </Text>
            </template>
          </SchemaField>
        </div>
        <SchemaField v-bind="keyMode">
          <template #control="{ bind }">
            <Select v-bind="bind" :options="keyOptions" />
          </template>
        </SchemaField>
        <SchemaField v-if="$form.values.keyMode === 'custom'" v-bind="secret">
          <template #control="{ bind }">
            <Input v-bind="bind" type="password" autocomplete="new-password" />
          </template>
        </SchemaField>
      </div>
      <Text
        v-if="error"
        as="p"
        variant="caption"
        class="mt-3 text-destructive"
        role="alert"
      >
        {{ error }}
      </Text>
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          :disabled="busy"
          @click="emit('cancel')"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button type="submit" :disabled="busy">
          {{ t(busy ? 'common.saving' : editable ? 'common.save' : 'porthole.create') }}
        </Button>
      </div>
    </template>
  </ShareSchemaForm>
</template>
