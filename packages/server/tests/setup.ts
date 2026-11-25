const defaults = {
  API_PREFIX: '/api',
  APP_ORIGIN: 'http://localhost:1282',
  DATABASE_URL: 'postgresql://yuumi:yuumi@127.0.0.1:25432/yuumi',
  LOG_MASK: '0',
  LOGTO_API_RESOURCE: 'https://api.example.test',
  LOGTO_API_SCOPE: 'api',
  LOGTO_APP_ID: 'test-client',
  LOGTO_APP_SECRET: 'test-secret',
  LOGTO_ENDPOINT: 'http://localhost:23001',
  NODE_ENV: 'test',
  OPENAPI_URL: '/openapi',
  PORT: '3100',
  REDIS_URL: 'redis://127.0.0.1:26379/0',
}
for (const [key, value] of Object.entries(defaults)) {
  if (!import.meta.env[key]?.trim()) { import.meta.env[key] = value }
}
