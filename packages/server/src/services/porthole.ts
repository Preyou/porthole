import { z } from 'zod'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { createService } from '@/global'
import { responseDTO } from '@/plugins/formatResponse'
import { shareDomain } from '@/porthole/config'
import { discoverPorts } from '@/porthole/discovery'
import { discoveredPortSchema, shareChangeSchema, shareCreateSchema, shareIdSchema, shareResultSchema, shareSchema } from '@/porthole/models'
import { changeShare, createShare, deleteShare, listShares } from '@/porthole/shares'

export const portholeService = createService('porthole-service')
  .group('/porthole', app => app
    .get('/ports', async ({ format, set }) => {
      set.headers['cache-control'] = 'no-store'
      return format({ domain: shareDomain, ports: await discoverPorts() })
    }, {
      detail: { tags: ['porthole'] },
      response: { 200: responseDTO(z.object({ domain: z.string(), ports: z.array(discoveredPortSchema) })) },
    })
    .get('/shares', async ({ auth, format, set }) => {
      set.headers['cache-control'] = 'no-store'
      return format(await listShares(auth.userId))
    }, {
      detail: { tags: ['porthole'] },
      response: { 200: responseDTO(z.array(shareSchema)) },
    })
    .post('/shares', async ({ auth, body, format, set }) => {
      set.headers['cache-control'] = 'no-store'
      return format(await createShare(auth.userId, body), RESPONSE_CODES.CREATED)
    }, {
      body: shareCreateSchema,
      detail: { tags: ['porthole'] },
      response: { 201: responseDTO(shareResultSchema) },
    })
    .patch('/shares/:id', async ({ auth, body, format, params, set }) => {
      set.headers['cache-control'] = 'no-store'
      return format(await changeShare(auth.userId, params.id, body))
    }, {
      body: shareChangeSchema,
      detail: { tags: ['porthole'] },
      params: shareIdSchema,
      response: { 200: responseDTO(shareResultSchema) },
    })
    .delete('/shares/:id', async ({ auth, format, params, set }) => {
      set.headers['cache-control'] = 'no-store'
      return format(await deleteShare(auth.userId, params.id))
    }, {
      detail: { tags: ['porthole'] },
      params: shareIdSchema,
      response: { 200: responseDTO(shareIdSchema) },
    }))
