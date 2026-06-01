import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableGrid, { type ColDef } from './EditableGrid'

interface Row {
  id: number
  name: string
  qty: number
}

const COLUMNS: ColDef<Row>[] = [
  { key: 'id', label: 'ID', type: 'readonly' },
  { key: 'name', label: 'Název', type: 'text' },
  { key: 'qty', label: 'Počet', type: 'number' },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alfa', qty: 30 },
  { id: 2, name: 'Beta', qty: 5 },
]

function setup(onSaveCell = vi.fn().mockResolvedValue(undefined)) {
  render(
    <EditableGrid<Row>
      columns={COLUMNS}
      rows={ROWS}
      getRowId={(r) => r.id}
      onSaveCell={onSaveCell}
    />
  )
  return { onSaveCell }
}

describe('EditableGrid', () => {
  it('zobrazí čísla bez zbytečných desetinných nul', () => {
    setup()
    // qty 30 se zobrazí jako "30", ne "30.0"
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('Enter vstoupí do editace, šipky během editace nepřesouvají výběr', async () => {
    const user = userEvent.setup()
    setup()
    const nameCell = screen.getByText('Alfa')
    await user.click(nameCell)
    await user.keyboard('{Enter}')

    const input = screen.getByDisplayValue('Alfa')
    const belowCell = screen.getByText('Beta').closest('td')!

    await user.keyboard('{ArrowDown}')
    expect(belowCell.className).not.toContain('cellSelected')
    expect(screen.getByDisplayValue('Alfa')).toBe(input)
  })

  it('uložení přes Enter zavolá onSaveCell se správnými argumenty', async () => {
    const onSaveCell = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    setup(onSaveCell)
    await user.click(screen.getByText('Alfa'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('Alfa')
    await user.clear(input)
    await user.type(input, 'Gama')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(onSaveCell).toHaveBeenCalledWith(
        ROWS[0],
        expect.objectContaining({ key: 'name' }),
        'Gama'
      )
    )
  })

  it('Escape zruší editaci bez uložení', async () => {
    const onSaveCell = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    setup(onSaveCell)
    await user.click(screen.getByText('Alfa'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('Alfa')
    await user.clear(input)
    await user.type(input, 'Změna')
    await user.keyboard('{Escape}')
    // editace skončila, input zmizel a nic se neuložilo
    expect(screen.queryByDisplayValue('Změna')).not.toBeInTheDocument()
    expect(onSaveCell).not.toHaveBeenCalled()
  })

  it('renderRowActions vykreslí akční sloupec', () => {
    render(
      <EditableGrid<Row>
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        onSaveCell={vi.fn().mockResolvedValue(undefined)}
        renderRowActions={(r) => <button>smazat {r.id}</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'smazat 1' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Akce' })).toBeInTheDocument()
  })

  it('readonly sloupec nelze editovat (Enter neotevře input)', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('1')) // ID buňka, readonly
    await user.keyboard('{Enter}')
    // žádný input se neobjeví
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('výchozí řazení je podle prvního sloupce (ID) vzestupně', () => {
    render(
      <EditableGrid<Row>
        columns={COLUMNS}
        rows={[
          { id: 2, name: 'Beta', qty: 5 },
          { id: 1, name: 'Alfa', qty: 30 },
        ]}
        getRowId={(r) => r.id}
        onSaveCell={vi.fn().mockResolvedValue(undefined)}
      />
    )
    const dataRows = screen.getAllByRole('row').slice(1) // bez hlavičky
    expect(dataRows[0]).toHaveTextContent('Alfa') // id 1 první
    expect(dataRows[1]).toHaveTextContent('Beta')
  })

  it('klik na hlavičku řadí vzestupně, druhý klik sestupně', async () => {
    const user = userEvent.setup()
    setup()
    // klik na "Počet" → vzestupně podle qty: Beta(5) před Alfa(30)
    await user.click(screen.getByRole('columnheader', { name: /Počet/ }))
    let dataRows = screen.getAllByRole('row').slice(1)
    expect(dataRows[0]).toHaveTextContent('Beta')
    expect(dataRows[1]).toHaveTextContent('Alfa')
    // druhý klik → sestupně: Alfa(30) první
    await user.click(screen.getByRole('columnheader', { name: /Počet/ }))
    dataRows = screen.getAllByRole('row').slice(1)
    expect(dataRows[0]).toHaveTextContent('Alfa')
    expect(dataRows[1]).toHaveTextContent('Beta')
  })

  it('Ctrl+C zkopíruje text vybrané buňky do schránky', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup()
    await user.click(screen.getByText('Alfa'))
    await user.keyboard('{Control>}c{/Control}')
    expect(writeText).toHaveBeenCalledWith('Alfa')
  })
})
