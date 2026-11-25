import { z } from 'zod'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { createTodo, listTodos, mutateTodo } from '@/domain/todos'
import { createService } from '@/global'
import { todoCreateSchema, todoIdSchema, todoPatchSchema, todoSchema } from '@/models/todo'
import { responseDTO } from '@/plugins/formatResponse'

export const todosService = createService('todos-service')
  .group('/todos', app => app
    .get('', async ({ auth, format }) => format(await listTodos(auth.userId)), {
      detail: { tags: ['todos'] },
      response: { 200: responseDTO(z.array(todoSchema)) },
    })
    .post('', async ({ authorizeCreate, body, format }) => format(await createTodo(authorizeCreate().ownerId, body), RESPONSE_CODES.CREATED), {
      body: todoCreateSchema,
      detail: { tags: ['todos'] },
      response: { 201: responseDTO(todoSchema) },
    })
    .patch('/:id', async ({ authorize, body, format, params }) => format(await mutateTodo(params.id, authorize, body)), {
      body: todoPatchSchema,
      detail: { tags: ['todos'] },
      params: todoIdSchema,
      response: { 200: responseDTO(todoSchema) },
    })
    .delete('/:id', async ({ authorize, format, params }) => format(await mutateTodo(params.id, authorize, null)), {
      detail: { tags: ['todos'] },
      params: todoIdSchema,
      response: { 200: responseDTO(z.null()) },
    }))
