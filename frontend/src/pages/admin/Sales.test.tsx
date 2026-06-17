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
  cancelCajovnaSale: vi.fn(),
}))

const SALES = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: null },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null },
]

const SALES_WITH_CANCELLED = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: '2026-05-28 13:00:00' },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null },
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

  it('stornovaný prodej je v tabulce prodejů označen jako STORNO', async () => {
    vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES_WITH_CANCELLED)
    renderWithToast(<Sales />)
    const table = await screen.findByRole('table', { name: 'Přehled prodejů' })
    expect(within(table).getByText('STORNO')).toBeInTheDocument()
  })

  it('klik na Stornovat zavolá cancelCajovnaSale a znovu načte data', async () => {
    vi.mocked(cajovnaApi.cancelCajovnaSale).mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Přehled prodejů' })
    const stornoBtn = screen.getAllByRole('button', { name: /stornovat/i })[0]
    await user.click(stornoBtn)
    // confirm dialog
    const confirmBtn = screen.getByRole('button', { name: /potvrdit/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(vi.mocked(cajovnaApi.cancelCajovnaSale)).toHaveBeenCalledWith(expect.any(Number)))
    await waitFor(() => expect(vi.mocked(cajovnaApi.getCajovnaProdeje)).toHaveBeenCalledTimes(2))
  })
})
