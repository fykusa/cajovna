// frontend/src/components/pos/HistoryPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistoryPanel from './HistoryPanel'
import styles from './HistoryPanel.module.css'
import type { Sale } from '../../types'

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

describe('HistoryPanel', () => {
  it('zobrazí seznam prodejů', () => {
    render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    expect(screen.getByText(/prodavacka/)).toBeInTheDocument()
    expect(screen.getByText(/admin/)).toBeInTheDocument()
  })

  it('zvýrazní vybraný řádek (selectedIndex)', () => {
    const { container } = render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    const items = container.querySelectorAll('[data-testid="history-item"]')
    expect(items[0]).toHaveClass(styles.selected)
    expect(items[1]).not.toHaveClass(styles.selected)
  })

  it('zavolá onSelect při kliku na řádek', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        selectedIndex={0}
        onSelect={onSelect}
        isActive={true}
      />
    )
    const items = screen.getAllByTestId('history-item')
    await user.click(items[1])
    expect(onSelect).toHaveBeenCalledWith(SALE2, 1)
  })

  it('zobrazí nejnovější prodeje nahoře', () => {
    const { container } = render(
      <HistoryPanel
        sales={[SALE, SALE2]}
        selectedIndex={0}
        onSelect={() => {}}
        isActive={true}
      />
    )
    const items = container.querySelectorAll('[data-testid="history-item"]')
    expect(items[0]).toHaveTextContent('14:32')
    expect(items[1]).toHaveTextContent('13:15')
  })
})
