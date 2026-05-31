import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Items from './Items'
import * as productsApi from '../../api/products'
import * as stockApi from '../../api/stock'
import type { Tea, Category } from '../../types'

vi.mock('../../api/products', () => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))
vi.mock('../../api/stock', () => ({
  updateStock: vi.fn(),
}))

const CATEGORIES: Category[] = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
]

const mkTea = (id: number, name: string): Tea => ({
  id, category_id: 1, name, note: null, flag: 'active', origin: null,
  std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0,
})

const TEAS: Tea[] = [mkTea(1, 'Show Mee'), mkTea(2, 'Bai Mu Dan')]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productsApi.getProducts).mockResolvedValue(TEAS)
  vi.mocked(productsApi.getCategories).mockResolvedValue(CATEGORIES)
})

describe('Items — keyboard navigace během editace', () => {
  it('šipky během editace nepřesouvají výběr do jiné buňky', async () => {
    const user = userEvent.setup()
    render(<Items />)

    // Vyber buňku "Název" prvního řádku a vstup do editace
    const nameCell = await screen.findByText('Show Mee')
    await user.click(nameCell)
    await user.keyboard('{Enter}')

    // Jsme v editaci — input s hodnotou prvního řádku
    const input = screen.getByDisplayValue('Show Mee')
    const editingTd = input.closest('td')!
    expect(editingTd.className).toContain('cellSelected')

    // Šipka dolů během editace nesmí přesunout výběr na jiný řádek
    await user.keyboard('{ArrowDown}')
    expect(editingTd.className).toContain('cellSelected')

    // Stále editujeme původní buňku (input nezmizel ani se nepřesunul)
    expect(screen.getByDisplayValue('Show Mee')).toBe(input)
  })
})
