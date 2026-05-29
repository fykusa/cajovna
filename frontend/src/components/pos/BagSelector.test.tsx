// frontend/src/components/pos/BagSelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BagSelector from './BagSelector'

describe('BagSelector – bag_yn krok', () => {
  it('zobrazí Ano/Ne a označí aktivní', () => {
    render(
      <BagSelector
        step="bag_yn"
        wantBag={true}
        materials={[]}
        materialIndex={0}
        volumes={[]}
        volumeIndex={0}
        onToggleWantBag={vi.fn()}
      />
    )
    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('Ne')).toBeInTheDocument()
    const ano = screen.getByText('Ano').closest('li')!
    expect(ano.className).toMatch(/active/)
  })
})

describe('BagSelector – bag_material krok', () => {
  it('zobrazí dostupné materiály', () => {
    render(
      <BagSelector
        step="bag_material"
        wantBag={true}
        materials={['papír', 'bílý matný']}
        materialIndex={0}
        volumes={[]}
        volumeIndex={0}
        onToggleWantBag={vi.fn()}
      />
    )
    expect(screen.getByText('papír')).toBeInTheDocument()
    expect(screen.getByText('bílý matný')).toBeInTheDocument()
    const papir = screen.getByText('papír').closest('li')!
    expect(papir.className).toMatch(/active/)
  })
})

describe('BagSelector – bag_volume krok', () => {
  it('zobrazí dostupné objemy', () => {
    render(
      <BagSelector
        step="bag_volume"
        wantBag={true}
        materials={['papír']}
        materialIndex={0}
        volumes={[100, 250, 500]}
        volumeIndex={1}
        onToggleWantBag={vi.fn()}
      />
    )
    expect(screen.getByText('100 ml')).toBeInTheDocument()
    expect(screen.getByText('250 ml')).toBeInTheDocument()
    const ml250 = screen.getByText('250 ml').closest('li')!
    expect(ml250.className).toMatch(/active/)
  })
})
