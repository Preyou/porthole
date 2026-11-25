import env from '@/env'

const hostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/
export const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
export const managementOrigin = new URL(env.appOrigin)
export const shareDomain = (env.portholeShareDomain || (env.nodeEnv === 'production' ? 'dev.preyou.site' : managementOrigin.hostname)).toLowerCase()
export const listenHost = env.portholeBindHost || env.host || '127.0.0.1'

if (!hostname.test(shareDomain) || shareDomain.length > 189 || !['http:', 'https:'].includes(managementOrigin.protocol)) {
  throw new Error('Invalid Porthole share domain or APP_ORIGIN')
}

export function shareUrl(slug: string) {
  const url = new URL(managementOrigin.origin)
  url.hostname = `${slug}.${shareDomain}`
  return url.origin
}

export function shareLabel(host: string) {
  if (!host.endsWith(`.${shareDomain}`)) { return }
  const slug = host.slice(0, -shareDomain.length - 1)
  return slugPattern.test(slug) ? slug : undefined
}
