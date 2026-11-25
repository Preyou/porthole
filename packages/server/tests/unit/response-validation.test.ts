import { expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { createFormatResponsePlugin, responseDTO } from '../../src/plugins/formatResponse'

const app = new Elysia().use(createFormatResponsePlugin()).post('/input', ({ body, format }) => format(body), { body: z.object({ value: z.number().min(0) }) }).get('/output', ({ format }) => format({ value: 'invalid' as unknown as number }), { response: { 200: responseDTO(z.object({ value: z.number() })) } })

test('输入校验失败返回422，响应契约错误保留500', async () => {
  const input = await app.handle(new Request('http://localhost/input', { body: JSON.stringify({ value: -1 }), headers: { 'Content-Type': 'application/json' }, method: 'POST' }))
  expect(input.status).toBe(422)
  expect((await input.json() as { code: number }).code).toBe(10000422)
  expect((await app.handle(new Request('http://localhost/output'))).status).toBe(500)
})
