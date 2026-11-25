import type { ShareRecord } from './shares'
import { upstreamUrl } from './discovery'

const privateCookies = new Set(['porthole_access', '__Host-porthole_access', 'yuumi_login', 'yuumi_session', '__Host-porthole_login', '__Host-porthole_session'])
const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']

function endToEndHeaders(source: Headers) {
  const headers = new Headers(source)
  const dynamic = headers.get('connection')?.split(',').map(value => value.trim()).filter(Boolean) ?? []
  for (const key of [...hopByHop, ...dynamic]) { headers.delete(key) }
  return headers
}

function isolatedCookies(source: Headers, headers: Headers) {
  headers.delete('set-cookie')
  for (const value of source.getSetCookie()) {
    const name = value.split('=', 1)[0]?.trim()
    if (name && !privateCookies.has(name)) { headers.append('Set-Cookie', value.replace(/;\s*domain=[^;]*/gi, '')) }
  }
}

function redirectedLocation(location: string, upstream: URL, external: URL) {
  try {
    const target = new URL(location, upstream)
    if (target.origin !== upstream.origin) { return location }
    const result = new URL(external)
    result.pathname = target.pathname
    result.search = target.search
    result.hash = target.hash
    return result.toString()
  }
  catch { return location }
}

export async function relay(request: Request, record: ShareRecord, external: URL) {
  const incoming = new URL(request.url)
  const upstream = new URL(upstreamUrl(record))
  upstream.pathname = incoming.pathname
  upstream.search = incoming.search

  const headers = endToEndHeaders(request.headers)
  const cookies = headers.get('cookie')?.split(';').map(value => value.trim()).filter(value => !privateCookies.has(value.split('=', 1)[0] ?? '')).join('; ')
  if (cookies?.trim()) { headers.set('cookie', cookies) }
  else { headers.delete('cookie') }
  headers.delete('forwarded')
  headers.delete('x-forwarded-for')
  const client = headers.get('x-real-ip')
  if (client) { headers.set('x-forwarded-for', client) }
  headers.set('host', record.upstreamHostMode === 'local' ? upstream.host : external.host)
  headers.set('x-forwarded-host', external.host)
  headers.set('x-forwarded-proto', external.protocol.slice(0, -1))
  headers.set('x-forwarded-port', external.port || (external.protocol === 'https:' ? '443' : '80'))

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 30_000)
  try {
    const response = await fetch(upstream, {
      body: request.body,
      decompress: false,
      headers,
      method: request.method,
      redirect: 'manual',
      signal: AbortSignal.any([request.signal, timeout.signal]),
    })
    const outgoing = endToEndHeaders(response.headers)
    for (const key of [...outgoing.keys()]) {
      if (key.startsWith('x-accel-')) { outgoing.delete(key) }
    }
    outgoing.delete('clear-site-data')
    outgoing.set('cache-control', 'private, no-store')
    isolatedCookies(response.headers, outgoing)
    const location = outgoing.get('location')
    if (location) { outgoing.set('location', redirectedLocation(location, upstream, external)) }
    return new Response(response.body, { headers: outgoing, status: response.status, statusText: response.statusText })
  }
  finally { clearTimeout(timer) }
}
