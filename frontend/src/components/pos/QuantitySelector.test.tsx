// frontend/src/components/pos/QuantitySelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuantitySelector from './QuantitySelector'
import { Tea } from '../../types'

const TEA: Tea = { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
  std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: 200, pkg1_price_moc: 700,
  pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 5, stock_pkg1_pcs: 2, stock_pkg2_pcs: 0, stock_kg: 0.5 }

describe('QuantitySelector', () => {
  it('zobrazí název čaje a aktuální množství', () => {
    render(<QuantitySelector tea={TEA} quantity={2} onChange={vi.fn()} />)
    expect(screen.getByText('Show Mee')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('zavolá onChange při zadání čísla do inputu', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<QuantitySelector tea={TEA} quantity={1} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '5')
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('zobrazí dostupná balení s cenami', () => {
    render(<QuantitySelector tea={TEA} quantity={1} onChange={vi.fn()} />)
    expect(screen.getByText(/30 g/)).toBeInTheDocument()
    expect(screen.getByText(/130 Kč/)).toBeInTheDocument()
    expect(screen.getByText(/200 g/)).toBeInTheDocument()
    expect(screen.getByText(/700 Kč/)).toBeInTheDocument()
  })
})
