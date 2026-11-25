import { expect, test } from 'bun:test'
import { parseListeners } from '../../src/porthole/discovery'

function row(port: number, state = '0A', address = '0100007F', inode = '5001') {
  return ` 0: ${address}:${port.toString(16)} 00000000:0000 ${state} 00000000:00000000 00:00000000 00000000 0 0 ${inode}`
}

test('Porthole 仅接受范围内具有身份的 TCP 监听，并解析 IPv4 和 IPv6 地址', () => {
  const entries = [row(50_099), row(50_100), row(50_999, '0A', '00000000'), row(51_000), row(50_101, '01'), row(50_102, '0A', '0100007F', '0')]
  expect(parseListeners(entries.join('\n'))).toEqual([
    { address: '127.0.0.1', id: '0100007F:5001', port: 50_100 },
    { address: '127.0.0.1', id: '00000000:5001', port: 50_999 },
  ])
  expect(parseListeners(row(50_100, '0A', '00000000000000000000000001000000'), true)[0]).toMatchObject({ address: '[0:0:0:0:0:0:0:1]', port: 50_100 })
})
