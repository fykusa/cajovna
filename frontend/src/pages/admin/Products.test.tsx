import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Products from './Products'
import * as productsApi from '../../api/products'
import * as stockApi from '../../api/stock'

vi.mock('../../api/products', () => ({
  getProducts: vi.fn(),
  updateProduct: vi.fn(),
}))
vi.mock('../../api/stock', () => ({
  updateStock: vi.fn(),
}))

const TEAS = [
  { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
    std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
    pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 1.5 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productsApi.getProducts).mockResolvedValue(TEAS)
})

describe('Products', () => {
  it('zobrazí seznam čajů', async () => {
    render(<Products />)
    expect(await screen.findByText('Show Mee')).toBeInTheDocument()
  })

  it('zobrazí stav skladu pro čaj', async () => {
    render(<Products />)
    await screen.findByText('Show Mee')
    expect(screen.getByText(/5 ks/)).toBeInTheDocument()
    expect(screen.getByText(/1.5 kg/)).toBeInTheDocument()
  })

  it('filtruje čaje podle vyhledávání', async () => {
    vi.mocked(productsApi.getProducts).mockResolvedValue([
      ...TEAS,
      { id: 2, category_id: 1, name: 'Bai Mu Dan', note: null, flag: 'active', origin: null,
        std_weight_g: 30, std_price_moc: 220, pkg1_weight_g: null, pkg1_price_moc: null,
        pkg2_weight_g: null, pkg2_price_moc: null,
        stock_std_pcs: 3, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0 },
    ])
    const user = userEvent.setup()
    render(<Products />)
    await screen.findByText('Show Mee')
    await user.type(screen.getByPlaceholderText(/hledat/i), 'bai')
    expect(screen.queryByText('Show Mee')).not.toBeInTheDocument()
    expect(screen.getByText('Bai Mu Dan')).toBeInTheDocument()
  })

  it('zavolá updateStock po úpravě skladu', async () => {
    vi.mocked(stockApi.updateStock).mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<Products />)
    await screen.findByText('Show Mee')
    await user.click(screen.getByRole('button', { name: /sklad/i }))
    const stockInput = screen.getByDisplayValue('5')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: /uložit/i }))
    await waitFor(() => expect(vi.mocked(stockApi.updateStock)).toHaveBeenCalledWith(1, expect.objectContaining({
      stock_std_pcs: 10,
    })))
  })
})
