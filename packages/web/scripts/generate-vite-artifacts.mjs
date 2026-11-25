import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const appRootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await mkdir(resolve(appRootDir, 'types/auto'), { recursive: true })
await build({
  build: {
    write: false,
  },
  configFile: resolve(appRootDir, 'vite.config.ts'),
  root: appRootDir,
})
