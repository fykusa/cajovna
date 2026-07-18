import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProduktyAdmin from './ProduktyAdmin'
import { renderWithToast } from '../../test/renderWithToast'
import * as teasApi from '../../api/teas'
import * as adminApi from '../../api/admin'
import type { TeaRow } from '../../types'

vi.mock('../../api/teas', () => ({
  getProdukty: vi.fn(),
}))
vi.mock('../../api/admin', () => ({
  syncFromSheets: vi.fn(),
}))

const ROW: TeaRow = {
  id: 1, KOD: 'ND-01', KATEGORIE: 'HRNKY', ZEME: 'ČR', AKTIV: 'x', NAZEV: 'Hrnek modrý',
  POZNAMKA: null, MN1: 1, CENA1: 250, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(teasApi.getProdukty).mockResolvedValue([ROW])
})

describe('ProduktyAdmin', () => {
  it('zobrazí nadpis podle props a načtená data pro daný produktTyp', async () => {
    renderWithToast(<ProduktyAdmin produktTyp="nadobi" nadpis="Nádobí" />)
    expect(await screen.findByText('Nádobí — import ze Sheets')).toBeInTheDocument()
    expect(screen.getByText('Hrnek modrý')).toBeInTheDocument()
    expect(teasApi.getProdukty).toHaveBeenCalledWith('nadobi')
  })

  it('klik na sync zavolá syncFromSheets s produktTyp a znovu načte data', async () => {
    vi.mocked(adminApi.syncFromSheets).mockResolvedValue({ synced: 5, vyrazeno: 1 })
    const user = userEvent.setup()
    renderWithToast(<ProduktyAdmin produktTyp="etnoshop" nadpis="Etnoshop" />)
    await screen.findByText('Hrnek modrý')
    await user.click(screen.getByRole('button', { name: /sync ze sheets/i }))
    await waitFor(() => expect(adminApi.syncFromSheets).toHaveBeenCalledWith('etnoshop'))
    expect(teasApi.getProdukty).toHaveBeenCalledTimes(2)
  })

  it('prázdná tabulka zobrazí hlášku o nutnosti syncu', async () => {
    vi.mocked(teasApi.getProdukty).mockResolvedValue([])
    renderWithToast(<ProduktyAdmin produktTyp="caje" nadpis="Čaje" />)
    expect(await screen.findByText(/tabulka je prázdná/i)).toBeInTheDocument()
  })

  it('zobrazí sloupec "Nákup" a hodnoty NAKUP1-4 jen pro produktTyp="caje"', async () => {
    const rowWithNakup: TeaRow = {
      ...ROW,
      NAKUP1: 90, NAKUP2: null, NAKUP3: null, NAKUP4: null,
    }
    vi.mocked(teasApi.getProdukty).mockResolvedValue([rowWithNakup])
    renderWithToast(<ProduktyAdmin produktTyp="caje" nadpis="Čaje" />)
    await screen.findByText('Hrnek modrý')
    expect(screen.getAllByText('Nákup')).toHaveLength(4)
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('nezobrazí sloupec "Nákup" pro nadobi/etnoshop', async () => {
    renderWithToast(<ProduktyAdmin produktTyp="nadobi" nadpis="Nádobí" />)
    await screen.findByText('Hrnek modrý')
    expect(screen.queryByText('Nákup')).not.toBeInTheDocument()
  })
})
