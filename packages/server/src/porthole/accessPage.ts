const messages = {
  en: {
    action: 'Open service',
    changed: 'The service changed. Ask the owner to check the link.',
    ended: 'This link has expired or been revoked.',
    exhausted: 'All visits for this link have been used.',
    invalid: 'The access key is incorrect.',
    key: 'Access key',
    limited: 'This link uses one visit when you open it.',
    missing: 'This share link was not found.',
    offline: 'The service is currently offline.',
    restricted: 'Enter the access key to continue.',
    retry: 'Too many attempts. Try again in a minute.',
    title: 'Service access',
    unavailable: 'The service is temporarily unavailable.',
  },
  zh: {
    action: '进入服务',
    changed: '端口上的服务已变化，请联系分享者确认。',
    ended: '此链接已到期或被撤销。',
    exhausted: '此链接的访问名额已用完。',
    invalid: '访问密钥不正确。',
    key: '访问密钥',
    limited: '确认进入后会占用一个访问名额。',
    missing: '找不到此分享链接。',
    offline: '上游服务暂时离线。',
    restricted: '输入访问密钥后继续。',
    retry: '尝试次数过多，请稍后重试。',
    title: '访问服务',
    unavailable: '服务暂时无法访问。',
  },
}

type Message = keyof typeof messages.zh
export const accessPath = '/.porthole/access'

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function accessPage(request: Request, status: number, message: Message, options?: {
  cookie?: string
  name: string
  next: string
  requiresKey: boolean
}) {
  const locale = request.headers.get('accept-language')?.toLowerCase().startsWith('en') ? 'en' : 'zh'
  const copy = messages[locale]
  const name = escapeHtml(options?.name ?? copy.title)
  const form = options
    ? `<form method="post" action="${accessPath}">
    <input type="hidden" name="next" value="${escapeHtml(options.next)}">
    ${options.requiresKey ? `<label for="key">${copy.key}</label><input id="key" name="key" type="password" required maxlength="128" autocomplete="current-password">` : ''}
    <button type="submit">${copy.action}</button>
  </form>`
    : ''
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; form-action \'self\'; frame-ancestors \'none\'; base-uri \'none\'',
    'Content-Type': 'text/html; charset=utf-8',
    // 原生 POST 在 no-referrer 策略下会把 Origin 序列化为 null，导致同源校验失败。
    'Referrer-Policy': options ? 'same-origin' : 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  })
  if (options?.cookie) { headers.set('Set-Cookie', options.cookie) }
  return new Response(`<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · Porthole</title>
<style>
:root{color-scheme:light dark;font:16px system-ui,sans-serif;background:#f4f6f9;color:#172238}
body{margin:0;min-height:100dvh;display:grid;place-items:center}
main{width:min(28rem,calc(100% - 5rem));padding:2rem;background:#fff;border:1px solid #dce2ec;border-radius:1rem}
h1{margin:.25rem 0 .5rem;font-size:1.6rem;overflow-wrap:anywhere}
p{margin:0;color:#53627a}form{margin-top:1.5rem;display:grid;gap:.6rem}label{font-size:.9rem;font-weight:600}
input,button{box-sizing:border-box;font:inherit;border-radius:.45rem;padding:.65rem .8rem}
input{width:100%;border:1px solid #a3b0c4}button{border:0;background:#2456ca;color:white;font-weight:600;cursor:pointer}
@media(prefers-color-scheme:dark){:root{background:#111827;color:#f3f6fd}main{background:#182338;border-color:#364960}p{color:#acbad0}}
</style>
<main><h1>${name}</h1><p>${copy[message]}</p>${form}</main></html>`, { headers, status })
}

export function safeNext(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) { return '/' }
  const parsed = new URL(value, 'https://porthole.invalid')
  const { pathname, search } = parsed
  return pathname === accessPath || pathname.startsWith('//') ? '/' : `${pathname}${search}`
}

export async function readAccessForm(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded') || !request.body) { return }
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let length = 0
  let body = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) { break }
      length += value.byteLength
      if (length > 4096) {
        await reader.cancel()
        return
      }
      body += decoder.decode(value, { stream: true })
    }
    return new URLSearchParams(body + decoder.decode())
  }
  finally { reader.releaseLock() }
}
