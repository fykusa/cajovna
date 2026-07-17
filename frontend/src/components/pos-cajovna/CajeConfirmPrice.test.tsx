import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CajeConfirmPrice from './CajeConfirmPrice'
import type { CajeBaleni } from '../../types'

const baleni: CajeBaleni = { cislo: 1, label: 'Standard', mn: 30, cena: 130 }

describe('CajeConfirmPrice', () => {
  it('defaultně předvyplní cenu dopočtenou z balení a počtu kusů', () => {
    render(
      <CajeConfirmPrice teaName="Show Mee" baleni={baleni} kusu={2} onConfirm={vi.fn()} />,
    )
    expect(screen.getByLabelText('Cena položky')).toHaveValue(260)
  })

  it('klik na potvrzovací tlačítko pošle výchozí (nezměněnou) cenu', () => {
    const onConfirm = vi.fn()
    render(
      <CajeConfirmPrice teaName="Show Mee" baleni={baleni} kusu={2} onConfirm={onConfirm} />,
    )
    fireEvent.click(screen.getByText('Vložit do košíku'))
    expect(onConfirm).toHaveBeenCalledWith(260)
  })

  it('cenu lze upravit a upravená hodnota se pošle při potvrzení', () => {
    const onConfirm = vi.fn()
    render(
      <CajeConfirmPrice teaName="Show Mee" baleni={baleni} kusu={2} onConfirm={onConfirm} />,
    )
    fireEvent.change(screen.getByLabelText('Cena položky'), { target: { value: '200' } })
    fireEvent.click(screen.getByText('Vložit do košíku'))
    expect(onConfirm).toHaveBeenCalledWith(200)
  })

  it('prázdná nebo záporná cena zablokuje potvrzovací tlačítko', () => {
    render(
      <CajeConfirmPrice teaName="Show Mee" baleni={baleni} kusu={2} onConfirm={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Cena položky'), { target: { value: '-5' } })
    expect(screen.getByText('Vložit do košíku')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Cena položky'), { target: { value: '' } })
    expect(screen.getByText('Vložit do košíku')).toBeDisabled()
  })

  it('kliknutí/focus do pole vybere celý obsah, ať se dá rovnou přepsat', () => {
    render(
      <CajeConfirmPrice teaName="Show Mee" baleni={baleni} kusu={2} onConfirm={vi.fn()} />,
    )
    const input = screen.getByLabelText('Cena položky') as HTMLInputElement
    const selectSpy = vi.spyOn(input, 'select')
    fireEvent.focus(input)
    expect(selectSpy).toHaveBeenCalledOnce()
  })
})
