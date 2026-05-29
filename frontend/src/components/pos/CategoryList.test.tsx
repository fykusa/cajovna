import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryList from './CategoryList'
import { Category } from '../../types'

const CATS: Category[] = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  { id: 2, name: 'Zelené', parent_id: null, sort_order: 2 },
  { id: 3, name: 'Oolong', parent_id: null, sort_order: 3 },
]

describe('CategoryList', () => {
  it('zobrazí všechny kategorie', () => {
    render(<CategoryList categories={CATS} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Bílé')).toBeInTheDocument()
    expect(screen.getByText('Zelené')).toBeInTheDocument()
    expect(screen.getByText('Oolong')).toBeInTheDocument()
  })

  it('označí aktivní položku třídou "active"', () => {
    render(<CategoryList categories={CATS} activeIndex={1} onSelect={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[1].className).toMatch(/active/)
    expect(items[0].className).not.toMatch(/active/)
  })

  it('zavolá onSelect s indexem při kliku', () => {
    const onSelect = vi.fn()
    render(<CategoryList categories={CATS} activeIndex={0} onSelect={onSelect} />)
    screen.getByText('Zelené').click()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
