import type { RequestCreatePaginationProtocol } from '@ngt/ui/domains/request'
import { createRequest } from '@ngt/ui/domains/request'
import { loadingBar } from '../loadingBar'
import { sysApi } from './sysApi'

interface PagedResponse<Item> {
  data: {
    items: Item[]
    total: number
  }
}

interface RequestParamsWithQuery {
  params?: Record<string, unknown>
}

const paginationProtocol = {
  firstPage: 1,
  fromResponse: (response: unknown) => {
    const pagedResponse = response as PagedResponse<unknown>

    return {
      list: pagedResponse.data.items,
      total: pagedResponse.data.total,
    }
  },
  toParams: ({ page, pageSize, params }) => {
    const requestParams = params as RequestParamsWithQuery

    return {
      ...requestParams,
      params: {
        ...(requestParams.params ?? {}),
        page,
        pageSize,
      },
    }
  },
} satisfies RequestCreatePaginationProtocol

export const useRequest = createRequest(sysApi, {
  loadingBar: {
    instance: loadingBar,
    mode: 'auto',
  },
  pagination: paginationProtocol,
})
