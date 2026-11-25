import { expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { createFormatResponsePlugin } from '../../src/plugins/formatResponse'
import { createListQueryWhitelistPlugin } from '../../src/plugins/listQueryWhitelist'
import { paginationQuerySchema } from '../../src/plugins/paginationStandard'

const listQuerySchema = z.object({ ...paginationQuerySchema.shape, dimensions: z.union([z.string(), z.array(z.string())]).transform(value => typeof value === 'string' ? value.split(',') : value).pipe(z.array(z.enum(['title', 'completed']))).default(['title', 'completed']), keyword: z.string().default('') })

const app = new Elysia()
  .use(createFormatResponsePlugin())
  .use(createListQueryWhitelistPlugin())
  .get('/list', ({ format, query }) => format({ ...query, pageType: typeof query.page }), {
    query: listQuerySchema,
    transform({ query, request }) { query.keyword = new URL(request.url).searchParams.get('keyword') ?? '' },
    useListQueryWhitelist: { allowQueryKeys: ['keyword', 'dimensions'] },
  })

test('白名单保留路由转换，维度归一化，关键词逗号保持字面值', async () => {
  const response = await app.handle(new Request('http://localhost/list?page=2&pageSize=20&dimensions=title,completed&keyword=a%2Cb'))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ data: { dimensions: ['title', 'completed'], keyword: 'a,b', page: 2, pageSize: 20, pageType: 'number' } })
  const defaults = await app.handle(new Request('http://localhost/list'))
  expect(await defaults.json()).toMatchObject({ data: { dimensions: ['title', 'completed'], page: 1, pageSize: 12 } })
})

test('白名单在 schema 剥离前拒绝未知字段，非法分页和维度保留422', async () => {
  expect((await app.handle(new Request('http://localhost/list?ownerId=other'))).status).toBe(400)
  expect((await app.handle(new Request('http://localhost/list?sortBy=name'))).status).toBe(400)
  expect((await app.handle(new Request('http://localhost/list?sortOrder=asc'))).status).toBe(400)
  for (const query of ['page=2oops', 'page=0', 'pageSize=101', 'dimensions=unknown']) {
    expect((await app.handle(new Request(`http://localhost/list?${query}`))).status).toBe(422)
  }
})

test('声明的排序与过滤不因路由 schema 剥离字段而失效', async () => {
  const sorted = new Elysia().use(createFormatResponsePlugin()).use(createListQueryWhitelistPlugin()).get('/sorted', ({ format, listQuery }) => format(listQuery), {
    query: listQuerySchema,
    useListQueryWhitelist: { allowFilterFields: ['owner'], allowSortFields: ['name'], defaultSortOrder: 'desc' },
  })
  const response = await sorted.handle(new Request('http://localhost/sorted?sortBy=name&owner=one&owner=two'))
  expect(await response.json()).toMatchObject({ data: { filters: { owner: ['one', 'two'] }, sortBy: 'name', sortOrder: 'desc' } })
  expect((await sorted.handle(new Request('http://localhost/sorted?sortBy=name&sortOrder=invalid'))).status).toBe(400)
})
