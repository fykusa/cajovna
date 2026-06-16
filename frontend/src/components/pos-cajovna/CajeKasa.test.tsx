import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import CajeKasa from './CajeKasa'
import type { KasaStatus } from '../../types'

vi.mock('../../api/kasa', () => ({ getKasaStatus: vi.fn() }))
import { getKasaStatus } from '../../api/kasa'
const mockGet = vi.mocked(getKasaStatus)

const STATUS_WITH_CLOSING: KasaStatus = {
  last_closing: { date: '2026-06-15', confirmed_balance: 1000 },
  trzby_dnes: 500,
  pohyby_dnes: -200,
  stav_kasy: 1300,
  movements: [
    { id: 1, date: '2026-06-16', amount: -200, note: 'výběr', created_by: 1, created_by_username: 'admin', created_at: '2026-06-16T10:30:00' },
  ],
}

const STATUS_NO_CLOSING: KasaStatus = {
  last_closing: null,
  trzby_dnes: 300,
  pohyby_dnes: 0,
  stav_kasy: null,
  movements: [],
}

beforeEach(() => { mockGet.mockReset() })

describe('CajeKasa', () => {
  it('zobrazí "Načítám…" při loading', () => {
    mockGet.mockReturnValue(new Promise(() => {}))
    render(<CajeKasa />)
    expect(screen.getByText('Načítám…')).toBeInTheDocument()
  })

  it('zobrazí uzávěrku, tržby, pohyby a stav kasy', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => {
      expect(screen.getByText(/1\s*000/)).toBeInTheDocument()  // uzávěrka 1000 Kč
      expect(screen.getByText(/500/)).toBeInTheDocument()       // tržby 500 Kč
      expect(within(screen.getByTestId('stat-pohyby')).getByText(/-200/)).toBeInTheDocument()  // pohyby -200 Kč
      expect(screen.getByText(/1\s*300/)).toBeInTheDocument()  // stav 1300 Kč
    })
  })

  it('zobrazí "—" pokud žádná uzávěrka neexistuje', async () => {
    mockGet.mockResolvedValue(STATUS_NO_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('zobrazí tabulku pohybů', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => {
      const section = screen.getByTestId('movements-section')
      expect(screen.getByText('výběr')).toBeInTheDocument()
      expect(within(section).getByText(/-200/)).toBeInTheDocument()
    })
  })

  it('nezobrazí sekci pohybů pokud jsou prázdné', async () => {
    mockGet.mockResolvedValue(STATUS_NO_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => {
      expect(screen.queryByTestId('movements-section')).not.toBeInTheDocument()
    })
  })

  it('zobrazí chybu při selhání API', async () => {
    mockGet.mockRejectedValue(new Error('Síťová chyba'))
    render(<CajeKasa />)
    await waitFor(() => {
      expect(screen.getByText(/Chyba: Síťová chyba/)).toBeInTheDocument()
    })
  })
})
