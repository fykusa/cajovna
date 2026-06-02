// frontend/src/api/client.ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, { ...options, headers })

  if (!res.ok) {
    // Expirovaný/neplatný token → odhlásit a poslat na login. Spustí se jen když
    // jsme byli přihlášeni (token existoval), takže 401 z loginu (špatné heslo)
    // nezpůsobí redirect smyčku.
    if (res.status === 401 && token) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.assign('/login')
    }
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? body.message ?? res.statusText)
  }

  // 204 No Content (typicky DELETE) má prázdné tělo — neparsovat JSON.
  if (res.status === 204) return undefined as T

  const ct = res.headers?.get('content-type')
  if (ct !== null && ct !== undefined && !ct.includes('application/json')) return undefined as T
  return res.json() as Promise<T>
}
