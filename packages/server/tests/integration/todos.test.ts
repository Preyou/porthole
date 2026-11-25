import { afterAll, beforeAll, expect, test } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { app } from '../../src/app'
import { logtoSessionNamespace, SESSION_COOKIE_NAME } from '../../src/auth'
import { createRedisAuthStateStore } from '../../src/auth/stateStore'
import { db } from '../../src/db/pg'
import { todos, users } from '../../src/db/pg/schemas'
import env from '../../src/env'
import { createRedisConnection } from '../../src/redis/client'

const owners = [crypto.randomUUID(), crypto.randomUUID()]
const tokens = [crypto.randomUUID(), crypto.randomUUID()]
const hashes = tokens.map(token => new Bun.CryptoHasher('sha256').update(token).digest('base64url'))
const redis = createRedisConnection(env.redisUrl)
const store = createRedisAuthStateStore(redis, logtoSessionNamespace)
let todoId: string

beforeAll(async () => {
  await db.insert(users).values(owners.map(id => ({ id })))
  await Promise.all(owners.map((id, index) => store.createSession(hashes[index]!, id, 60)))
})
afterAll(async () => {
  await Promise.all(hashes.map(hash => store.deleteSession(hash)))
  await db.delete(users).where(inArray(users.id, owners))
  redis.close()
})

function request(path: string, method = 'GET', owner = 0, body?: unknown, origin = env.appOrigin) {
  return app.handle(new Request(`http://localhost/api${path}`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${tokens[owner]}`, origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }))
}

test('health 公开，业务默认认证，来源限制在统一边界执行', async () => {
  const health = await app.handle(new Request('http://localhost/api/health'))
  expect(health.status).toBe(200)
  expect(await health.json()).toMatchObject({ data: { status: 'ok' } })
  expect((await app.handle(new Request('http://localhost/api/todos'))).status).toBe(401)
  expect((await request('/health', 'GET', 0, undefined, 'https://other.example')).status).toBe(403)
})

test('真实待办 CRUD 隔离归属，非法输入与越权不修改数据库', async () => {
  const created = await request('/todos', 'POST', 0, { ownerId: owners[1], title: '  First task  ' })
  expect(created.status).toBe(201)
  const initial = (await created.json()).data
  todoId = initial.id
  expect(initial).toMatchObject({ completed: false, title: 'First task' })
  expect(initial).not.toHaveProperty('ownerId')
  expect((await db.select().from(todos).where(eq(todos.id, todoId)))[0]?.ownerId).toBe(owners[0])
  expect((await request('/todos', 'POST', 0, { title: '   ' })).status).toBe(422)
  expect((await request(`/todos/${todoId}`, 'PATCH', 0, {})).status).toBe(422)
  expect((await request('/todos', 'GET', 1)).status).toBe(200)
  expect((await (await request('/todos', 'GET', 1)).json()).data).toEqual([])
  expect((await request(`/todos/${todoId}`, 'PATCH', 1, { title: 'Not mine' })).status).toBe(403)
  expect((await request(`/todos/${todoId}`, 'DELETE', 1)).status).toBe(403)
  expect((await db.select().from(todos).where(eq(todos.id, todoId)))[0]?.title).toBe('First task')
  const saved = await request(`/todos/${todoId}`, 'PATCH', 0, { completed: true, title: '  Updated  ' })
  expect(saved.status).toBe(200)
  const updated = (await saved.json()).data
  expect(updated).toMatchObject({ completed: true, createdAt: initial.createdAt, id: todoId, title: 'Updated' })
  expect(updated.updatedAt).toBeGreaterThanOrEqual(initial.updatedAt)
  const list = (await (await request('/todos')).json()).data
  expect(list).toHaveLength(1)
  expect(list[0]).toEqual(updated)
  expect((await request(`/todos/${crypto.randomUUID()}`, 'PATCH', 0, { completed: true })).status).toBe(404)
  const deleted = await request(`/todos/${todoId}`, 'DELETE')
  expect(deleted.status).toBe(200)
  expect((await deleted.json()).data).toBeNull()
  expect((await request(`/todos/${todoId}`, 'DELETE')).status).toBe(404)
})

test('OpenAPI 只包含模板接口，并声明当前版本输入输出', async () => {
  const response = await app.handle(new Request(`http://localhost/api${env.openapiUrl}/json`))
  expect(response.status).toBe(200)
  const document = await response.json()
  const userSchema = document.paths['/users/me'].get.responses['200'].content['application/json'].schema.properties.data.properties
  expect(document.openapi).toBe('3.1.0')
  expect(userSchema.email).toMatchObject({ type: ['string', 'null'] })
  expect(document.paths).toHaveProperty('/todos')
  expect(document.paths['/todos/{id}']).toHaveProperty('patch')
  expect(Object.keys(document.paths).some(path => /characters|scripts|models|images/.test(path))).toBe(false)
})
