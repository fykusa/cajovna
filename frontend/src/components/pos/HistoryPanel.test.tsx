// frontend/src/components/pos/HistoryPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistoryPanel from './HistoryPanel'
import styles from './HistoryPanel.module.css'
import type { Sale, SaleItem } from '../../types'

const ITEMS_SALE1: SaleItem[] = [
  {
    id: 10,
    item_type: 'std',
    weight_g: null,
    quantity: 2,
    unit_price: 100,
    total_price: 200,
    note: null,
    tea_id: 5,
    tea_name: 'Zelený čaj',
    category_id: 1,
    surface_type: null,
    volume_ml: null,
  },
  {
    id: 11,
    item_type: 'bag',
    weight_g: null,
    quantity: 1,
    unit_price: 60,
    total_price: 60,
    note: null,
    tea_id: null,
    tea_name: null,
    category_id: null,
    surface_type: 'papír',
    volume_ml: 200,
  },
]

const ITEMS_SALE2: SaleItem[] = [
  {
    id: 20,
    item_type: 'std',
    weight_g: null,
    quantity: 1,
    unit_price: 130,
    total_price: 130,
    note: null,
    tea_id: 8,
    tea_name: 'Bílý čaj',
    category_id: 2,
    surface_type: null,
    volume_ml: null,
  },
]

const SALE: Sale = {
  id: 1,
  user_id: 1,
  username: 'prodavacka',
  total_amount: 260,
  note: null,
  created_at: '2026-06-05T14:32:00',
}

const SALE2: Sale = {
  id: 2,
  user_id: 1,
  username: 'admin',
  total_amount: 130,
  note: null,
  created_at: '2026-06-05T13:15:00',
}

describe('HistoryPanel — tabulkový formát', () => {
  it('zobrazí tabulku s hlavičkami — ID | Čas | Prodavající | Cena za zboží | Cena za pytlíky | Celková', () => {
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    expect(screen.getByText(/ID/)).toBeInTheDocument()
    expect(screen.getByText(/Čas/)).toBeInTheDocument()
    expect(screen.getByText(/Prodavající/)).toBeInTheDocument()
    expect(screen.getByText(/Cena za zboží/)).toBeInTheDocument()
    expect(screen.getByText(/Cena za pytlíky/)).toBeInTheDocument()
    expect(screen.getByText(/Celková/)).toBeInTheDocument()
  })

  it('zobrazí ID prodeje (zarovnání doleva)', () => {
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    expect(screen.getByText(/^1$/)).toBeInTheDocument()
  })

  it('zobrazí čas v HH:mm', () => {
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    expect(screen.getByText(/14:32/)).toBeInTheDocument()
  })

  it('zobrazí prodavajícího', () => {
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    expect(screen.getByText(/prodavacka/)).toBeInTheDocument()
  })

  it('vypočítá cenu za zboží (bez pytlíků) — std + custom, ne bag', () => {
    // ITEMS_SALE1: 1× std (200 Kč) + 1× bag (60 Kč) = 200 Kč zboží
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    // Cena za zboží: součet total_price kde item_type != 'bag'
    const goodsCell = screen.getByTestId('col-goods')
    expect(goodsCell.textContent).toBe('200 Kč')
  })

  it('vypočítá cenu za pytlíky (bag items)', () => {
    // ITEMS_SALE1: 1× bag (60 Kč)
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    const bagCell = screen.getByTestId('col-bag')
    expect(bagCell.textContent).toBe('60 Kč')
  })

  it('zobrazí celkovou cenu (total_amount)', () => {
    render(
      <HistoryPanel
        sales={[SALE]}
        saleItemsByIndex={{ 1: ITEMS_SALE1 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    const totalCell = screen.getByTestId('col-total')
    expect(totalCell.textContent).toBe('260 Kč')
  })

  it('zvýrazní vybraný řádek', () => {
    const { container } = render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        saleItemsByIndex={{ 1: ITEMS_SALE1, 2: ITEMS_SALE2 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    const rows = container.querySelectorAll('[data-testid="history-row"]')
    expect(rows[0]).toHaveClass(styles.selected)
    expect(rows[1]).not.toHaveClass(styles.selected)
  })

  it('zavolá onSelect při kliku na řádek', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        saleItemsByIndex={{ 1: ITEMS_SALE1, 2: ITEMS_SALE2 }}
        selectedIndex={0}
        onSelect={onSelect}
        isActive={true}
      />
    )
    const rows = screen.getAllByTestId('history-row')
    await user.click(rows[1])
    expect(onSelect).toHaveBeenCalledWith(SALE2, 1)
  })

  it('zobrazí nejnovější prodeje nahoře', () => {
    const { container } = render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        saleItemsByIndex={{ 1: ITEMS_SALE1, 2: ITEMS_SALE2 }}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    const rows = container.querySelectorAll('[data-testid="history-row"]')
    expect(rows[0]).toHaveTextContent('14:32')
    expect(rows[1]).toHaveTextContent('13:15')
  })
})
