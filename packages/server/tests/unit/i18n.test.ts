import { expect, test } from 'bun:test'
import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { RESPONSE_CODE_MAP, RESPONSE_CODES } from '../../src/constants/responseCodeMap'
import { createI18n, locales } from '../../src/locales'
import { createFormatResponsePlugin, ResponseCodeError, responseDTO } from '../../src/plugins/formatResponse'
import { createI18nPlugin } from '../../src/plugins/i18n'

const req = (path: string) => new Request(`http://localhost${path}`)

test('所有结果码为八位 1/2 前缀，中英文翻译与注册表完全一致', () => {
  expect(Object.keys(locales['zh-CN']).sort()).toEqual(Object.keys(RESPONSE_CODE_MAP).sort())
  expect(Object.keys(locales['en-US']).sort()).toEqual(Object.keys(RESPONSE_CODE_MAP).sort())
  expect(new Set(Object.values(RESPONSE_CODES)).size).toBe(Object.keys(RESPONSE_CODES).length)
  for (const [code, definition] of Object.entries(RESPONSE_CODE_MAP)) {
    expect(code).toMatch(/^[12]\d{7}$/)
    expect(code.startsWith('2')).toBe(definition.httpStatus >= 200 && definition.httpStatus < 300)
    expect(locales['zh-CN'][code as keyof typeof locales['zh-CN']]).not.toBe('')
    expect(locales['en-US'][code as keyof typeof locales['en-US']]).not.toBe('')
  }
})

test('公开字典继承 API 前缀，未知语言返回八位失败码，公开作用域不泄漏', async () => {
  const app = new Elysia().group('/api', app => app.use(createI18nPlugin()).use(createFormatResponsePlugin()).get('/success', ({ format, i18n }) => format(i18n(RESPONSE_CODES.SUCCESS))))
  for (const locale of ['zh-CN', 'en-US'] as const) {
    const response = await app.handle(req(`/api/i18n/${locale}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ code: RESPONSE_CODES.SUCCESS, data: { server: locales[locale] }, message: '' })
  }
  expect(await (await app.handle(req('/api/success'))).json()).toEqual({ code: RESPONSE_CODES.SUCCESS, data: 'server.20000000', message: '' })
  const missing = await app.handle(req('/api/i18n/fr-FR'))
  expect(missing.status).toBe(404)
  expect(await missing.json()).toEqual({ code: RESPONSE_CODES.NOT_FOUND, data: null, message: '' })
})

test('自定义命名空间/前缀只影响字典，code 稳定，message 保留原始诊断或为空', async () => {
  const instance = createI18n({ namespace: 'backend', prefix: '/translations/' })
  const app = new Elysia().use(createI18nPlugin(instance)).use(createFormatResponsePlugin()).get('/explicit', () => {
    throw new ResponseCodeError(RESPONSE_CODES.INVALID_INPUT, 'invalid input')
  }).get('/empty', () => {
    throw new ResponseCodeError(RESPONSE_CODES.INVALID_INPUT)
  }).get('/unknown', () => {
    throw new Error('original driver error')
  })
  expect(await (await app.handle(req('/translations/en-US'))).json()).toEqual({ code: RESPONSE_CODES.SUCCESS, data: { backend: locales['en-US'] }, message: '' })
  const explicit = await app.handle(req('/explicit'))
  expect(explicit.status).toBe(422)
  expect(await explicit.json()).toEqual({ code: 10000422, data: null, message: 'invalid input' })
  expect(await (await app.handle(req('/empty'))).json()).toEqual({ code: 10000422, data: null, message: '' })
  const unknown = await app.handle(req('/unknown'))
  expect(unknown.status).toBe(500)
  expect(await unknown.json()).toEqual({ code: 10000000, data: null, message: 'original driver error' })
  expect(instance.i18n(RESPONSE_CODES.INVALID_INPUT)).toBe('backend.10000422')
  expect(createI18n({ namespace: '' }).i18n(RESPONSE_CODES.INTERNAL_ERROR)).toBe('10000000')
  expect(createI18n({ namespace: '' }).dictionaries['en-US']).toEqual(locales['en-US'])
})

test('输入与响应校验保持 HTTP 422/500，使用失败码并保留诊断', async () => {
  const app = new Elysia().use(createFormatResponsePlugin()).post('/input', ({ body, format }) => format(body), { body: z.object({ count: z.number() }) }).get('/output', ({ format }) => format('invalid' as unknown as number), { response: { 200: responseDTO(z.number()) } })
  const invalid = await app.handle(new Request('http://localhost/input', { body: '{"count":"wrong-type"}', headers: { 'content-type': 'application/json' }, method: 'POST' }))
  expect(invalid.status).toBe(422)
  expect(await invalid.json()).toMatchObject({ code: RESPONSE_CODES.INVALID_INPUT, data: null, message: expect.stringContaining('count') })
  const output = await app.handle(req('/output'))
  expect(output.status).toBe(500)
  expect(await output.json()).toMatchObject({ code: RESPONSE_CODES.INTERNAL_ERROR, data: null, message: expect.any(String) })
})

test('OpenAPI 声明统一包装字典、公开访问与八位结果码响应', async () => {
  const app = new Elysia().use(openapi({ path: '/openapi' })).use(createI18nPlugin()).use(createFormatResponsePlugin()).get('/success', ({ format }) => format(null), { response: { 200: responseDTO(z.null()) } })
  const document = await (await app.handle(req('/openapi/json'))).json() as { paths: Record<string, { get: { security: unknown[], responses: Record<string, { content: Record<string, { schema: { type: string, properties: Record<string, { minimum: number, maximum: number }> } }> }> } }> }
  expect(document.paths['/i18n/zh-CN'].get.security).toEqual([])
  expect(document.paths['/i18n/zh-CN'].get.responses['200'].content['application/json'].schema.type).toBe('object')
  expect(document.paths['/i18n/zh-CN'].get.responses['200'].content['application/json'].schema.properties).toHaveProperty('data')
  const schema = document.paths['/success'].get.responses['200'].content['application/json'].schema
  expect(schema.properties.code).toMatchObject({ maximum: 29999999, minimum: 10000000 })
})

test('默认/特殊成功码对应不同翻译，HTTP 状态与 message 独立', async () => {
  const app = new Elysia().use(createFormatResponsePlugin()).get('/default', ({ format }) => format(null)).get('/created', ({ format }) => format(null, RESPONSE_CODES.CREATED)).get('/saved', ({ format }) => format({ id: 'test' }, RESPONSE_CODES.SUCCESS)).get('/diagnostic', ({ format }) => format(null, RESPONSE_CODES.SUCCESS, 'original diagnostic')).get('/failure', ({ format }) => format(null, RESPONSE_CODES.CONFLICT))
  for (const [path, code, status] of [['/default', RESPONSE_CODES.SUCCESS, 200], ['/created', RESPONSE_CODES.CREATED, 201]] as const) {
    const response = await app.handle(req(path))
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ code, data: null, message: '' })
  }
  expect(await (await app.handle(req('/saved'))).json()).toEqual({ code: RESPONSE_CODES.SUCCESS, data: { id: 'test' }, message: '' })
  expect(await (await app.handle(req('/diagnostic'))).json()).toEqual({ code: RESPONSE_CODES.SUCCESS, data: null, message: 'original diagnostic' })
  const failure = await app.handle(req('/failure'))
  expect(failure.status).toBe(409)
  expect(await failure.json()).toEqual({ code: RESPONSE_CODES.CONFLICT, data: null, message: '' })
  expect(locales['zh-CN']['20000000']).toBe('请求成功')
  expect(locales['zh-CN']['20000001']).not.toBe('')
})
