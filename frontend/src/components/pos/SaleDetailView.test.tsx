// frontend/src/components/pos/SaleDetailView.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SaleDetailView from './SaleDetailView'
import type { Sale, SaleItem } from '../../types'

const SALE: Sale = {
  id: 1,
  user_id: 1,
  username: 'prodavacka',
  total_amount: 260,
  note: null,
  created_at: '2026-06-05T14:32:00',
}

const ITEMS: SaleItem[] = [
  {
    id: 1,
    item_type: 'std',
    weight_g: null,
    quantity: 2,
    unit_price: 130,
    total_price: 260,
    note: null,
    tea_id: 10,
    tea_name: 'Show Mee',
    category_id: 1,
    surface_type: null,
    volume_ml: null,
  },
]

describe('SaleDetailView', () => {
  it('zobrazí detail prodeje — čas, prodavač, cena', () => {
    render(<SaleDetailView sale={SALE} items={ITEMS} />)
    expect(screen.getByText(/14:32/)).toBeInTheDocument()
    expect(screen.getByText(/prodavacka/)).toBeInTheDocument()
    expect(screen.getByText(/260 Kč/)).toBeInTheDocument()
  })

  it('zobrazí seznam položek s jednotkovými cenami', () => {
    render(<SaleDetailView sale={SALE} items={ITEMS} />)
    expect(screen.getByText(/Show Mee/)).toBeInTheDocument()
    expect(screen.getByText(/×2/)).toBeInTheDocument()
    expect(screen.getByText(/130 Kč/)).toBeInTheDocument()
  })

  it('zobrazí "Prodej je prázdný" pokud sale = null', () => {
    render(<SaleDetailView sale={null} items={[]} />)
    expect(screen.getByText(/Prodej je prázdný/)).toBeInTheDocument()
  })
})
