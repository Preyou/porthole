const apiBaseUrl = import.meta.env.VITE_SYS_API_BASE_URL.replace(/\/$/, '')

export function startSignIn(returnTo = '/app/shares') {
  const query = new URLSearchParams({ returnTo })
  window.location.replace(`${apiBaseUrl}/auth/login?${query}`)
}

export function startSignOut() {
  const form = document.createElement('form')
  form.action = `${apiBaseUrl}/auth/logout`
  form.method = 'post'
  form.hidden = true
  document.body.append(form)
  form.submit()
}
