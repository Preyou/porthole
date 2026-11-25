import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'

const minPort = 50_100
const maxPort = 50_999

interface Listener {
  address: string
  id: string
  port: number
}

export interface Target extends Listener {
  protocol: 'http' | 'https'
}

function decodeAddress(address: string, ipv6: boolean) {
  const bytes = Buffer.from(address, 'hex')
  if (!ipv6) { return address === '00000000' ? '127.0.0.1' : [...bytes.reverse()].join('.') }
  // Linux 按本机字节序输出各 32 位字，宿主机为小端。
  if (bytes.every(byte => byte === 0)) { return '[::1]' }
  for (let index = 0; index < bytes.length; index += 4) { bytes.subarray(index, index + 4).reverse() }
  const groups = Array.from({ length: 8 }, (_, index) => bytes.readUInt16BE(index * 2).toString(16))
  return `[${groups.join(':')}]`
}

export function parseListeners(content: string, ipv6 = false): Listener[] {
  return content.split('\n').flatMap((row) => {
    const [, local, , state, , , , , , inode] = row.trim().split(/\s+/)
    if (!local || state !== '0A' || !inode || inode === '0') { return [] }
    const [encoded, hexPort] = local.split(':')
    if (!encoded || !hexPort) { return [] }
    const port = Number.parseInt(hexPort, 16)
    if (port < minPort || port > maxPort) { return [] }
    const address = decodeAddress(encoded, ipv6)
    return [{ address, id: `${encoded}:${inode}`, port }]
  })
}

async function readTcp(path: string) {
  try { return await readFile(path, 'utf8') }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') { return '' }
    throw error
  }
}

export async function listenersByPort() {
  const [ipv4, ipv6] = await Promise.all([readTcp('/proc/net/tcp'), readTcp('/proc/net/tcp6')])
  const mapped = new Map<number, Listener[]>()
  for (const listener of [...parseListeners(ipv4), ...parseListeners(ipv6, true)]) {
    const entries = mapped.get(listener.port) ?? []
    entries.push(listener)
    mapped.set(listener.port, entries)
  }
  return mapped
}

export function upstreamUrl(target: Pick<Target, 'address' | 'port' | 'protocol'>) {
  return `${target.protocol}://${target.address}:${target.port}`
}

async function probePort(listeners: Listener[]): Promise<Target | null> {
  // 同一端口由多个地址监听时，优先选回环，再采用稳定的地址顺序。
  const ranked = listeners.toSorted((left, right) => {
    const rank = (address: string) => address.startsWith('127.') || address === '[::1]' || address === '[0:0:0:0:0:0:0:1]' ? 0 : 1
    return (rank(left.address) - rank(right.address)) || left.address.localeCompare(right.address)
  })
  for (const listener of ranked) {
    for (const protocol of ['http', 'https'] as const) {
      const target = { ...listener, protocol }
      try {
        await fetch(upstreamUrl(target), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(1200) })
        return target
      }
      catch { /* 继续检查同一端口的其他协议或监听地址。 */ }
    }
  }
  return null
}

let inventory: ReturnType<typeof probeInventory> | undefined

export function discoverPorts() {
  inventory ??= probeInventory().finally(() => { inventory = undefined })
  return inventory
}

async function probeInventory() {
  const entries = [...await listenersByPort()].sort(([left], [right]) => left - right)
  const found: { port: number, address: string | null, protocol: Target['protocol'] | null }[] = []
  for (let index = 0; index < entries.length; index += 12) {
    const batch = entries.slice(index, index + 12).map(async ([port, listeners]) => {
      const target = await probePort(listeners)
      return { address: target?.address ?? null, port, protocol: target?.protocol ?? null }
    })
    found.push(...await Promise.all(batch))
  }
  return found
}

export async function resolveTarget(port: number) {
  return probePort((await listenersByPort()).get(port) ?? [])
}
