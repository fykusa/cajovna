// frontend/src/api/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, ApiError } from './client'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('volá /api prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })
    await apiFetch('/products')
    expect(mockFetch).toHaveBeenCalledWith('/api/products', expect.any(Object))
  })

  it('přidá Authorization header pokud je token v localStorage', async () => {
    localStorage.setItem('token', 'testtoken')
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await apiFetch('/products')
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer testtoken')
  })

  it('nenastavuje Authorization header bez tokenu', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await apiFetch('/products')
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })

  it('hází ApiError s HTTP statusem při chybové odpovědi', async () => {
    const errorResponse = {
      ok: false,
      status: 401,
      json: async () => ({ error: 'Neplatné přihlašovací údaje' }),
    }
    mockFetch.mockResolvedValueOnce(errorResponse)
    mockFetch.mockResolvedValueOnce(errorResponse)
    await expect(apiFetch('/protected')).rejects.toBeInstanceOf(ApiError)
    await expect(
      apiFetch('/protected').catch((e) => e.status)
    ).resolves.toBe(401)
  })

  it('při 401 s existujícím tokenem smaže auth a přesměruje na /login', async () => {
    localStorage.setItem('token', 'expired')
    localStorage.setItem('user', '{"id":1}')
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid or expired token' }),
    })
    await expect(apiFetch('/protected')).rejects.toBeInstanceOf(ApiError)
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('401 bez tokenu (login) nepřesměrovává', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Neplatné přihlašovací údaje' }),
    })
    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toBeInstanceOf(ApiError)
    expect(assign).not.toHaveBeenCalled()
  })

  it('204 No Content (DELETE) vrátí undefined a neparsuje prázdné tělo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => {
        throw new Error('Unexpected end of JSON input')
      },
    })
    await expect(apiFetch('/categories/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('předá body jako JSON při POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await apiFetch('/sales', { method: 'POST', body: JSON.stringify({ items: [] }) })
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe('{"items":[]}')
  })
})
