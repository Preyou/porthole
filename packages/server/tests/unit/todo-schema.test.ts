import { expect, test } from 'bun:test'
import { todoCreateSchema, todoPatchSchema } from '../../src/models/todo'

test('待办标题在输入边界 trim，拒绝空白与超长标题，PATCH 不能为空', () => {
  expect(todoCreateSchema.parse({ title: '  Read a book  ' })).toEqual({ title: 'Read a book' })
  expect(todoCreateSchema.safeParse({ title: '   ' }).success).toBe(false)
  expect(todoCreateSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false)
  expect(todoPatchSchema.safeParse({}).success).toBe(false)
  expect(todoPatchSchema.safeParse({ completed: false }).success).toBe(true)
})
