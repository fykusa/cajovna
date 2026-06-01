import { useState, useRef, useEffect, useMemo } from 'react'
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

export default function EditableGrid<T>({
  columns,
  rows,
  getRowId,
  onSaveCell,
  renderRowActions,
  rowClassName,
}: EditableGridProps<T>) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  // Default: řazení podle prvního sloupce (ID) vzestupně.
  const [sortState, setSortState] = useState<{ col: number; dir: SortDir }>({ col: 0, dir: 'asc' })
  const gridRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  useEffect(() => {
    if (rows.length > 0 && !selectedCell) {
      setSelectedCell({ row: 0, col: 0 })
      setTimeout(() => gridRef.current?.focus(), 0)
    }
  }, [rows.length, selectedCell])

  const cellDisplay = (row: T, col: ColDef<T>): string => {
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

  const sortedRows = useMemo(() => {
    const col = columns[sortState.col]
    if (!col) return rows
    const dir = sortState.dir === 'asc' ? 1 : -1
    // Zobrazený text buňky pro řazení (render → select label → string); prázdné = ''.
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
      if (col.type === 'number') {
        const av = parseFloat(String(a[col.key] ?? ''))
        const bv = parseFloat(String(b[col.key] ?? ''))
        const aNaN = Number.isNaN(av)
        const bNaN = Number.isNaN(bv)
        if (aNaN && bNaN) return 0
        if (aNaN) return 1 // prázdné vždy na konec
        if (bNaN) return -1
        return (av - bv) * dir
      }
      return text(a).localeCompare(text(b), 'cs') * dir
    })
  }, [rows, columns, sortState])

  function handleHeaderClick(ci: number) {
    setSortState((s) =>
      s.col === ci ? { col: ci, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col: ci, dir: 'asc' }
    )
  }

  const editStartValue = (row: T, col: ColDef<T>): string => {
    const val = row[col.key]
    if (val === null || val === undefined) return ''
    if (col.type === 'number') {
      const n = parseFloat(String(val))
      return Number.isNaN(n) ? '' : String(n)
    }
    return String(val)
  }

  const focusGrid = () => setTimeout(() => gridRef.current?.focus(), 0)

  async function closeAndSave(row: T, col: ColDef<T>) {
    if (closingRef.current) return
    closingRef.current = true
    setEditingCell(null)
    try {
      // Ukládat jen při skutečné změně — jinak by každý Enter/blur spustil API volání.
      if (editValue !== editStartValue(row, col)) {
        await onSaveCell(row, col, editValue)
      }
    } finally {
      closingRef.current = false
      focusGrid()
    }
  }

  function cancelEdit() {
    closingRef.current = true
    setEditingCell(null)
    setTimeout(() => {
      closingRef.current = false
      gridRef.current?.focus()
    }, 0)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!selectedCell || editingCell) return
    const { row, col } = selectedCell
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      // Ctrl/Cmd+C zkopíruje text vybrané buňky do schránky.
      e.preventDefault()
      void navigator.clipboard?.writeText(cellDisplay(sortedRows[row], columns[col]))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row > 0) setSelectedCell({ row: row - 1, col })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row < sortedRows.length - 1) setSelectedCell({ row: row + 1, col })
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (col > 0) setSelectedCell({ row, col: col - 1 })
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (col < columns.length - 1) setSelectedCell({ row, col: col + 1 })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const colDef = columns[col]
      if (colDef.type !== 'readonly') {
        setEditingCell({ row, col })
        setEditValue(editStartValue(sortedRows[row], colDef))
      }
    }
  }

  function handleEditorKeyDown(e: KeyboardEvent, row: T, col: ColDef<T>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      closeAndSave(row, col)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div ref={gridRef} className={styles.grid} tabIndex={0} onKeyDown={handleKeyDown}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((c, ci) => (
              <th
                key={ci}
                className={styles.sortable}
                onClick={() => handleHeaderClick(ci)}
              >
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
            <tr key={getRowId(row)} className={rowClassName?.(row)}>
              {columns.map((col, ci) => {
                const isSelected = selectedCell?.row === ri && selectedCell?.col === ci
                const isEditing = editingCell?.row === ri && editingCell?.col === ci
                return (
                  <td
                    key={ci}
                    className={`${styles.cell} ${isSelected && !isEditing ? styles.cellSelected : ''}`}
                    onClick={() => setSelectedCell({ row: ri, col: ci })}
                  >
                    {isEditing ? (
                      col.type === 'select' ? (
                        <select
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => closeAndSave(row, col)}
                          onKeyDown={(e) => handleEditorKeyDown(e, row, col)}
                          className={styles.cellEditing}
                        >
                          <option value="">(prázdné)</option>
                          {(col.options ?? []).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          type="text"
                          inputMode={col.type === 'number' ? 'decimal' : undefined}
                          size={1}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => closeAndSave(row, col)}
                          onKeyDown={(e) => handleEditorKeyDown(e, row, col)}
                          className={styles.cellEditing}
                        />
                      )
                    ) : (
                      cellDisplay(row, col)
                    )}
                  </td>
                )
              })}
              {renderRowActions && <td className={styles.actionCell}>{renderRowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
