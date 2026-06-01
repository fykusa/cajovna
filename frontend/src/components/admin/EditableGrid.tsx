import { useState, useRef, useEffect } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import styles from './EditableGrid.module.css'

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
      await onSaveCell(row, col, editValue)
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
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row > 0) setSelectedCell({ row: row - 1, col })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row < rows.length - 1) setSelectedCell({ row: row + 1, col })
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
        setEditValue(editStartValue(rows[row], colDef))
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
              <th key={ci}>{c.label}</th>
            ))}
            {renderRowActions && <th>Akce</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={getRowId(row)} className={rowClassName ? rowClassName(row) : ''}>
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
