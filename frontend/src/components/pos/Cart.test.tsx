// frontend/src/components/pos/Cart.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cart from './Cart'
import { CartItem, Tea, Bag } from '../../types'

const TEA: Tea = { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active',
  origin: null, std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null, stock_std_pcs: 5, stock_pkg1_pcs: 0,
  stock_pkg2_pcs: 0, stock_kg: 0 }

const BAG: Bag = { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 }

const ITEM: CartItem = {
  localId: 'abc', tea: TEA, itemType: 'std', weightG: null,
  quantity: 1, unitPrice: 130, totalPrice: 130, bag: null,
}

const ITEM_WITH_BAG: CartItem = {
  localId: 'def', tea: TEA, itemType: 'std', weightG: null,
  quantity: 2, unitPrice: 130, totalPrice: 260, bag: BAG,
}

describe('Cart', () => {
  it('zobrazí položky košíku s cenami', () => {
    render(<Cart items={[ITEM, ITEM_WITH_BAG]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getAllByText('Show Mee')).toHaveLength(2)
    expect(screen.getByText('130 Kč')).toBeInTheDocument()
    expect(screen.getByText('260 Kč')).toBeInTheDocument()
  })

  it('zobrazí pytlík u položky pokud existuje', () => {
    render(<Cart items={[ITEM_WITH_BAG]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText(/papír.*100 ml/)).toBeInTheDocument()
  })

  it('zobrazí celkovou cenu košíku', () => {
    render(<Cart items={[ITEM, ITEM_WITH_BAG]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText('390 Kč')).toBeInTheDocument()
  })

  it('zavolá onRemove s localId při Delete kliku', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(<Cart items={[ITEM]} onRemove={onRemove} onCheckout={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /smazat|delete|×/i }))
    expect(onRemove).toHaveBeenCalledWith('abc')
  })

  it('zobrazí zprávu pro prázdný košík', () => {
    render(<Cart items={[]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText(/košík je prázdný/i)).toBeInTheDocument()
  })
})
