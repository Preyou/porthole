import type { RedisOptions } from 'bun'
import { RedisClient } from 'bun'
import { DependencyUnavailableError } from '@/errors/dependencyUnavailable'

export interface RedisConnection {
  close: () => void
  del: (...keys: string[]) => Promise<number>
  get: (key: string) => Promise<null | string>
  send: <T>(command: string, args: string[]) => Promise<T>
}

export function createRedisConnection(url: string, options: RedisOptions = {}): RedisConnection {
  const client = new RedisClient(url, {
    autoReconnect: true,
    connectionTimeout: 5000,
    enableOfflineQueue: false,
    maxRetries: 3,
    ...options,
  })
  let connecting: Promise<void> | undefined

  async function execute<T>(operation: (client: RedisClient) => Promise<T>) {
    try {
      if (!client.connected) {
        connecting ??= client.connect().finally(() => { connecting = undefined })
        await connecting
      }
      return await operation(client)
    }
    catch (error) {
      throw new DependencyUnavailableError('Redis', error)
    }
  }

  return {
    close() { client.close() },
    del: (...keys) => execute(redis => redis.del(...keys)),
    get: key => execute(redis => redis.get(key)),
    send: (command, args) => execute(redis => redis.send(command, args)),
  }
}
