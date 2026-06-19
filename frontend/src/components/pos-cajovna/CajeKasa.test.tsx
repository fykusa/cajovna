import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import CajeKasa from './CajeKasa'
import type { KasaStatus } from '../../types'

vi.mock('../../api/kasa', () => ({
  getKasaStatus:   vi.fn(),
  addKasaMovement: vi.fn(),
}))
import { getKasaStatus, addKasaMovement } from '../../api/kasa'
const mockGet = vi.mocked(getKasaStatus)
const mockAdd = vi.mocked(addKasaMovement)

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

beforeEach(() => {
  mockGet.mockReset()
  mockAdd.mockReset()
})

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
      expect(screen.getByText(/1\s*000/)).toBeInTheDocument()
      expect(screen.getByText(/500/)).toBeInTheDocument()
      expect(within(screen.getByTestId('stat-pohyby')).getByText(/-200/)).toBeInTheDocument()
      expect(screen.getByText(/1\s*300/)).toBeInTheDocument()
      expect(screen.getByText('(15.6.)')).toBeInTheDocument()
    })
  })

  it('zobrazí "?" pokud žádná uzávěrka neexistuje', async () => {
    mockGet.mockResolvedValue(STATUS_NO_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => {
      expect(within(screen.getByTestId('stat-uzaverka')).getByText('?')).toBeInTheDocument()
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

  it('zobrazí tlačítko "Přidat pohyb"', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /přidat pohyb/i })).toBeInTheDocument()
    })
  })

  it('otevře formulář po kliknutí na "Přidat pohyb"', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => screen.getByRole('button', { name: /přidat pohyb/i }))
    fireEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))
    expect(screen.getByTestId('add-form')).toBeInTheDocument()
  })

  it('úspěšně přidá pohyb a refreshne status', async () => {
    const updatedStatus = {
      ...STATUS_WITH_CLOSING,
      pohyby_dnes: -400,
      stav_kasy: 1100,
      movements: [
        ...STATUS_WITH_CLOSING.movements,
        { id: 2, date: '2026-06-16', amount: -200, note: 'výběr', created_by: 1, created_by_username: 'prodavacka', created_at: '2026-06-16T11:00:00' },
      ],
    }
    mockGet.mockResolvedValueOnce(STATUS_WITH_CLOSING).mockResolvedValueOnce(updatedStatus)
    mockAdd.mockResolvedValue({ id: 2, date: '2026-06-16', amount: -200, note: 'výběr', created_by: 1, created_by_username: 'prodavacka', created_at: '2026-06-16T11:00:00' })

    render(<CajeKasa />)
    await waitFor(() => screen.getByRole('button', { name: /přidat pohyb/i }))
    fireEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))

    const form = screen.getByTestId('add-form')
    fireEvent.change(within(form).getByRole('spinbutton'), { target: { value: '200' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(-200, 'výběr')
    })
    await waitFor(() => {
      expect(screen.queryByTestId('add-form')).not.toBeInTheDocument()
    })
  })

  it('zobrazí chybu pokud výběr přesahuje stav kasy', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING) // stav_kasy = 1300
    render(<CajeKasa />)
    await waitFor(() => screen.getByRole('button', { name: /přidat pohyb/i }))
    fireEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))

    const form = screen.getByTestId('add-form')
    fireEvent.change(within(form).getByRole('spinbutton'), { target: { value: '9999' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/přesahuje stav kasy/i)).toBeInTheDocument()
    })
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('vlastní záporná hodnota nad stav kasy zobrazí chybu', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING) // stav_kasy = 1300
    render(<CajeKasa />)
    await waitFor(() => screen.getByRole('button', { name: /přidat pohyb/i }))
    fireEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))

    const form = screen.getByTestId('add-form')
    fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'vlastni' } })
    await waitFor(() => within(form).getByPlaceholderText('Poznámka'))
    fireEvent.change(within(form).getByPlaceholderText('Poznámka'), { target: { value: 'test' } })
    fireEvent.change(within(form).getByRole('spinbutton'), { target: { value: '-9999' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/přesahuje stav kasy/i)).toBeInTheDocument()
    })
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('zobrazí vlastní poznámku při výběru "vlastní"', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => screen.getByRole('button', { name: /přidat pohyb/i }))
    fireEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))

    const form = screen.getByTestId('add-form')
    fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'vlastni' } })
    expect(within(form).getByPlaceholderText('Poznámka')).toBeInTheDocument()
  })

  it('Zrušit skryje formulář', async () => {
    mockGet.mockResolvedValue(STATUS_WITH_CLOSING)
    render(<CajeKasa />)
    await waitFor(() => screen.getByRole('button', { name: /přidat pohyb/i }))
    fireEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))
    expect(screen.getByTestId('add-form')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /zrušit/i }))
    expect(screen.queryByTestId('add-form')).not.toBeInTheDocument()
  })
})
