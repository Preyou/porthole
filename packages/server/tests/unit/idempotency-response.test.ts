import { expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { RESPONSE_CODES } from '../../src/constants/responseCodeMap'
import { createFormatResponsePlugin, ResponseCodeError } from '../../src/plugins/formatResponse'
import { createIdempotencyPlugin } from '../../src/plugins/idempotency'

function request(key?: string, value = 1) {
  return new Request('http://localhost/write', { body: JSON.stringify({ value }), headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, method: 'POST' })
}

for (const mode of ['created', 'business-error', 'unknown-error'] as const) {
  test(`幂等重放保留八位结果码、独立 HTTP 状态和原始 message：${mode}`, async () => {
    let calls = 0
    const app = new Elysia().use(createIdempotencyPlugin()).use(createFormatResponsePlugin()).post('/write', ({ format }) => {
      calls++
      if (mode === 'business-error') { throw new ResponseCodeError(RESPONSE_CODES.INVALID_INPUT, 'invalid input') }
      if (mode === 'unknown-error') { throw new Error('unexpected failure') }
      return format({ id: 'created' }, RESPONSE_CODES.CREATED)
    }, { useIdempotency: true })
    const key = crypto.randomUUID()
    const first = await app.handle(request(key))
    const original = await first.json()
    const replay = await app.handle(request(key))
    expect(replay.status).toBe(first.status)
    expect(await replay.json()).toEqual(original)
    expect(replay.headers.get('x-idempotency-replayed')).toBe('1')
    expect(calls).toBe(1)
    expect(original).toMatchObject({ code: mode === 'created' ? RESPONSE_CODES.CREATED : mode === 'business-error' ? RESPONSE_CODES.INVALID_INPUT : RESPONSE_CODES.INTERNAL_ERROR })
    if (mode === 'created') {
      const conflict = await app.handle(request(key, 2))
      expect(conflict.status).toBe(409)
      expect(await conflict.json()).toMatchObject({ code: RESPONSE_CODES.CONFLICT, message: expect.any(String) })
      const missing = await app.handle(request())
      expect(missing.status).toBe(400)
      expect(await missing.json()).toMatchObject({ code: RESPONSE_CODES.BAD_REQUEST })
    }
  })
}
