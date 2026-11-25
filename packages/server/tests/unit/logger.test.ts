import { $ } from 'bun'
import { expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { createFormatResponsePlugin, responseDTO } from '../../src/plugins/formatResponse'
import { createLoggerPlugin, LogMasks } from '../../src/plugins/logger'

test('Pino 接入保留 trace、路由静默和深层脱敏', async () => {
  const lines: string[] = []
  const app = new Elysia().use(createLoggerPlugin({ mask: LogMasks.TRACE, redactKeys: ['imageUrl'], stream: { write(line) { lines.push(line) } } })).post('/log', ({ body, log, traceId }) => {
    log.info({ nested: { credentials: { accessToken: 'manual-secret' }, fields: { 'Policy': 'policy-secret', 'X-Amz-Credential': 'credential-secret', 'X-Amz-Signature': 'signature-secret' } } }, '手动日志')
    return { body, imageUrl: 'signed-secret', traceId }
  }).get('/silent', ({ log }) => { log.info('不可输出'); return null }, { useLogger: false })
  const traceId = 'a'.repeat(32)
  const response = await app.handle(new Request('http://localhost/log', {
    body: JSON.stringify({ nested: { password: 'body-secret' } }),
    headers: { 'Content-Type': 'application/json', 'Cookie': 'cookie-secret', 'x-trace-id': traceId },
    method: 'POST',
  }))
  expect(response.headers.get('x-trace-id')).toBe(traceId)
  expect(await response.json()).toMatchObject({ traceId })
  expect(lines.length).toBeGreaterThan(0)
  const output = lines.join('')
  for (const secret of ['manual-secret', 'signed-secret', 'body-secret', 'cookie-secret', 'policy-secret', 'credential-secret', 'signature-secret']) { expect(output).not.toContain(secret) }
  expect(output).toContain('[REDACTED]')
  const before = lines.length
  await app.handle(new Request('http://localhost/silent'))
  expect(lines.length).toBe(before)
})

test('响应校验日志不会泄露 found 中的预签名地址', async () => {
  const lines: string[] = []
  const app = new Elysia().use(createLoggerPlugin({ mask: LogMasks.ERROR_CONTEXT, stream: { write(line) { lines.push(line) } } })).use(createFormatResponsePlugin()).get('/invalid', ({ format }) => format({ value: 'https://private.example/?signature=secret' as unknown as number }), { response: { 200: responseDTO(z.object({ value: z.number() })) } })
  const response = await app.handle(new Request('http://localhost/invalid'))
  expect(response.status).toBe(500)
  expect(lines.join('')).toContain('validation failed')
  expect(lines.join('')).not.toContain('signature=secret')
})

test('实际文件输出按大小轮转，并配置按天保留', async () => {
  const directory = `/tmp/yuumi-logger-${crypto.randomUUID()}`
  const app = new Elysia().use(createLoggerPlugin({
    logsDir: directory,
    logsMaxBytes: 1024,
    logsRetentionDays: 7,
    mask: LogMasks.FILE_INFO,
    stream: { write() {} },
  })).get('/file', ({ log }) => { log.info({ message: 'a'.repeat(1500) }); return null }).listen(0)
  try {
    for (let index = 0; index < 3; index++) { await app.handle(new Request('http://localhost/file')) }
    await app.stop()
    // 第三方流异步刷新，等待其完成磁盘写入后检查真实输出。
    await Bun.sleep(20)
    const files = await Array.fromAsync(new Bun.Glob('*.log').scan({ cwd: directory }))
    expect(files.length).toBeGreaterThan(1)
    const audit = await Bun.file(`${directory}/.rotation-audit.json`).json()
    expect(audit.keepSettings).toMatchObject({ amount: 7, type: 1 })
    expect((await Promise.all(files.map(file => Bun.file(`${directory}/${file}`).text()))).join('')).toContain('a'.repeat(1500))
  }
  finally { await $`rm -rf ${directory}`.quiet() }
})
