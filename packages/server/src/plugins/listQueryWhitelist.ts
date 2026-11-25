import { Elysia } from 'elysia'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import { ResponseCodeError } from './formatResponse'

type SortOrder = 'asc' | 'desc'

export interface ListQueryWhitelistConfig {
  pageKey: string
  pageSizeKey: string
  sortByKey: string
  sortOrderKey: string
}

export interface ListQueryWhitelistRouteOptions extends Partial<ListQueryWhitelistConfig> {
  allowFilterFields?: readonly string[]
  allowQueryKeys?: readonly string[]
  allowSortFields?: readonly string[]
  defaultSortOrder?: SortOrder
}

export interface ListQueryState {
  filters: Record<string, string | string[]>
  sortBy: string | null
  sortOrder: SortOrder | null
}

export const DEFAULT_LIST_QUERY_WHITELIST_CONFIG: ListQueryWhitelistConfig = {
  pageKey: 'page',
  pageSizeKey: 'pageSize',
  sortByKey: 'sortBy',
  sortOrderKey: 'sortOrder',
}

function mergeConfig(
  base: ListQueryWhitelistConfig,
  override?: Partial<ListQueryWhitelistConfig>,
): ListQueryWhitelistConfig {
  if (!override) { return base }

  return {
    ...base,
    ...override,
  }
}

export function createListQueryWhitelistPlugin(config: Partial<ListQueryWhitelistConfig> = {}) {
  const baseConfig = mergeConfig(DEFAULT_LIST_QUERY_WHITELIST_CONFIG, config)

  return new Elysia({
    name: 'list-query-whitelist-plugin',
  })
    .decorate('listQueryWhitelistConfig', baseConfig)
    .macro({
      useListQueryWhitelist: (routeOptions: boolean | ListQueryWhitelistRouteOptions = true) => {
        const normalizedRouteOptions = routeOptions === true || routeOptions === false
          ? {}
          : routeOptions

        const currentConfig = mergeConfig(baseConfig, normalizedRouteOptions)

        return {
          resolve({ request }) {
            const parameters = new URL(request.url).searchParams
            const allowedSortFields = new Set(normalizedRouteOptions.allowSortFields ?? [])
            const allowedFilterFields = new Set(normalizedRouteOptions.allowFilterFields ?? [])
            const allowQueryKeys = new Set([
              ...(normalizedRouteOptions.allowQueryKeys ?? []),
              currentConfig.pageKey,
              currentConfig.pageSizeKey,
              currentConfig.sortByKey,
              currentConfig.sortOrderKey,
              ...allowedFilterFields,
            ])

            // 直接检查原始参数，不依赖 schema 剥离后的 query；保留路由的类型与转换。
            const unknownKeys = [...new Set(parameters.keys())].filter(key => !allowQueryKeys.has(key))
            if (unknownKeys.length > 0) { throw new ResponseCodeError(RESPONSE_CODES.UNKNOWN_QUERY_KEYS) }

            const sortBy = parameters.get(currentConfig.sortByKey)?.trim() || undefined
            const sortOrderRaw = parameters.get(currentConfig.sortOrderKey)?.trim().toLowerCase() || undefined

            if (sortBy && !allowedSortFields.has(sortBy)) { throw new ResponseCodeError(RESPONSE_CODES.INVALID_SORT_FIELD) }

            if (!sortBy && sortOrderRaw) { throw new ResponseCodeError(RESPONSE_CODES.SORT_FIELD_REQUIRED) }

            if (sortOrderRaw !== undefined && sortOrderRaw !== 'asc' && sortOrderRaw !== 'desc') { throw new ResponseCodeError(RESPONSE_CODES.INVALID_SORT_ORDER) }

            const sortOrder = (
              sortOrderRaw
              || (sortBy ? normalizedRouteOptions.defaultSortOrder : undefined)
              || null
            )

            const filters: Record<string, string | string[]> = {}
            for (const field of allowedFilterFields) {
              const values = parameters.getAll(field).map(value => value.trim()).filter(Boolean)
              if (values.length) { filters[field] = values.length === 1 ? values[0] : values }
            }

            return {
              listQuery: {
                filters,
                sortBy: sortBy ?? null,
                sortOrder,
              } satisfies ListQueryState,
            }
          },
        }
      },
    })
    .as('scoped')
}

export default createListQueryWhitelistPlugin
