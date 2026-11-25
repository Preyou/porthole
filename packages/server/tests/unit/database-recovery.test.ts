import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { integer, pgTable } from 'drizzle-orm/pg-core'
import { Elysia } from 'elysia'
import { createPostgresClient } from '../../src/db/pg/client'
import { DependencyUnavailableError } from '../../src/errors/dependencyUnavailable'
import { createFormatResponsePlugin } from '../../src/plugins/formatResponse'

function fakePool(operation: () => Promise<unknown>) {
  let closes = 0
  let cancellations = 0
  function query() {
    const pending = operation()
    return Object.assign(pending, {
      cancel() { cancellations++; return this },
      values() { return this },
    })
  }
  // 测试替身仅实现 Drizzle 使用的 Bun SQL 接口，记录是否重放及关闭错误的池。
  const pool = Object.assign(query, {
    begin: async (callback: (transaction: SQL) => Promise<unknown>) => callback(pool as unknown as SQL),
    close: async () => { closes++ },
    options: { bigint: false },
    savepoint: async (callback: (transaction: SQL) => Promise<unknown>) => callback(pool as unknown as SQL),
    unsafe: query,
  }) as unknown as SQL
  return { cancellations: () => cancellations, closes: () => closes, pool }
}

describe('PostgreSQL recovery', () => {
  test('实际 Drizzle 查询与嵌套事务使用收窄适配，不暴露原生 reserve', async () => {
    const fixture = fakePool(async () => [[7]])
    const client = createPostgresClient('', { createPool: () => fixture.pool })
    const database = drizzle({ client: client as unknown as SQL })
    expect(client).not.toHaveProperty('reserve')
    expect(client.options.bigint).toBe(true)
    const table = pgTable('fixture', { value: integer() })
    expect(await database.select({ value: sql<number>`7` }).from(table)).toEqual([{ value: 7 }])
    expect(await database.transaction(tx => tx.transaction(nested => nested.select({ value: sql<number>`7` }).from(table)))).toEqual([{ value: 7 }])
  })
  test('Bun SQLSTATE dependency errors return 503, retire the pool and do not replay', async () => {
    for (const errno of ['57014', '55P03', '57P01', '57P02', '57P03', '53300', '08006']) {
      const error = new SQL.PostgresError('server failure', { code: 'ERR_POSTGRES_SERVER_ERROR', errno })
      let operations = 0
      const old = fakePool(async () => {
        operations++
        throw error
      })
      const fresh = fakePool(async () => [{ value: 1 }])
      let pools = 0
      const client = createPostgresClient('', { createPool: () => pools++ === 0 ? old.pool : fresh.pool })
      const app = new Elysia().use(createFormatResponsePlugin()).get('/test', async () => {
        try { return await client.unsafe('select 1') }
        catch (cause) { throw new DrizzleQueryError('select 1', [], cause as Error) }
      })
      const response = await app.handle(new Request('http://localhost/test'))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ code: 10000503, data: null, message: 'server failure' })
      expect(operations).toBe(1)
      expect(old.closes()).toBe(1)
      expect(await client.unsafe<Array<{ value: number }>>('select 1')).toEqual([{ value: 1 }])
      expect(fresh.closes()).toBe(0)
    }
  })

  test('concurrent timeouts retire the old pool once and subsequent query uses a new pool', async () => {
    const old = fakePool(() => new Promise(() => {}))
    const fresh = fakePool(async () => [{ value: 1 }])
    let pools = 0
    const client = createPostgresClient('', { createPool: () => pools++ === 0 ? old.pool : fresh.pool, timeoutMs: 20 })
    const failures = await Promise.allSettled([client.unsafe('select 1').values(), client.unsafe('select 2')])
    expect(failures.every(result => result.status === 'rejected' && result.reason.code === 10000503)).toBe(true)
    expect(old.closes()).toBe(1)
    expect(old.cancellations()).toBe(2)
    expect(await client.unsafe<Array<{ value: number }>>('select 1')).toEqual([{ value: 1 }])
    expect(pools).toBe(2)
    expect(fresh.closes()).toBe(0)
  })

  test('connection failure is not replayed and the next operation can recover', async () => {
    let writes = 0
    const old = fakePool(async () => {
      writes++
      throw Object.assign(new Error('connection closed'), { code: 'ERR_POSTGRES_CONNECTION_CLOSED' })
    })
    const fresh = fakePool(async () => [])
    let pools = 0
    const client = createPostgresClient('', { createPool: () => pools++ === 0 ? old.pool : fresh.pool })
    await expect(Promise.resolve(client.unsafe('insert into test values (1)'))).rejects.toMatchObject({ code: 10000503 })
    expect(writes).toBe(1)
    expect(await client.unsafe<unknown[]>('select 1')).toEqual([])
  })

  test('SQL and constraint errors retain their original semantics', async () => {
    for (const errno of ['23505', '23514', '42601']) {
      const error = new SQL.PostgresError('SQL or constraint error', { code: 'ERR_POSTGRES_SERVER_ERROR', errno })
      const fixture = fakePool(async () => { throw error })
      const client = createPostgresClient('', { createPool: () => fixture.pool })
      await expect(Promise.resolve(client.unsafe('insert'))).rejects.toBe(error)
      expect(fixture.closes()).toBe(0)
    }
  })

  test('transaction and savepoint clients are protected by the same deadline', async () => {
    const fixture = fakePool(() => new Promise(() => {}))
    const client = createPostgresClient('', { createPool: () => fixture.pool, timeoutMs: 20 })
    await expect(client.begin(tx => tx.savepoint(nested => nested.unsafe('select 1')))).rejects.toMatchObject({ code: 10000503 })
    expect(fixture.closes()).toBe(1)
  })

  test('ORM-wrapped dependency failure returns 503 while preserving the cause', async () => {
    const cause = new DependencyUnavailableError('Database', new Error('private driver error'))
    const wrapped = new DrizzleQueryError('select 1', [], cause)
    const app = new Elysia().use(createFormatResponsePlugin()).get('/test', () => { throw wrapped })
    const response = await app.handle(new Request('http://localhost/test'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 10000503, data: null, message: 'private driver error' })
    expect(wrapped.cause).toBe(cause)
  })
})
