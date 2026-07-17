import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Kasa from './Kasa'
import type { KasaStatus, CashMovement, CashClosing } from '../../types'

vi.mock('../../api/kasa', () => ({
  getKasaStatus: vi.fn(),
  addKasaMovement: vi.fn(),
  getKasaMovements: vi.fn(),
  closeKasa: vi.fn(),
  getKasaClosings: vi.fn(),
}))

import { getKasaStatus, addKasaMovement, closeKasa, getKasaMovements, getKasaClosings } from '../../api/kasa'

const mockGetStatus    = vi.mocked(getKasaStatus)
const mockAddMovement  = vi.mocked(addKasaMovement)
const mockCloseKasa    = vi.mocked(closeKasa)
const mockGetMovements = vi.mocked(getKasaMovements)
const mockGetClosings  = vi.mocked(getKasaClosings)

const STATUS: KasaStatus = {
  last_closing: { date: '2026-06-15', confirmed_balance: 1000 },
  today_closing: null,
  dnes_prodano: 550,
  trzby_dnes: 500,
  pohyby_dnes: -200,
  stav_kasy: 1300,
  movements: [
    {
      id: 1,
      date: '2026-06-16',
      amount: -200,
      note: 'výběr',
      created_by: 1,
      created_by_username: 'admin',
      created_at: '2026-06-16T10:30:00',
    },
  ],
}

const STATUS_NO_CLOSING: KasaStatus = {
  last_closing: null,
  today_closing: null,
  dnes_prodano: 300,
  trzby_dnes: 300,
  pohyby_dnes: 0,
  stav_kasy: null,
  movements: [],
}

const NEW_MOVEMENT: CashMovement = {
  id: 2,
  date: '2026-06-16',
  amount: 100,
  note: 'vklad',
  created_by: 1,
  created_by_username: 'admin',
  created_at: '2026-06-16T11:00:00',
}

const CLOSING: CashClosing = {
  id: 1,
  date: '2026-06-16',
  calculated_balance: 1300,
  confirmed_balance: 1300,
  note: null,
  created_by: 1,
  created_by_username: 'admin',
  created_at: '2026-06-16T20:00:00',
  updated_at: '2026-06-16T20:00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMovements.mockResolvedValue([])
  mockGetClosings.mockResolvedValue([])
})

describe('Admin Kasa', () => {
  it('zobrazí "Načítám…" při initial load', () => {
    mockGetStatus.mockReturnValue(new Promise(() => {}))
    render(<Kasa />)
    expect(screen.getByText('Načítám…')).toBeInTheDocument()
  })

  it('zobrazí 4 stat karty po načtení', async () => {
    mockGetStatus.mockResolvedValue(STATUS)
    render(<Kasa />)
    await waitFor(() => {
      expect(screen.getByTestId('stat-uzaverka')).toBeInTheDocument()
      expect(screen.getByTestId('stat-trzby')).toBeInTheDocument()
      expect(screen.getByTestId('stat-pohyby')).toBeInTheDocument()
      expect(screen.getByTestId('stat-stav')).toBeInTheDocument()
    })
    expect(screen.getByTestId('stat-uzaverka').textContent).toMatch(/1\s*000/)
    expect(screen.getByTestId('stat-trzby').textContent).toMatch(/500/)
    expect(screen.getByTestId('stat-stav').textContent).toMatch(/1\s*300/)
  })

  it('tlačítko "Přidat pohyb" zobrazí formulář', async () => {
    mockGetStatus.mockResolvedValue(STATUS)
    render(<Kasa />)
    await waitFor(() => screen.getByTestId('stat-stav'))

    expect(screen.queryByPlaceholderText(/částka/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))
    expect(screen.getByPlaceholderText(/částka/i)).toBeInTheDocument()
  })

  it('odesláním formuláře pohybu zavolá addKasaMovement se správnými argumenty', async () => {
    mockGetStatus.mockResolvedValue(STATUS)
    mockAddMovement.mockResolvedValue(NEW_MOVEMENT)

    render(<Kasa />)
    await waitFor(() => screen.getByTestId('stat-stav'))

    await userEvent.click(screen.getByRole('button', { name: /přidat pohyb/i }))

    const dialog = screen.getByRole('dialog')

    // Přepnout na "vlastní" pro vlastní poznámku
    await userEvent.selectOptions(within(dialog).getByRole('combobox'), 'vlastni')
    await userEvent.type(within(dialog).getByPlaceholderText(/vlastní poznámka/i), 'vklad')

    const amountInput = within(dialog).getByPlaceholderText(/částka/i)
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '100')

    await userEvent.click(within(dialog).getByRole('button', { name: /^přidat$/i }))

    await waitFor(() => {
      expect(mockAddMovement).toHaveBeenCalledWith(100, 'vklad')
    })
  })

  it('formulář uzavření je předvyplněn hodnotou stav_kasy', async () => {
    mockGetStatus.mockResolvedValue(STATUS)
    render(<Kasa />)
    await waitFor(() => screen.getByTestId('stat-stav'))

    const input = screen.getByTestId('close-balance-input') as HTMLInputElement
    expect(input.value).toBe('1300')
  })

  it('při stav_kasy === null předvyplní formulář součtem tržeb a pohybů', async () => {
    mockGetStatus.mockResolvedValue(STATUS_NO_CLOSING)
    render(<Kasa />)
    await waitFor(() => screen.getByTestId('stat-stav'))

    const input = screen.getByTestId('close-balance-input') as HTMLInputElement
    expect(input.value).toBe('300') // trzby_dnes(300) + pohyby_dnes(0)
  })

  it('odesláním formuláře uzavření zavolá closeKasa', async () => {
    mockGetStatus.mockResolvedValue(STATUS)
    mockCloseKasa.mockResolvedValue(CLOSING)

    render(<Kasa />)
    await waitFor(() => screen.getByTestId('stat-stav'))

    await userEvent.click(screen.getByRole('button', { name: /uzavřít den/i }))

    await waitFor(() => {
      expect(mockCloseKasa).toHaveBeenCalledWith(1300, undefined)
    })
  })

  it('zobrazí chybu při selhání API', async () => {
    mockGetStatus.mockRejectedValue(new Error('Síťová chyba'))
    render(<Kasa />)
    await waitFor(() => {
      expect(screen.getByText(/Síťová chyba/)).toBeInTheDocument()
    })
  })
})
