interface ImportMetaEnv {
  readonly API_PREFIX: string
  readonly NODE_ENV: 'development' | 'production' | 'test'
  readonly DATABASE_URL: string
  readonly REDIS_URL: string
  readonly PORT: string
  readonly APP_ORIGIN: string
  readonly OPENAPI_URL: string
  readonly LOGTO_ENDPOINT: string
  readonly LOGTO_APP_ID: string
  readonly LOGTO_APP_SECRET: string
  readonly LOGTO_API_RESOURCE: string
  readonly LOGTO_API_SCOPE: string
}
