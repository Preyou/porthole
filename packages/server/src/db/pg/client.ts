import type { SavepointSQL, TransactionSQL } from 'bun'
import { SQL } from 'bun'
import { DependencyUnavailableError } from '../../errors/dependencyUnavailable'

function isConnectionFailure(error: unknown) {
  if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') { return false }
  return error.code.startsWith('ERR_POSTGRES_CONNECTION_')
    || ['ERR_SOCKET_CLOSED', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)
    // Bun 的 code 是驱动错误类别，服务端 SQLSTATE 位于 errno。
    || (error instanceof SQL.PostgresError && typeof error.errno === 'string'
      && (['57P01', '57P02', '57P03', '53300', '55P03', '57014'].includes(error.errno) || error.errno.startsWith('08')))
}

interface TransactionClient {
  <T>(strings: TemplateStringsArray, ...values: unknown[]): SQL.Query<T>
  unsafe: <T>(text: string, values?: unknown[]) => SQL.Query<T>
  savepoint: <T>(operation: (transaction: TransactionClient) => Promise<T>) => Promise<T>
}

/** 仅适配 Drizzle 使用的查询、事务与 savepoint，不暴露连接管理等未受保护接口。 */
export function createPostgresClient(
  url: string,
  {
    createPool = () => new SQL(url, {
      bigint: true,
      connection: { lock_timeout: '10000', statement_timeout: '12000' },
      connectionTimeout: 5,
      idleTimeout: 20,
      maxLifetime: 300,
    }),
    timeoutMs = 15000,
  }: { timeoutMs?: number, createPool?: () => SQL } = {},
) {
  let current: SQL | undefined
  const retired = new WeakSet<SQL>()
  function pool() { return current ??= createPool() }
  function retire(generation: SQL) {
    if (retired.has(generation)) { return }
    retired.add(generation)
    if (current === generation) { current = undefined }
    // 只关闭失败的旧池；并发旧请求不得破坏后续请求使用的新池。
    void generation.close({ timeout: 0 }).catch(error => console.error('[database] failed to close retired pool', error))
  }
  async function bounded<T>(task: PromiseLike<T>, generation: SQL, cancel: () => void): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new DependencyUnavailableError('Database', new Error('Database operation timed out')))
        try { cancel() }
        catch (error) { console.error('[database] failed to cancel timed out operation', error) }
        finally { retire(generation) }
      }, timeoutMs)
    })
    try { return await Promise.race([Promise.resolve(task), expired]) }
    catch (error) {
      if (error instanceof DependencyUnavailableError) { throw error }
      if (isConnectionFailure(error)) {
        retire(generation)
        throw new DependencyUnavailableError('Database', error)
      }
      throw error
    }
    finally { clearTimeout(timer) }
  }
  function query<T>(pending: SQL.Query<T>, generation: SQL): SQL.Query<T> {
    let result: Promise<T> | undefined
    return new Proxy(pending, {
      get(target, property) {
        if (property === 'then' || property === 'catch' || property === 'finally') {
          result ??= bounded(target, generation, () => target.cancel())
          return Reflect.get(result, property).bind(result)
        }
        const value = Reflect.get(target, property, target)
        if (['values', 'raw', 'simple', 'execute'].includes(String(property))) {
          return (...args: unknown[]) => query(Reflect.apply(value, target, args) as SQL.Query<T>, generation)
        }
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }
  function transaction(target: TransactionSQL | SavepointSQL, generation: SQL): TransactionClient {
    // 事务与嵌套事务固定使用原连接，不在事务中切换池。
    return Object.assign(<T>(strings: TemplateStringsArray, ...values: unknown[]) => query(target<T>(strings, ...values), generation), {
      savepoint<T>(operation: (nested: TransactionClient) => Promise<T>) {
        if (!('savepoint' in target)) { throw new Error('Bun SQL 当前连接不支持继续嵌套 savepoint') }
        return bounded(target.savepoint(nested => operation(transaction(nested, generation))), generation, () => retire(generation))
      },
      unsafe: <T>(text: string, values?: unknown[]) => query(target.unsafe<T>(text, values), generation),
    })
  }
  return Object.assign(<T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const generation = pool()
    return query(generation<T>(strings, ...values), generation)
  }, {
    begin<T>(operation: (tx: TransactionClient) => Promise<T>) {
      const generation = pool()
      return bounded(generation.begin(tx => operation(transaction(tx, generation))), generation, () => retire(generation))
    },
    get options() { return pool().options },
    unsafe<T>(text: string, values?: unknown[]) {
      const generation = pool()
      return query(generation.unsafe<T>(text, values), generation)
    },
  })
}
