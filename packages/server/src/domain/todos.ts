import type { TodoCreate, TodoPatch } from '@/models/todo'
import { desc, eq } from 'drizzle-orm'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { db } from '@/db/pg'
import { todos } from '@/db/pg/schemas'
import { ResponseCodeError } from '@/errors/responseCode'

const publicTodo = { completed: todos.completed, createdAt: todos.createdAt, id: todos.id, title: todos.title, updatedAt: todos.updatedAt }

export function listTodos(ownerId: string) {
  return db.select(publicTodo).from(todos).where(eq(todos.ownerId, ownerId)).orderBy(desc(todos.createdAt), desc(todos.id))
}

export async function createTodo(ownerId: string, input: TodoCreate) {
  const [created] = await db.insert(todos).values({ ...input, id: crypto.randomUUID(), ownerId }).returning(publicTodo)
  return created!
}

type PublicTodo = Awaited<ReturnType<typeof createTodo>>
export function mutateTodo(id: string, authorize: (resource: { ownerId: string }) => void, patch: TodoPatch): Promise<PublicTodo>
export function mutateTodo(id: string, authorize: (resource: { ownerId: string }) => void, patch: null): Promise<null>
export async function mutateTodo(id: string, authorize: (resource: { ownerId: string }) => void, patch: TodoPatch | null) {
  return db.transaction(async (tx) => {
    // 锁定实际资源后授权与修改，避免检查和写入之间的数据竞态。
    const [resource] = await tx.select().from(todos).where(eq(todos.id, id)).for('update')
    if (!resource) { throw new ResponseCodeError(RESPONSE_CODES.NOT_FOUND) }
    authorize(resource)
    if (patch === null) {
      await tx.delete(todos).where(eq(todos.id, id))
      return null
    }
    const [updated] = await tx.update(todos).set(patch).where(eq(todos.id, id)).returning(publicTodo)
    return updated!
  })
}
