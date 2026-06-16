import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getKasaStatus, addKasaMovement, getKasaMovements, closeKasa, getKasaClosings } from './kasa'

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))

import { apiFetch } from './client'
const mockFetch = vi.mocked(apiFetch)

beforeEach(() => { mockFetch.mockReset() })

describe('getKasaStatus', () => {
  it('volá GET /kasa/status', async () => {
    mockFetch.mockResolvedValue({ last_closing: null, trzby_dnes: 0, pohyby_dnes: 0, stav_kasy: null, movements: [] })
    await getKasaStatus()
    expect(mockFetch).toHaveBeenCalledWith('/kasa/status')
  })
})

describe('addKasaMovement', () => {
  it('volá POST /kasa/movements se správným tělem', async () => {
    mockFetch.mockResolvedValue({})
    await addKasaMovement(-200, 'výběr hotovosti')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/movements', {
      method: 'POST',
      body: JSON.stringify({ amount: -200, note: 'výběr hotovosti' }),
    })
  })
})

describe('getKasaMovements', () => {
  it('bez datumu volá /kasa/movements', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaMovements()
    expect(mockFetch).toHaveBeenCalledWith('/kasa/movements')
  })

  it('s datumem připojí query string', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaMovements('2026-06-15')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/movements?date=2026-06-15')
  })

  it('s from a to sestaví správnou URL', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaMovements(undefined, '2026-06-01', '2026-06-15')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/movements?from=2026-06-01&to=2026-06-15')
  })
})

describe('closeKasa', () => {
  it('volá POST /kasa/close se zůstatkem', async () => {
    mockFetch.mockResolvedValue({})
    await closeKasa(1500)
    expect(mockFetch).toHaveBeenCalledWith('/kasa/close', {
      method: 'POST',
      body: JSON.stringify({ confirmed_balance: 1500, note: null }),
    })
  })

  it('volá POST /kasa/close s poznámkou', async () => {
    mockFetch.mockResolvedValue({})
    await closeKasa(1500, 'OK')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/close', {
      method: 'POST',
      body: JSON.stringify({ confirmed_balance: 1500, note: 'OK' }),
    })
  })
})

describe('getKasaClosings', () => {
  it('bez filtrů volá /kasa/closings', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaClosings()
    expect(mockFetch).toHaveBeenCalledWith('/kasa/closings')
  })

  it('s filtry připojí from a to', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaClosings('2026-06-01', '2026-06-16')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/closings?from=2026-06-01&to=2026-06-16')
  })

  it('s pouze from připojí jen from', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaClosings('2026-06-01')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/closings?from=2026-06-01')
  })

  it('s pouze to připojí jen to', async () => {
    mockFetch.mockResolvedValue([])
    await getKasaClosings(undefined, '2026-06-16')
    expect(mockFetch).toHaveBeenCalledWith('/kasa/closings?to=2026-06-16')
  })
})
