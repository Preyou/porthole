import { defineConfig } from 'drizzle-kit'

type RawEnv = Record<string, string | undefined>
const rawEnv = import.meta.env as unknown as RawEnv

function normalizeText(input: string | undefined) {
  const normalized = input?.trim()
  return normalized || undefined
}

const databaseUrl = normalizeText(rawEnv.DATABASE_URL)
if (!databaseUrl) {
  throw new Error('[drizzle config] Missing required env var: DATABASE_URL')
}

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
    // 或分开写：host, port, user: process.env.DB_USER, password: process.env.DB_PASSWORD 等
  },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/db/pg/schemas/*.table.ts',
})
