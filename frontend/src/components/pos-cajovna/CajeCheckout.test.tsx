import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CajeCheckout from './CajeCheckout'
import type { CajeCartItem, TeaRow } from '../../types'

const tea: TeaRow = {
  id: 1, KOD: '2606-C-BILY-TAWN-01', KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Show Mee',
  POZNAMKA: null, MN1: 30, CENA1: 130, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

const cartItem: CajeCartItem = {
  localId: 'a',
  caj: tea,
  produktTyp: 'caje',
  baleni: { cislo: 1, label: 'Standard', mn: 30, cena: 130 },
  kusu: 1,
  celkCena: 130,
}

describe('CajeCheckout', () => {
  it('defaultně předvyplní pole zaplacené částky dopočtenou sumou košíku', () => {
    render(
      <CajeCheckout cart={[cartItem]} error={null} onConfirm={vi.fn()} onBack={vi.fn()} />,
    )
    expect(screen.getByLabelText('Zaplacená částka')).toHaveValue(130)
  })

  it('klik na "Zákazník zaplatil" pošle výchozí (nezměněnou) částku', () => {
    const onConfirm = vi.fn()
    render(
      <CajeCheckout cart={[cartItem]} error={null} onConfirm={onConfirm} onBack={vi.fn()} />,
    )
    fireEvent.click(screen.getByText('✓ Zákazník zaplatil'))
    expect(onConfirm).toHaveBeenCalledWith(130)
  })

  it('částku lze upravit a upravená hodnota se pošle při potvrzení', () => {
    const onConfirm = vi.fn()
    render(
      <CajeCheckout cart={[cartItem]} error={null} onConfirm={onConfirm} onBack={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Zaplacená částka'), { target: { value: '150' } })
    fireEvent.click(screen.getByText('✓ Zákazník zaplatil'))
    expect(onConfirm).toHaveBeenCalledWith(150)
  })

  it('prázdná nebo záporná částka zablokuje potvrzovací tlačítko', () => {
    render(
      <CajeCheckout cart={[cartItem]} error={null} onConfirm={vi.fn()} onBack={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Zaplacená částka'), { target: { value: '-5' } })
    expect(screen.getByText('✓ Zákazník zaplatil')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Zaplacená částka'), { target: { value: '' } })
    expect(screen.getByText('✓ Zákazník zaplatil')).toBeDisabled()
  })

  it('kliknutí/focus do pole vybere celý obsah, ať se dá rovnou přepsat', () => {
    render(
      <CajeCheckout cart={[cartItem]} error={null} onConfirm={vi.fn()} onBack={vi.fn()} />,
    )
    const input = screen.getByLabelText('Zaplacená částka') as HTMLInputElement
    const selectSpy = vi.spyOn(input, 'select')
    fireEvent.focus(input)
    expect(selectSpy).toHaveBeenCalledOnce()
  })
})
