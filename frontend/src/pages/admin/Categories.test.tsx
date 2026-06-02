import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Categories from './Categories'
import { renderWithToast } from '../../test/renderWithToast'
import * as categoriesApi from '../../api/categories'
import type { Category } from '../../types'

vi.mock('../../api/categories', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const CATS: Category[] = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  { id: 2, name: 'Zelené', parent_id: null, sort_order: 2 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(categoriesApi.getCategories).mockResolvedValue(CATS)
})

describe('Categories', () => {
  it('zobrazí seznam kategorií', async () => {
    renderWithToast(<Categories />)
    expect(await screen.findByText('Bílé')).toBeInTheDocument()
    expect(screen.getByText('Zelené')).toBeInTheDocument()
  })

  it('přidání zavolá createCategory a připne řádek', async () => {
    vi.mocked(categoriesApi.createCategory).mockResolvedValue({
      id: 3,
      name: 'Nová kategorie',
      parent_id: null,
      sort_order: 0,
    })
    const user = userEvent.setup()
    renderWithToast(<Categories />)
    await screen.findByText('Bílé')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith({
        name: 'Nová kategorie',
        parent_id: null,
        sort_order: 0,
      })
    )
    expect(await screen.findByText('Nová kategorie')).toBeInTheDocument()
  })

  it('editace názvu zavolá updateCategory', async () => {
    vi.mocked(categoriesApi.updateCategory).mockResolvedValue({
      id: 1,
      name: 'Bílé čaje',
      parent_id: null,
      sort_order: 1,
    })
    const user = userEvent.setup()
    renderWithToast(<Categories />)
    await screen.findByText('Bílé')
    await user.click(screen.getByText('Bílé'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('Bílé')
    await user.clear(input)
    await user.type(input, 'Bílé čaje')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(categoriesApi.updateCategory).toHaveBeenCalledWith(1, { name: 'Bílé čaje' })
    )
  })

  it('smazání zavolá deleteCategory a odebere řádek', async () => {
    vi.mocked(categoriesApi.deleteCategory).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithToast(<Categories />)
    await screen.findByText('Bílé')
    const deleteButtons = screen.getAllByRole('button', { name: 'smazat' })
    await user.click(deleteButtons[0])
    await waitFor(() => expect(categoriesApi.deleteCategory).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Bílé')).not.toBeInTheDocument())
  })

  it('409 při mazání zobrazí chybu', async () => {
    const { ApiError } = await import('../../api/client')
    vi.mocked(categoriesApi.deleteCategory).mockRejectedValue(
      new ApiError(409, 'Kategorie je použita u čajů, nelze smazat.')
    )
    const user = userEvent.setup()
    renderWithToast(<Categories />)
    await screen.findByText('Bílé')
    await user.click(screen.getAllByRole('button', { name: 'smazat' })[0])
    expect(await screen.findByText(/použita u čajů/i)).toBeInTheDocument()
  })
})
