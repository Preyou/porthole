import { accessPage, accessPath, readAccessForm, safeNext } from './accessPage'
import { managementOrigin, shareLabel, shareUrl } from './config'
import { listenersByPort } from './discovery'
import { relay } from './relay'
import { findShare, grantSession, hasSession, listenerStatus, randomToken, remainingVisits, shareEnded } from './shares'

const secure = managementOrigin.protocol === 'https:'
const accessCookie = secure ? '__Host-porthole_access' : 'porthole_access'
const failedAttempts = new Map<string, { count: number, until: number }>()

function cookieToken(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${accessCookie}=`))?.slice(accessCookie.length + 1)
  return token && /^[a-f0-9]{48}$/.test(token) ? token : undefined
}

function cookieHeader(token: string) {
  return `${accessCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? '; Secure' : ''}`
}

function redirectToShare(next: string, cookie?: string) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Location': next, 'Referrer-Policy': 'no-referrer' })
  if (cookie) { headers.set('Set-Cookie', cookie) }
  return new Response(null, { headers, status: 303 })
}

function canAttempt(shareId: string, request: Request) {
  const key = `${shareId}:${request.headers.get('x-real-ip')?.slice(0, 64) ?? 'unknown'}`
  const now = Date.now()
  const entry = failedAttempts.get(key)
  if (entry && entry.until > now) { return ++entry.count <= 10 }
  if (failedAttempts.size >= 4096) {
    for (const [id, attempt] of failedAttempts) {
      if (attempt.until <= now) { failedAttempts.delete(id) }
    }
    if (failedAttempts.size >= 4096) { return false }
  }
  failedAttempts.set(key, { count: 1, until: now + 60_000 })
  return true
}

export async function handleShare(request: Request) {
  const url = new URL(request.url)
  const slug = shareLabel(url.hostname)
  if (!slug) { return accessPage(request, 404, 'missing') }

  try {
    const share = await findShare(slug)
    if (!share) { return accessPage(request, 404, 'missing') }
    if (shareEnded(share)) { return accessPage(request, 410, 'ended') }
    const upstream = listenerStatus(share, await listenersByPort())
    if (upstream === 'offline') { return accessPage(request, 502, 'offline') }
    if (upstream === 'changed') { return accessPage(request, 503, 'changed') }

    const external = new URL(shareUrl(slug))
    const needsGate = share.keyHash !== null || share.maxVisits !== null
    const token = cookieToken(request)
    const admitted = needsGate && token ? await hasSession(share.id, token) : false

    if (url.pathname === accessPath && request.method === 'POST') {
      if (request.headers.get('origin') !== external.origin) { return accessPage(request, 403, 'unavailable') }
      const input = await readAccessForm(request)
      if (!input) { return accessPage(request, 400, 'unavailable') }
      const next = safeNext(input.get('next'))
      if (!needsGate || admitted) { return redirectToShare(next) }
      if (remainingVisits(share) === 0) { return accessPage(request, 429, 'exhausted') }

      const visitorToken = token ?? randomToken()
      if (share.keyHash) {
        if (!canAttempt(share.id, request)) { return accessPage(request, 429, 'retry') }
        const accessKey = input.get('key')
        if (!accessKey || accessKey.length > 128 || !await Bun.password.verify(accessKey, share.keyHash)) {
          return accessPage(request, 403, 'invalid', { cookie: cookieHeader(visitorToken), name: share.name, next, requiresKey: true })
        }
      }
      const outcome = await grantSession(share, visitorToken)
      if (outcome === 'ended') { return accessPage(request, 410, 'ended') }
      if (outcome === 'changed') { return accessPage(request, 409, 'changed') }
      if (outcome === 'exhausted') { return accessPage(request, 429, 'exhausted') }
      return redirectToShare(next, cookieHeader(visitorToken))
    }

    if (needsGate && !admitted) {
      if (remainingVisits(share) === 0) { return accessPage(request, 429, 'exhausted') }
      if (!['GET', 'HEAD'].includes(request.method)) { return accessPage(request, 403, 'restricted') }
      return accessPage(request, 200, share.keyHash ? 'restricted' : 'limited', {
        cookie: cookieHeader(token ?? randomToken()),
        name: share.name,
        next: safeNext(url.pathname + url.search),
        requiresKey: share.keyHash !== null,
      })
    }

    try { return await relay(request, share, external) }
    catch { return accessPage(request, 502, 'unavailable') }
  }
  catch (error) {
    console.error('Porthole share request failed', error instanceof Error ? error.name : 'Unknown error')
    return accessPage(request, 503, 'unavailable')
  }
}
