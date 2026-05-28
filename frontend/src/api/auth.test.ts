// frontend/src/api/auth.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { login, logout } from './auth'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('login', () => {
  it('vrátí user a token při úspěchu', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'jwt-abc',
        user: { id: 1, username: 'terka', role: 'prodavacka' },
      }),
    })
    const result = await login('terka', 'heslo')
    expect(result.token).toBe('jwt-abc')
    expect(result.user.role).toBe('prodavacka')
  })

  it('hází ApiError při chybných přihlašovacích údajích', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    })
    await expect(login('x', 'y')).rejects.toMatchObject({ status: 401 })
  })
})

describe('logout', () => {
  it('zavolá POST /api/auth/logout', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await logout()
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })
})
