import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as salesApi from '../../api/sales'
import type { CartItem, Tea, Bag } from '../../types'
import CheckoutDialog from './CheckoutDialog'

vi.mock('../../api/sales', () => ({
  createSale: vi.fn(),
}))

const mockCreateSale = vi.mocked(salesApi.createSale)

const TEA: Tea = { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active',
  origin: null, std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null, stock_std_pcs: 5, stock_pkg1_pcs: 0,
  stock_pkg2_pcs: 0, stock_kg: 0 }

const BAG: Bag = { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 }

const ITEMS: CartItem[] = [
  { localId: 'a', tea: TEA, itemType: 'std', weightG: null,
    quantity: 2, unitPrice: 130, totalPrice: 260, bag: null },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CheckoutDialog', () => {
  it('zobrazí sumarizaci košíku a celkovou cenu', () => {
    render(<CheckoutDialog items={ITEMS} onSuccess={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Show Mee')).toBeInTheDocument()
    expect(screen.getByText(/260/)).toBeInTheDocument()
    expect(screen.getByText(/celkem/i)).toBeInTheDocument()
  })

  it('započítá cenu pytlíků do celkové částky', () => {
    const itemsWithBag: CartItem[] = [
      { localId: 'a', tea: TEA, itemType: 'std', weightG: null,
        quantity: 2, unitPrice: 130, totalPrice: 260, bag: BAG },
    ]
    render(<CheckoutDialog items={itemsWithBag} onSuccess={vi.fn()} onCancel={vi.fn()} />)
    // 260 + (2.91 × 2) = 265.82 → 266 Kč
    expect(screen.getByText(/Celkem: 266 Kč/)).toBeInTheDocument()
  })

  it('zavolá createSale a onSuccess po potvrzení', async () => {
    mockCreateSale.mockResolvedValueOnce({ sale_id: 42, total: 260 })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<CheckoutDialog items={ITEMS} onSuccess={onSuccess} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /zaplatit|potvrdit/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(mockCreateSale).toHaveBeenCalledTimes(1)
  })

  it('zavolá onCancel při stisknutí Zrušit', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<CheckoutDialog items={ITEMS} onSuccess={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: /zrušit|storno/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('zobrazí chybu při selhání API', async () => {
    mockCreateSale.mockRejectedValueOnce(new Error('Server error'))
    const user = userEvent.setup()
    render(<CheckoutDialog items={ITEMS} onSuccess={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /zaplatit|potvrdit/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
