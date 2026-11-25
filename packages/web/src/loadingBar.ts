import { createLoadingBar } from '@ngt/ui/domains/loading-bar'
import { z } from 'zod'

const loadingBarConfigSchema = z.object({
  delay: z.coerce.number().nonnegative().catch(120),
  duration: z.coerce.number().nonnegative().catch(3000),
  position: z.enum(['fixed', 'absolute']).catch('fixed'),
  settleDuration: z.coerce.number().nonnegative().catch(300),
})

export const loadingBarConfig = loadingBarConfigSchema.parse({
  delay: import.meta.env.VITE_LOADING_BAR_DELAY_MS,
  duration: import.meta.env.VITE_LOADING_BAR_DURATION_MS,
  position: import.meta.env.VITE_LOADING_BAR_POSITION,
  settleDuration: import.meta.env.VITE_LOADING_BAR_SETTLE_DURATION_MS,
})

export const loadingBar = createLoadingBar(() => document.body, loadingBarConfig)
