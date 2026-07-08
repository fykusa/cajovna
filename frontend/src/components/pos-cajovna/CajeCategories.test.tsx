import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CajeCategories from './CajeCategories'
import type { TeaRow } from '../../types'

const tea: TeaRow = {
  id: 4, KOD: '2606-C-BILY-TAWN-03', KATEGORIE: 'BÍLÝ', ZEME: 'Taiwan', AKTIV: 'x', NAZEV: 'Bílý Taiwan',
  POZNAMKA: null, MN1: 30, CENA1: 180, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

describe('CajeCategories', () => {
  it('zobrazí mřížku kategorií, když je searchQuery prázdný', () => {
    render(
      <CajeCategories
        categories={['BÍLÝ', 'PUERH']}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        searchResults={[]}
        onSelectTea={vi.fn()}
      />,
    )
    expect(screen.getByText('BÍLÝ')).toBeInTheDocument()
    expect(screen.getByText('PUERH')).toBeInTheDocument()
  })

  it('psaní do inputu volá onSearchChange', () => {
    const onSearchChange = vi.fn()
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={onSearchChange}
        searchResults={[]}
        onSelectTea={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Hledat podle názvu…'), { target: { value: 'bily' } })
    expect(onSearchChange).toHaveBeenCalledWith('bily')
  })

  it('neprázdný searchQuery skryje mřížku a zobrazí výsledky', () => {
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery="bily"
        onSearchChange={vi.fn()}
        searchResults={[tea]}
        onSelectTea={vi.fn()}
      />,
    )
    expect(screen.queryByText('BÍLÝ')).not.toBeInTheDocument()
    expect(screen.getByText('Bílý Taiwan')).toBeInTheDocument()
  })

  it('prázdné výsledky zobrazí hlášku "Nic nenalezeno"', () => {
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery="xyz"
        onSearchChange={vi.fn()}
        searchResults={[]}
        onSelectTea={vi.fn()}
      />,
    )
    expect(screen.getByText('Nic nenalezeno')).toBeInTheDocument()
  })

  it('klik na výsledek zavolá onSelectTea', () => {
    const onSelectTea = vi.fn()
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery="bily"
        onSearchChange={vi.fn()}
        searchResults={[tea]}
        onSelectTea={onSelectTea}
      />,
    )
    fireEvent.click(screen.getByText('Bílý Taiwan'))
    expect(onSelectTea).toHaveBeenCalledWith(tea)
  })
})
