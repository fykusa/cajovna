import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Bags from './Bags'
import { renderWithToast } from '../../test/renderWithToast'
import * as bagsApi from '../../api/bags'
import type { Bag } from '../../types'

vi.mock('../../api/bags', () => ({
  getBags: vi.fn(),
  createBag: vi.fn(),
  updateBag: vi.fn(),
  deleteBag: vi.fn(),
}))

const BAGS: Bag[] = [
  { id: 1, surface_type: 'porcelán', volume_ml: 200, dimensions: '8x8', price_per_piece: 12.5 },
  { id: 2, surface_type: 'sklo', volume_ml: 300, dimensions: null, price_per_piece: 20 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(bagsApi.getBags).mockResolvedValue(BAGS)
})

describe('Bags', () => {
  it('zobrazí seznam pytlíků', async () => {
    renderWithToast(<Bags />)
    expect(await screen.findByText('porcelán')).toBeInTheDocument()
    expect(screen.getByText('sklo')).toBeInTheDocument()
  })

  it('cena se zobrazí bez zbytečných nul (20, ne 20.00)', async () => {
    renderWithToast(<Bags />)
    await screen.findByText('porcelán')
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('přidání zavolá createBag a připne řádek', async () => {
    vi.mocked(bagsApi.createBag).mockResolvedValue({
      id: 3,
      surface_type: 'nový',
      volume_ml: 0,
      dimensions: null,
      price_per_piece: 0,
    })
    const user = userEvent.setup()
    renderWithToast(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    await waitFor(() =>
      expect(bagsApi.createBag).toHaveBeenCalledWith({
        surface_type: 'nový',
        volume_ml: 0,
        dimensions: null,
        price_per_piece: 0,
      })
    )
    expect(await screen.findByText('nový')).toBeInTheDocument()
  })

  it('editace ceny zavolá updateBag', async () => {
    vi.mocked(bagsApi.updateBag).mockResolvedValue({
      id: 1,
      surface_type: 'porcelán',
      volume_ml: 200,
      dimensions: '8x8',
      price_per_piece: 15,
    })
    const user = userEvent.setup()
    renderWithToast(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getByText('12.5'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('12.5')
    await user.clear(input)
    await user.type(input, '15')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(bagsApi.updateBag).toHaveBeenCalledWith(1, { price_per_piece: 15 })
    )
  })

  it('smazání zavolá deleteBag a odebere řádek', async () => {
    vi.mocked(bagsApi.deleteBag).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithToast(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getAllByRole('button', { name: 'smazat' })[0])
    await user.click(screen.getByRole('button', { name: 'Potvrdit' }))
    await waitFor(() => expect(bagsApi.deleteBag).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('porcelán')).not.toBeInTheDocument())
  })

  it('pytlík v prodeji nabízí deaktivovat (active → 0)', async () => {
    vi.mocked(bagsApi.getBags).mockResolvedValue([
      { id: 1, surface_type: 'porcelán', volume_ml: 200, dimensions: '8x8', price_per_piece: 12.5, active: 1, has_sales: 1 },
    ])
    vi.mocked(bagsApi.updateBag).mockResolvedValue({
      id: 1, surface_type: 'porcelán', volume_ml: 200, dimensions: '8x8', price_per_piece: 12.5, active: 0,
    })
    const user = userEvent.setup()
    renderWithToast(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getByRole('button', { name: 'deaktivovat' }))
    await waitFor(() => expect(bagsApi.updateBag).toHaveBeenCalledWith(1, { active: 0 }))
  })

  it('409 při mazání zobrazí chybu', async () => {
    const { ApiError } = await import('../../api/client')
    vi.mocked(bagsApi.deleteBag).mockRejectedValue(
      new ApiError(409, 'Pytlík je použit v prodeji, nelze smazat.')
    )
    const user = userEvent.setup()
    renderWithToast(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getAllByRole('button', { name: 'smazat' })[0])
    await user.click(screen.getByRole('button', { name: 'Potvrdit' }))
    expect(await screen.findByText(/použit v prodeji/i)).toBeInTheDocument()
  })
})
