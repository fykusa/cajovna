import { useEffect, useState, useCallback, useRef } from 'react'
import { getProducts, getCategories, updateProduct, deleteProduct } from '../../api/products'
import { updateStock } from '../../api/stock'
import type { Tea, Category } from '../../types'
import styles from './Items.module.css'

interface ColDef {
  key: keyof Tea | 'category_name'
  label: string
  type: 'readonly' | 'text' | 'number' | 'select'
  options?: string[]
}

const COLUMNS: ColDef[] = [
  { key: 'id', label: 'ID', type: 'readonly' },
  { key: 'category_id', label: 'Kategorie', type: 'select' },
  { key: 'name', label: 'Název', type: 'text' },
  { key: 'flag', label: 'Status', type: 'select', options: ['active', 'discontinued', 'no_insert', 'eshop_only', 'trial'] },
  { key: 'origin', label: 'Původ', type: 'text' },
  { key: 'note', label: 'Poznámka', type: 'text' },
  { key: 'std_weight_g', label: 'Std g', type: 'number' },
  { key: 'std_price_moc', label: 'Std Kč', type: 'number' },
  { key: 'pkg1_weight_g', label: 'Bal1 g', type: 'number' },
  { key: 'pkg1_price_moc', label: 'Bal1 Kč', type: 'number' },
  { key: 'pkg2_weight_g', label: 'Bal2 g', type: 'number' },
  { key: 'pkg2_price_moc', label: 'Bal2 Kč', type: 'number' },
  { key: 'stock_std_pcs', label: 'Sklad std', type: 'number' },
  { key: 'stock_pkg1_pcs', label: 'Sklad bal1', type: 'number' },
  { key: 'stock_pkg2_pcs', label: 'Sklad bal2', type: 'number' },
  { key: 'stock_kg', label: 'Sklad kg', type: 'number' },
]

export default function AdminItems() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [allTeas, cats] = await Promise.all([getProducts(), getCategories()])
      setTeas(allTeas)
      setCategories(cats)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleTeas = (showInactive
    ? teas.filter((t) => t.flag !== 'active')
    : teas.filter((t) => t.flag === 'active')
  ).filter((t) => categoryFilter === null || t.category_id === categoryFilter)

  useEffect(() => {
    if (visibleTeas.length > 0 && !selectedCell) {
      setSelectedCell({ row: 0, col: 0 })
      setTimeout(() => pageRef.current?.focus(), 0)
    }
  }, [visibleTeas.length, selectedCell])

  const getCategoryName = (catId: number) => categories.find((c) => c.id === catId)?.name || `[${catId}]`

  const getCellValue = (tea: Tea, col: ColDef): string => {
    if (col.key === 'category_name') return getCategoryName(tea.category_id)
    const val = tea[col.key as keyof Tea]
    if (val === null || val === undefined) return ''
    return String(val)
  }

  async function saveCellValue(tea: Tea, col: ColDef, value: string) {
    if (col.type === 'readonly') return
    setSaving(true)
    try {
      let parsedValue: any = value
      if (col.type === 'number') parsedValue = value === '' ? null : parseFloat(value)
      if (col.key === 'category_id') parsedValue = parseInt(value)

      // Sklad se šetří přes updateStock
      if (col.key.toString().startsWith('stock_')) {
        const stockKey = col.key as 'stock_std_pcs' | 'stock_pkg1_pcs' | 'stock_pkg2_pcs' | 'stock_kg'
        const updated = await updateStock(tea.id, { [stockKey]: parsedValue })
        setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      } else {
        const updated = await updateProduct(tea.id, { [col.key]: parsedValue })
        setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      }

      setEditingCell(null)
      setError(null)
      setSuccess('Záznam uložen')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTea(tea: Tea) {
    if (!window.confirm(`Smazat čaj "${tea.name}"?`)) return
    setSaving(true)
    try {
      await deleteProduct(tea.id)
      setTeas((prev) => prev.filter((t) => t.id !== tea.id))
      setError(null)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Chyba'
      setError(errMsg)
    } finally {
      setSaving(false)
    }
  }

  function handleCellClick(row: number, col: number) {
    setSelectedCell({ row, col })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!selectedCell) return

    // Během editace buňky navigace neběží — Enter/Escape řeší editor inputu,
    // šipky musí zůstat default (pohyb kurzoru v textu), žádný skok do jiné buňky.
    if (editingCell) return

    const { row, col } = selectedCell

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row > 0) setSelectedCell({ row: row - 1, col })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row < visibleTeas.length - 1) setSelectedCell({ row: row + 1, col })
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (col > 0) setSelectedCell({ row, col: col - 1 })
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (col < COLUMNS.length - 1) setSelectedCell({ row, col: col + 1 })
    } else if (e.key === 'Enter' && !editingCell) {
      e.preventDefault()
      const colDef = COLUMNS[col]
      if (colDef.type !== 'readonly') {
        setEditingCell({ row, col })
        setEditValue(getCellValue(visibleTeas[row], colDef))
      }
    } else if (e.key === 'Escape' && editingCell) {
      e.preventDefault()
      setEditingCell(null)
    }
  }

  const handleEditorKeyDown = async (e: React.KeyboardEvent, tea: Tea, col: ColDef) => {
    if (e.key === 'Enter') {
      await saveCellValue(tea, col, editValue)
      e.preventDefault()
      setTimeout(() => pageRef.current?.focus(), 0)
    }
    if (e.key === 'Escape') {
      setEditingCell(null)
      e.preventDefault()
      setTimeout(() => pageRef.current?.focus(), 0)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div ref={pageRef} className={styles.page} tabIndex={0} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <h1 className={styles.title}>Položky</h1>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Zobrazit neaktivní
        </label>
      </div>

      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Kategorie</label>
        <div className={styles.filterGrid}>
          {categories.filter((c) => !c.parent_id).map((cat) => (
            <button
              key={cat.id}
              className={`${styles.filterBtn}${categoryFilter === cat.id ? ' ' + styles.filterActive : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
            >
              <span className={styles.filterId}>{String(cat.id).padStart(2, '0')}</span>
              {' '}
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col, ci) => (
                <th key={ci}>{col.label}</th>
              ))}
              <th>Akce</th>
            </tr>
          </thead>
          <tbody>
            {visibleTeas.map((tea, ri) => (
              <tr key={tea.id} className={tea.flag !== 'active' ? styles.rowInactive : ''}>
                {COLUMNS.map((col, ci) => {
                  const isSelected = selectedCell?.row === ri && selectedCell?.col === ci
                  const isEditing = editingCell?.row === ri && editingCell?.col === ci

                  return (
                    <td
                      key={ci}
                      className={`${styles.cell} ${isSelected ? styles.cellSelected : ''}`}
                      onClick={() => handleCellClick(ri, ci)}
                    >
                      {isEditing ? (
                        col.type === 'select' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveCellValue(tea, col, editValue)}
                            onKeyDown={(e) => handleEditorKeyDown(e, tea, col)}
                            className={styles.cellEditing}
                          >
                            <option value="">(prázdné)</option>
                            {(col.options || []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={col.type === 'number' ? 'number' : 'text'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveCellValue(tea, col, editValue)}
                            onKeyDown={(e) => handleEditorKeyDown(e, tea, col)}
                            className={styles.cellEditing}
                          />
                        )
                      ) : (
                        getCellValue(tea, col)
                      )}
                    </td>
                  )
                })}
                <td className={styles.actionCell}>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteTea(tea)}
                    disabled={saving}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleTeas.length === 0 && !loading && (
        <p className={styles.empty}>
          {showInactive ? 'Žádné neaktivní položky.' : 'Žádné aktivní položky.'}
        </p>
      )}
    </div>
  )
}
