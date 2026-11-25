import { expect, test } from 'bun:test'
import { parseAppOrigin, readAuthSettings } from '../../src/auth/config'

test('登录模式允许延迟填写 Logto 配置并保留历史默认值', () => {
  expect(readAuthSettings({})).toMatchObject({ authMode: 'logto', logtoConfigured: false })
  expect(readAuthSettings({ AUTH_MODE: 'off' }).authMode).toBe('off')
  expect(readAuthSettings({ AUTH_MODE: 'local' }).authMode).toBe('local')
  expect(() => readAuthSettings({ AUTH_MODE: 'unknown' })).toThrow('AUTH_MODE')
  const logto = {
    AUTH_MODE: 'logto',
    LOGTO_API_RESOURCE: 'https://api.example.test',
    LOGTO_APP_ID: 'fixture-client',
    LOGTO_APP_SECRET: 'fixture-secret',
    LOGTO_ENDPOINT: 'https://auth.example.test/',
  }
  expect(readAuthSettings(logto)).toMatchObject({ logtoConfigured: true, logtoEndpoint: 'https://auth.example.test' })
  expect(readAuthSettings({ ...logto, LOGTO_APP_SECRET: '' }).logtoConfigured).toBe(false)
  expect(readAuthSettings({ ...logto, LOGTO_ENDPOINT: 'invalid-config' }).logtoConfigured).toBe(false)
  expect(parseAppOrigin('http://localhost:1282/')).toBe('http://localhost:1282')
  expect(() => parseAppOrigin('https://credential@example.test')).toThrow('APP_ORIGIN')
})
