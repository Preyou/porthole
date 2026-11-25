import type {
  ThemeEntry,
  ThemeMode,
  ThemeSchema,
  ThemeSource,
} from '@ngt/ui/domains/theme'
import {
  createThemeEntry,
  createThemeSchema,
} from '@ngt/ui/domains/theme'
import defaultDarkThemeSource from './default.dark.json'
import defaultThemeSource from './default.json'
import defaultSchemaSource from './default.schema.json'

type JsonSchemaSource = Record<string, unknown>

interface ThemeFile {
  mode: ThemeMode
  name: string
  source: ThemeSource
}

const defaultThemeSchema = createThemeSchema(defaultSchemaSource as JsonSchemaSource)

const themeFiles = import.meta.glob(['./*.json', '!./*.schema.json'], {
  eager: true,
  import: 'default',
}) as Record<string, ThemeSource>

const schemaFiles = import.meta.glob('./*.schema.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonSchemaSource>

function resolveThemeFile(path: string, source: ThemeSource): ThemeFile | null {
  const fileName = /\/([^/]+)\.json$/.exec(path)?.[1]
  if (!fileName || fileName.endsWith('.schema')) {
    return null
  }

  const mode = fileName.endsWith('.dark') ? 'dark' : 'light'
  const name = fileName.replace(/\.dark$/, '')

  return {
    mode,
    name,
    source,
  }
}

function resolveSchemaName(path: string): string | null {
  return /\/([^/]+)\.schema\.json$/.exec(path)?.[1] ?? null
}

function createAppThemeSchema(schemaSource?: JsonSchemaSource): ThemeSchema {
  if (!schemaSource) {
    return defaultThemeSchema
  }

  return defaultThemeSchema.extend(createThemeSchema(schemaSource).shape)
}

const groupedThemeFiles = Object.entries(themeFiles).reduce<Record<string, Partial<Record<ThemeMode, ThemeSource>>>>(
  (groups, [path, source]) => {
    const themeFile = resolveThemeFile(path, source)
    if (!themeFile) {
      return groups
    }

    return {
      ...groups,
      [themeFile.name]: {
        ...groups[themeFile.name],
        [themeFile.mode]: themeFile.source,
      },
    }
  },
  {},
)

const groupedSchemas = Object.fromEntries(
  Object.entries(schemaFiles).flatMap(([path, source]) => {
    const name = resolveSchemaName(path)
    if (!name) {
      return []
    }

    return [[name, name === 'default' ? defaultThemeSchema : createAppThemeSchema(source)]]
  }),
) as Record<string, ThemeSchema>

const themeNames = Array.from(new Set([
  'default',
  ...Object.keys(groupedThemeFiles),
  ...Object.keys(groupedSchemas),
]))
  .sort((a, b) => {
    if (a === 'default') {
      return -1
    }
    if (b === 'default') {
      return 1
    }
    return a.localeCompare(b, 'zh-Hans-CN')
  })

export const appThemeMap = new Map<string, ThemeEntry>(
  themeNames.map((name) => {
    const schema = groupedSchemas[name] ?? defaultThemeSchema
    const themeSource = groupedThemeFiles[name] ?? {}

    return [
      name,
      createThemeEntry({
        dark: {
          ...defaultDarkThemeSource,
          ...themeSource.dark,
        },
        light: {
          ...defaultThemeSource,
          ...themeSource.light,
        },
        name,
        schema,
      }),
    ]
  }),
)

export const appThemes = Array.from(appThemeMap.values())
