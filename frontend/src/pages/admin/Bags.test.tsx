import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Bags from './Bags'
import * as bagsApi from '../../api/bags'

vi.mock('../../api/bags', () => ({
  getBags: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(bagsApi.getBags).mockResolvedValue([
    { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: '85x140', price_per_piece: 2.91 },
    { id: 2, surface_type: 'papír', volume_ml: 250, dimensions: '110x185', price_per_piece: 3.63 },
    { id: 3, surface_type: 'bílý matný', volume_ml: 250, dimensions: '110x185', price_per_piece: 3.88 },
  ])
})

describe('Bags', () => {
  it('zobrazí seznam pytlíků seskupený podle materiálu', async () => {
    render(<Bags />)
    expect(await screen.findByText('papír')).toBeInTheDocument()
    expect(screen.getByText('bílý matný')).toBeInTheDocument()
  })

  it('zobrazí objem a cenu pro každý pytlík', async () => {
    render(<Bags />)
    await screen.findByText('papír')
    expect(screen.getByText('100 ml')).toBeInTheDocument()
    expect(screen.getByText(/2,91 Kč/)).toBeInTheDocument()
    expect(screen.getAllByText('250 ml')).toHaveLength(2)
  })
})
