import { z } from 'zod'
import { createService } from '@/global'
import { responseDTO } from '@/plugins/formatResponse'

export const usersService = createService('users-service')
  .group('/users', app => app
    .get('/me', ({ auth, format }) => format(auth.user), {
      detail: { tags: ['users'] },
      response: { 200: responseDTO(z.object({ email: z.string().nullable(), id: z.string(), image: z.string().nullable(), name: z.string().nullable() })) },
      useAuth: true,
    }))
