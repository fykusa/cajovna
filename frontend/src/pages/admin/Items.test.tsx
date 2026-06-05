import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Items from './Items'
import { renderWithToast } from '../../test/renderWithToast'
import * as productsApi from '../../api/products'
import type { Tea, Category } from '../../types'

vi.mock('../../api/products', () => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))
vi.mock('../../api/stock', () => ({
  updateStock: vi.fn(),
}))

const CATEGORIES: Category[] = [
  { id: 1, name: 'Bílé' },
]

const mkTea = (id: number, name: string, hasSales: 0 | 1 = 0): Tea => ({
  id, category_id: 1, name, note: null, flag: 'active', origin: null,
  std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0,
  has_sales: hasSales,
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
    renderWithToast(<Items />)

    // Vyber buňku "Název" prvního řádku a vstup do editace
    const nameCell = await screen.findByText('Show Mee')
    await user.click(nameCell)
    await user.keyboard('{Enter}')

    // Jsme v editaci — input s hodnotou prvního řádku
    const input = screen.getByDisplayValue('Show Mee')
    // Buňka pod editovanou (stejný sloupec, druhý řádek)
    const belowCell = screen.getByText('Bai Mu Dan').closest('td')!

    // Šipka dolů během editace nesmí přesunout výběr na řádek pod ním
    await user.keyboard('{ArrowDown}')
    expect(belowCell.className).not.toContain('cellSelected')

    // Stále editujeme původní buňku (input nezmizel ani se nepřesunul)
    expect(screen.getByDisplayValue('Show Mee')).toBe(input)
  })

  it('čaj s prodejem nabízí deaktivovat (soft, bez confirm)', async () => {
    vi.mocked(productsApi.getProducts).mockResolvedValue([mkTea(1, 'Show Mee', 1)])
    vi.mocked(productsApi.updateProduct).mockResolvedValue({ ...mkTea(1, 'Show Mee', 1), flag: 'discontinued' })
    const user = userEvent.setup()
    renderWithToast(<Items />)
    await screen.findByText('Show Mee')

    await user.click(screen.getAllByRole('button', { name: 'deaktivovat' })[0])

    await waitFor(() =>
      expect(productsApi.updateProduct).toHaveBeenCalledWith(1, { flag: 'discontinued' })
    )
  })

  it('čaj bez prodejů lze rovnou smazat (dvoukrokově)', async () => {
    vi.mocked(productsApi.getProducts).mockResolvedValue([mkTea(1, 'Show Mee', 0)])
    vi.mocked(productsApi.deleteProduct).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithToast(<Items />)
    await screen.findByText('Show Mee')

    await user.click(screen.getByRole('button', { name: 'smazat' }))
    await user.click(screen.getByRole('button', { name: 'Potvrdit' }))

    await waitFor(() => expect(productsApi.deleteProduct).toHaveBeenCalledWith(1))
  })

  it('po editaci buňky zůstane u čaje s prodeji akce "deaktivovat" (ne "smazat")', async () => {
    const teaWithSales = mkTea(1, 'Show Mee', 1)
    vi.mocked(productsApi.getProducts).mockResolvedValue([teaWithSales])
    // Reálný backend update vrací řádek BEZ počítaného has_sales (SELECT *).
    const { has_sales: _omit, ...withoutHasSales } = teaWithSales
    vi.mocked(productsApi.updateProduct).mockResolvedValue({ ...withoutHasSales, name: 'Show Mee 2' } as Tea)
    const user = userEvent.setup()
    renderWithToast(<Items />)

    // Před editací: čaj s prodeji nabízí "deaktivovat"
    expect(await screen.findByRole('button', { name: 'deaktivovat' })).toBeInTheDocument()

    // Edituj buňku Název
    await user.click(screen.getByText('Show Mee'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('Show Mee')
    await user.clear(input)
    await user.type(input, 'Show Mee 2')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(productsApi.updateProduct).toHaveBeenCalled())

    // Po editaci MUSÍ akce zůstat "deaktivovat" — has_sales se nesmí ztratit
    expect(await screen.findByRole('button', { name: 'deaktivovat' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'smazat' })).not.toBeInTheDocument()
  })

  it('+ Přidat otevře modal a vytvoří nový čaj', async () => {
    vi.mocked(productsApi.createProduct).mockResolvedValue(mkTea(3, 'Nový čaj'))
    const user = userEvent.setup()
    renderWithToast(<Items />)
    await screen.findByText('Show Mee')

    await user.click(screen.getByRole('button', { name: /přidat/i }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getAllByRole('textbox')[0], 'Nový čaj') // název
    await user.click(within(dialog).getByRole('button', { name: 'Vytvořit' }))

    await waitFor(() =>
      expect(productsApi.createProduct).toHaveBeenCalledWith({
        category_id: 1,
        name: 'Nový čaj',
        note: null,
        flag: 'active',
      })
    )
    expect(await screen.findByText('Nový čaj')).toBeInTheDocument()
  })
})
