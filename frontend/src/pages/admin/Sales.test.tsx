import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sales from './Sales'
import { renderWithToast } from '../../test/renderWithToast'
import * as salesApi from '../../api/sales'

vi.mock('../../api/sales', () => ({
  getSales: vi.fn(),
}))

const SALES = [
  { id: 1, user_id: 1, username: 'terka', total_amount: 260, note: null, created_at: '2026-05-28 10:00:00' },
  { id: 2, user_id: 1, username: 'terka', total_amount: 130, note: null, created_at: '2026-05-28 11:00:00' },
  { id: 3, user_id: 2, username: 'boss', total_amount: 500, note: null, created_at: '2026-05-28 12:00:00' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(salesApi.getSales).mockResolvedValue(SALES)
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
    await waitFor(() => expect(vi.mocked(salesApi.getSales)).toHaveBeenCalledTimes(2))
  })
})
