import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SearchResults from './SearchResults'
import type { Tea } from '../../types'

const TEA: Tea = { id: 1, category_id: 1, name: 'Bancha', note: null, flag: 'active', origin: null,
  std_weight_g: 50, std_price_moc: 160, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 3, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0 }

describe('SearchResults', () => {
  it('zobrazí search query a výsledky', () => {
    render(<SearchResults query="ban" results={[TEA]} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText(/hledám/i)).toBeInTheDocument()
    expect(screen.getByText('Bancha')).toBeInTheDocument()
  })

  it('zobrazí zprávu pokud nejsou výsledky', () => {
    render(<SearchResults query="xyz" results={[]} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText(/nic nenalezeno/i)).toBeInTheDocument()
  })

  it('označí aktivní výsledek', () => {
    render(<SearchResults query="b" results={[TEA]} activeIndex={0} onSelect={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toMatch(/active/)
  })
})
