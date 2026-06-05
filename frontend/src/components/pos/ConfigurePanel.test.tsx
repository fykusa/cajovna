import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfigurePanel from './ConfigurePanel'
import type { Tea, Bag } from '../../types'

const TEA: Tea = {
  id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active',
  origin: null,
  std_weight_g: 50, std_price_moc: 240,
  pkg1_weight_g: 200, pkg1_price_moc: 830,
  pkg2_weight_g: 500, pkg2_price_moc: 1990,
  stock_std_pcs: 5, stock_pkg1_pcs: 2, stock_pkg2_pcs: 1, stock_kg: 2,
}

const BAGS: Bag[] = [
  { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 },
  { id: 2, surface_type: 'papír', volume_ml: 250, dimensions: null, price_per_piece: 3.63 },
]

const bagList = [
  { bag: null, label: 'Žádný' },
  { bag: BAGS[0], label: 'papír 100 ml' },
  { bag: BAGS[1], label: 'papír 250 ml' },
]

const packagingOptions = [
  { type: 'std' as const, label: 'Std 50g', weightG: 50, price: 240 },
  { type: 'pkg1' as const, label: 'Bal 1 200g', weightG: 200, price: 830 },
  { type: 'pkg2' as const, label: 'Bal 2 500g', weightG: 500, price: 1990 },
]

const defaultProps = {
  tea: TEA,
  packagingOptions,
  packagingIndex: 0,
  quantity: 1,
  bagList,
  bagIndex: 0,
  activePanel: 'packaging' as const,
}

describe('ConfigurePanel', () => {
  it('zobrazí nadpisy 3 sekcí', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('Balení')).toBeInTheDocument()
    expect(screen.getByText('Množství')).toBeInTheDocument()
    expect(screen.getByText('Pytlík')).toBeInTheDocument()
  })

  it('zobrazí dostupná balení', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('Std 50g')).toBeInTheDocument()
    expect(screen.getByText('Bal 1 200g')).toBeInTheDocument()
    expect(screen.getByText('Bal 2 500g')).toBeInTheDocument()
  })

  it('zobrazí cenu aktivního balení', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('240 Kč')).toBeInTheDocument()
  })

  it('zobrazí aktuální množství', () => {
    render(<ConfigurePanel {...defaultProps} quantity={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('zobrazí seznam pytlíků', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('Žádný')).toBeInTheDocument()
    expect(screen.getByText('papír 100 ml')).toBeInTheDocument()
    expect(screen.getByText('papír 250 ml')).toBeInTheDocument()
  })

  it('aktivní panel má CSS třídu active', () => {
    const { container } = render(<ConfigurePanel {...defaultProps} activePanel="quantity" />)
    const sections = container.querySelectorAll('[data-panel]')
    const quantitySection = Array.from(sections).find(s => s.getAttribute('data-panel') === 'quantity')
    expect(quantitySection?.className).toMatch(/active/)
  })

  it('aktivní položka v balení má CSS třídu selected', () => {
    const { container } = render(<ConfigurePanel {...defaultProps} packagingIndex={1} />)
    const items = container.querySelectorAll('[data-panel="packaging"] li')
    expect(items[1]?.className).toMatch(/selected/)
  })

  it('aktivní položka v pytlíku má CSS třídu selected', () => {
    const { container } = render(<ConfigurePanel {...defaultProps} bagIndex={2} />)
    const items = container.querySelectorAll('[data-panel="bag"] li')
    expect(items[2]?.className).toMatch(/selected/)
  })
})
