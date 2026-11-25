import { z } from 'zod'

export const todoCreateSchema = z.object({ title: z.string().trim().min(1).max(200) })
export const todoPatchSchema = todoCreateSchema.extend({ completed: z.boolean() }).partial().refine(value => Object.keys(value).length > 0, 'At least one field is required')
export const todoSchema = z.object({ completed: z.boolean(), createdAt: z.number(), id: z.string(), title: z.string(), updatedAt: z.number() })
export const todoIdSchema = z.object({ id: z.string().uuid() })
export type TodoCreate = z.infer<typeof todoCreateSchema>
export type TodoPatch = z.infer<typeof todoPatchSchema>
