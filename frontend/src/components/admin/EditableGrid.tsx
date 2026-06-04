import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, memo } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import styles from './EditableGrid.module.css'

type SortDir = 'asc' | 'desc'

export interface ColDef<T> {
  key: keyof T & string
  label: string
  type: 'readonly' | 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
  render?: (row: T) => string
}

interface EditableGridProps<T> {
  columns: ColDef<T>[]
  rows: T[]
  getRowId: (row: T) => number
  onSaveCell: (row: T, col: ColDef<T>, value: string) => Promise<void>
  renderRowActions?: (row: T) => ReactNode
  rowClassName?: (row: T) => string
}

// Zobrazený text buňky (render → select label → číslo bez nul → string).
// Mimo komponentu → stabilní reference, aby memoizované řádky nepřekreslovaly.
function cellText<T>(row: T, col: ColDef<T>): string {
  if (col.render) return col.render(row)
  const val = row[col.key]
  if (val === null || val === undefined) return ''
  if (col.type === 'number') {
    const n = parseFloat(String(val))
    return Number.isNaN(n) ? '' : String(n)
  }
  if (col.type === 'select' && col.options) {
    return col.options.find((o) => o.value === String(val))?.label ?? String(val)
  }
  return String(val)
}

// Výchozí hodnota pro editaci (čísla bez zbytečných nul).
function editStart<T>(row: T, col: ColDef<T>): string {
  const val = row[col.key]
  if (val === null || val === undefined) return ''
  if (col.type === 'number') {
    const n = parseFloat(String(val))
    return Number.isNaN(n) ? '' : String(n)
  }
  return String(val)
}

interface RowProps<T> {
  row: T
  rowIndex: number
  columns: ColDef<T>[]
  /** Index editovaného sloupce v tomto řádku, jinak -1. */
  editingCol: number
  className?: string
  renderRowActions?: (row: T) => ReactNode
  hasActions: boolean
  onSelect: (row: number, col: number) => void
  onStartEdit: (row: number, col: number) => void
  onEditCommit: (value: string) => void
  onEditCancel: () => void
}

// Editor jedné buňky s VLASTNÍM lokálním stavem hodnoty → psaní překresluje
// jen tento input, ne celý grid. Hodnotu předá nahoru až při uložení (commit).
function CellEditor({
  initialValue,
  type,
  options,
  onCommit,
  onCancel,
}: {
  initialValue: string
  type: ColDef<unknown>['type']
  options?: { value: string; label: string }[]
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  function keyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onCommit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }
  if (type === 'select') {
    return (
      <select
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={keyDown}
        className={styles.cellEditing}
      >
        <option value="">(prázdné)</option>
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      autoFocus
      type="text"
      inputMode={type === 'number' ? 'decimal' : undefined}
      size={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={keyDown}
      className={styles.cellEditing}
    />
  )
}

// React.memo: řádek se překreslí jen když se mění JEHO props (editace daného
// řádku, data, řazení). Výběr buňky se NEŘEŠÍ přes props ani React stav — je
// to čistě vizuální záležitost a aplikuje se imperativně (classList) na 2
// buňky. Pohyb šipkou tak nevyvolá žádný React render → 0 práce u velkých
// seznamů (dřív se re-renderoval celý rodič a tvořilo se 289 elementů/krok).
function RowInner<T>(p: RowProps<T>) {
  return (
    <tr className={p.className}>
      {p.columns.map((col, ci) => {
        const isEditing = p.editingCol === ci
        return (
          <td
            key={ci}
            data-row={p.rowIndex}
            data-col={ci}
            className={styles.cell}
            onClick={() => p.onSelect(p.rowIndex, ci)}
            onDoubleClick={() => p.onStartEdit(p.rowIndex, ci)}
          >
            {isEditing ? (
              <>
                {/* Neviditelná rozpěra drží původní rozměr buňky; editor leží
                    přes ni absolutně → editace nezmění šířku ani výšku sloupce. */}
                <span className={styles.editSizer}>{cellText(p.row, col) || ' '}</span>
                <CellEditor
                  initialValue={editStart(p.row, col)}
                  type={col.type}
                  options={col.options}
                  onCommit={p.onEditCommit}
                  onCancel={p.onEditCancel}
                />
              </>
            ) : (
              cellText(p.row, col)
            )}
          </td>
        )
      })}
      {p.hasActions && <td className={styles.actionCell}>{p.renderRowActions?.(p.row)}</td>}
    </tr>
  )
}
const Row = memo(RowInner) as typeof RowInner

export default function EditableGrid<T>({
  columns,
  rows,
  getRowId,
  onSaveCell,
  renderRowActions,
  rowClassName,
}: EditableGridProps<T>) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  // Default: řazení podle prvního sloupce (ID) vzestupně.
  const [sortState, setSortState] = useState<{ col: number; dir: SortDir }>({ col: 0, dir: 'asc' })
  // Šířky sloupců změřené z auto-layoutu; po změření přepneme tabulku na
  // table-layout: fixed, aby prohlížeč nepřepočítával layout celé tabulky.
  const [colWidths, setColWidths] = useState<number[] | null>(null)
  const headRowRef = useRef<HTMLTableRowElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Vybraná buňka žije v refu (ne ve stavu) → její změna nevyvolá React render.
  const selectedRef = useRef<{ row: number; col: number } | null>(null)

  const sortedRows = useMemo(() => {
    const col = columns[sortState.col]
    if (!col) return rows
    const dir = sortState.dir === 'asc' ? 1 : -1
    const text = (row: T): string => {
      if (col.render) return col.render(row)
      const v = row[col.key]
      if (v === null || v === undefined) return ''
      if (col.type === 'select' && col.options) {
        return col.options.find((o) => o.value === String(v))?.label ?? String(v)
      }
      return String(v)
    }
    return [...rows].sort((a, b) => {
      const at = text(a)
      const bt = text(b)
      // Prázdné vždy na konec (bez ohledu na směr).
      if (at === '' && bt === '') return 0
      if (at === '') return 1
      if (bt === '') return -1
      // Číselné hodnoty (ID, ceny, gramáže…) řadit numericky, ne jako text
      // (jinak by vyšlo 1, 10, 100, 2).
      const an = Number(at)
      const bn = Number(bt)
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * dir
      return at.localeCompare(bt, 'cs') * dir
    })
  }, [rows, columns, sortState])

  // Refs zrcadlí aktuální hodnoty, aby stabilní (useCallback) handlery
  // nemusely mít závislosti → nepřekreslují memoizované řádky.
  const columnsRef = useRef(columns)
  const sortedRowsRef = useRef(sortedRows)
  const onSaveCellRef = useRef(onSaveCell)
  const editingCellRef = useRef(editingCell)
  columnsRef.current = columns
  sortedRowsRef.current = sortedRows
  onSaveCellRef.current = onSaveCell
  editingCellRef.current = editingCell

  // Vizuální výběr — imperativně přesune třídu .cellSelected na správnou buňku.
  // Žádný React render; běží i po každém renderu (sort/edit/data) přes layout efekt.
  const applySelection = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    grid
      .querySelectorAll(`.${styles.cellSelected}`)
      .forEach((el) => el.classList.remove(styles.cellSelected))
    const sel = selectedRef.current
    if (!sel || editingCellRef.current) return
    const td = grid.querySelector(`td[data-row="${sel.row}"][data-col="${sel.col}"]`)
    td?.classList.add(styles.cellSelected)
  }, [])

  // Po každém renderu (řazení, editace, změna dat) znovu nasaď výběr — React
  // při překreslení buňky třídu odstraní (není v JSX), tady ji vrátíme.
  useLayoutEffect(() => {
    applySelection()
  })

  const navigate = useCallback(
    (row: number, col: number) => {
      selectedRef.current = { row, col }
      applySelection()
      const td = gridRef.current?.querySelector(`td[data-row="${row}"][data-col="${col}"]`)
      // scrollIntoView nemusí existovat (jsdom) → ošetřit
      if (td && typeof td.scrollIntoView === 'function') td.scrollIntoView({ block: 'nearest' })
    },
    [applySelection]
  )

  // První výběr po načtení dat.
  useEffect(() => {
    if (sortedRows.length > 0 && !selectedRef.current) {
      selectedRef.current = { row: 0, col: 0 }
      applySelection()
      setTimeout(() => gridRef.current?.focus(), 0)
    }
  }, [sortedRows.length, applySelection])

  // Změna struktury sloupců (počet/klíče) → zahodit změřené šířky a přeměřit.
  const colSig = columns.map((c) => c.key).join('|') + (renderRowActions ? '|+act' : '')
  useEffect(() => {
    setColWidths(null)
  }, [colSig])

  // Po prvním vykreslení v auto-layoutu změř skutečné šířky hlaviček a zamkni je.
  useLayoutEffect(() => {
    if (colWidths || !headRowRef.current || sortedRows.length === 0) return
    const ths = Array.from(headRowRef.current.children) as HTMLElement[]
    const widths = ths.map((th) => Math.ceil(th.getBoundingClientRect().width))
    // Akční sloupec (poslední) měří jen krátkou hlavičku „Akce", ale musí
    // pojmout i širší stav potvrzení mazání („Potvrdit  Zrušit").
    if (renderRowActions && widths.length > 0) {
      const last = widths.length - 1
      widths[last] = Math.max(widths[last], 105)
    }
    setColWidths(widths)
  }, [colWidths, sortedRows.length, renderRowActions])

  const focusGrid = useCallback(() => setTimeout(() => gridRef.current?.focus(), 0), [])

  const handleSelect = useCallback((row: number, col: number) => navigate(row, col), [navigate])

  const handleStartEdit = useCallback((row: number, col: number) => {
    const colDef = columnsRef.current[col]
    if (!colDef || colDef.type === 'readonly') return
    selectedRef.current = { row, col }
    setEditingCell({ row, col })
  }, [])

  const handleEditCommit = useCallback(
    (value: string) => {
      const editing = editingCellRef.current
      if (!editing) return
      const row = sortedRowsRef.current[editing.row]
      const col = columnsRef.current[editing.col]
      // Zneplatnit hned (synchronně) → druhý commit (onBlur po Enteru) se zahodí.
      editingCellRef.current = null
      setEditingCell(null)
      // Focus zpět na grid OKAMŽITĚ — nečekat na API, jinak by šipky chvíli
      // nereagovaly, dokud běží uložení.
      focusGrid()
      // Ukládat jen při skutečné změně; běží na pozadí (neblokuje navigaci).
      if (value !== editStart(row, col)) {
        void onSaveCellRef.current(row, col, value)
      }
    },
    [focusGrid]
  )

  const handleEditCancel = useCallback(() => {
    editingCellRef.current = null
    setEditingCell(null)
    focusGrid()
  }, [focusGrid])

  function handleHeaderClick(ci: number) {
    setSortState((s) =>
      s.col === ci ? { col: ci, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col: ci, dir: 'asc' }
    )
  }

  function handleKeyDown(e: KeyboardEvent) {
    const sel = selectedRef.current
    if (!sel || editingCell) return
    const { row, col } = sel
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      // Ctrl/Cmd+C zkopíruje text vybrané buňky do schránky.
      e.preventDefault()
      void navigator.clipboard?.writeText(cellText(sortedRows[row], columns[col]))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row > 0) navigate(row - 1, col)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row < sortedRows.length - 1) navigate(row + 1, col)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (col > 0) navigate(row, col - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (col < columns.length - 1) navigate(row, col + 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleStartEdit(row, col)
    }
  }

  return (
    <div ref={gridRef} className={styles.grid} tabIndex={0} onKeyDown={handleKeyDown}>
      <table
        className={styles.table}
        style={
          colWidths
            ? { tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }
            : undefined
        }
      >
        {colWidths && (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr ref={headRowRef}>
            {columns.map((c, ci) => (
              <th key={ci} className={styles.sortable} onClick={() => handleHeaderClick(ci)}>
                {c.label}
                {sortState.col === ci && (
                  <span className={styles.sortIndicator}>{sortState.dir === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
            ))}
            {renderRowActions && <th>Akce</th>}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, ri) => (
            <Row<T>
              key={getRowId(row)}
              row={row}
              rowIndex={ri}
              columns={columns}
              editingCol={editingCell?.row === ri ? editingCell.col : -1}
              className={rowClassName?.(row)}
              renderRowActions={renderRowActions}
              hasActions={!!renderRowActions}
              onSelect={handleSelect}
              onStartEdit={handleStartEdit}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
