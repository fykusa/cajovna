import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeaList from './TeaList'
import type { Tea } from '../../types'

const TEAS: Tea[] = [
  { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
    std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
    pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0.5 },
  { id: 2, category_id: 1, name: 'Bai Mu Dan', note: 'poznámka', flag: 'active', origin: null,
    std_weight_g: 30, std_price_moc: 220, pkg1_weight_g: 200, pkg1_price_moc: 700,
    pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 0, stock_pkg1_pcs: 2, stock_pkg2_pcs: 0, stock_kg: 1.0 },
]

describe('TeaList', () => {
  it('zobrazí název čaje a cenu', () => {
    render(<TeaList teas={TEAS} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Show Mee')).toBeInTheDocument()
    expect(screen.getByText(/130/)).toBeInTheDocument()
  })

  it('zobrazí poznámku pokud existuje', () => {
    render(<TeaList teas={TEAS} activeIndex={1} onSelect={vi.fn()} />)
    expect(screen.getByText('poznámka')).toBeInTheDocument()
  })

  it('označí aktivní položku', () => {
    render(<TeaList teas={TEAS} activeIndex={0} onSelect={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toMatch(/active/)
  })

  it('zavolá onSelect s indexem při kliku', () => {
    const onSelect = vi.fn()
    render(<TeaList teas={TEAS} activeIndex={0} onSelect={onSelect} />)
    screen.getByText('Bai Mu Dan').click()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
