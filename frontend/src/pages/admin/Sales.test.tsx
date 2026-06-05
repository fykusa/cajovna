import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
  it('zobrazí tabulku prodejů', async () => {
    renderWithToast(<Sales />)
    expect(await screen.findByText('boss')).toBeInTheDocument()
    expect(screen.getAllByText('terka').length).toBeGreaterThan(0)
  })

  it('ukáže prodavačku u každého řádku i při opakování po sobě', async () => {
    // terka má dva prodeje po sobě — jméno se musí zobrazit u OBOU řádků,
    // ne jen u prvního (regrese: dřív se opakující prodavačka skrývala).
    renderWithToast(<Sales />)
    await screen.findByText('boss')
    expect(screen.getAllByText('terka')).toHaveLength(2)
  })

  it('zobrazí celkovou tržbu', async () => {
    renderWithToast(<Sales />)
    await screen.findByText('boss')
    expect(screen.getByText(/890/)).toBeInTheDocument()
  })

  it('filtruje prodeje po kliku na Zobrazit', async () => {
    const user = userEvent.setup()
    renderWithToast(<Sales />)
    await screen.findByText('boss')
    const fromInput = screen.getByLabelText(/od/i)
    await user.clear(fromInput)
    await user.type(fromInput, '2026-05-28')
    await user.click(screen.getByRole('button', { name: /zobrazit/i }))
    await waitFor(() => expect(vi.mocked(salesApi.getSales)).toHaveBeenCalledTimes(2))
  })
})
