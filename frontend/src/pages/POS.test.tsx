import { describe, it, expect, vi } from 'vitest'
import { screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import POS from './POS'
import { renderWithToast } from '../test/renderWithToast'

vi.mock('../api/products', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 1, name: 'Bílé' },
  ]),
  getProducts: vi.fn().mockResolvedValue([
    { id: 10, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
      std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
      pkg2_weight_g: null, pkg2_price_moc: null,
      stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0 },
  ]),
}))
vi.mock('../api/bags', () => ({
  getBags: vi.fn().mockResolvedValue([
    { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 },
  ]),
}))
vi.mock('../api/sales', () => ({
  getSales: vi.fn().mockResolvedValue([]),
  getSaleItems: vi.fn().mockResolvedValue([]),
}))
vi.mock('../store/authStore', () => ({
  useAuthStore: (s: (state: { user: { id: number; username: string; role: string } | null; token: string | null; logout: () => void }) => unknown) =>
    s({ user: { id: 1, username: 'terka', role: 'prodavacka' }, token: 'tok', logout: vi.fn() }),
}))

describe('POS', () => {
  it('zobrazí kategorie po načtení', async () => {
    renderWithToast(<POS />)
    expect(await screen.findByText('Bílé')).toBeInTheDocument()
  })

  it('Enter na kategorii přejde na výběr čaje', async () => {
    renderWithToast(<POS />)
    await screen.findByText('Bílé')
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(await screen.findByText('Show Mee')).toBeInTheDocument()
  })

  it('psaní písmene otevře search mód', async () => {
    renderWithToast(<POS />)
    await screen.findByText('Bílé')
    const user = userEvent.setup()
    await user.keyboard('s')
    expect(screen.getByText(/hledám/i)).toBeInTheDocument()
  })
})
