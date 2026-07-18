import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sales from './Sales'
import { renderWithToast } from '../../test/renderWithToast'
import * as cajovnaApi from '../../api/cajovna'

vi.mock('../../api/cajovna', () => ({
  getCajovnaProdeje: vi.fn(),
  getCajovnaPolozky: vi.fn(),
  createCajovnaSale: vi.fn(),
}))

const SALES = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null, cenikova_cena: 260, zisk: 100 },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: null, cenikova_cena: 130, zisk: 50 },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null, cenikova_cena: 500, zisk: 200 },
]

const SALES_WITH_CANCELLED = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null, cenikova_cena: 260, zisk: 100 },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: '2026-05-28 13:00:00', cenikova_cena: 130, zisk: 50 },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null, cenikova_cena: 500, zisk: 200 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES)
})

describe('Sales', () => {
  it('zobrazí denní pivot s prodavajícími ve sloupcích', async () => {
    renderWithToast(<Sales />)
    const pivot = await screen.findByRole('table', { name: 'Denní tržby přes prodavající' })
    expect(within(pivot).getByRole('columnheader', { name: 'terka' })).toBeInTheDocument()
    expect(within(pivot).getByRole('columnheader', { name: 'boss' })).toBeInTheDocument()
  })

  it('zobrazí měsíční pivot s prodavajícími ve sloupcích', async () => {
    renderWithToast(<Sales />)
    const monthly = await screen.findByRole('table', { name: 'Měsíční tržby přes prodavající' })
    expect(within(monthly).getByRole('columnheader', { name: 'terka' })).toBeInTheDocument()
    expect(within(monthly).getByRole('columnheader', { name: 'boss' })).toBeInTheDocument()
  })

  it('zobrazí souhrnnou tabulku celkových tržeb za prodavajícího', async () => {
    renderWithToast(<Sales />)
    const summary = await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    // terka 260+130 = 390, boss 500
    expect(within(summary).getByText(/390/)).toBeInTheDocument()
    expect(within(summary).getByText(/500/)).toBeInTheDocument()
  })

  it('spočítá celkovou tržbu', async () => {
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    expect(screen.getAllByText('890 Kč').length).toBeGreaterThan(0)
  })

  it('filtruje prodeje po kliku na Zobrazit', async () => {
    const user = userEvent.setup()
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    const fromInput = screen.getByLabelText('od')
    await user.clear(fromInput)
    await user.type(fromInput, '2026-05-28')
    await user.click(screen.getByRole('button', { name: /zobrazit/i }))
    await waitFor(() => expect(vi.mocked(cajovnaApi.getCajovnaProdeje)).toHaveBeenCalledTimes(2))
  })

  it('stornovaný prodej se nezapočítá do statistik', async () => {
    vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES_WITH_CANCELLED)
    renderWithToast(<Sales />)
    // Aktivní: id=1 (260) + id=3 (500) = 760 Kč; id=2 je stornovaný (130) — nesmí být v celkové
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    expect(screen.getAllByText('760 Kč').length).toBeGreaterThan(0)
  })

  it('spočítá celkový zisk', async () => {
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    // 100 + 50 + 200 = 350
    expect(screen.getAllByText('350 Kč').length).toBeGreaterThan(0)
  })

  it('stornovaný prodej se nezapočítá do zisku', async () => {
    vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES_WITH_CANCELLED)
    renderWithToast(<Sales />)
    // Aktivní: id=1 (100) + id=3 (200) = 300; id=2 je stornovaný (50) — nesmí se počítat
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    expect(screen.getAllByText('300 Kč').length).toBeGreaterThan(0)
  })

})
