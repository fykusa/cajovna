import { useEffect, useState, useCallback } from 'react'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct } from '../../api/products'
import { updateStock } from '../../api/stock'
import type { Tea, Category } from '../../types'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import { useToast } from '../../components/toast/useToast'
import styles from './Items.module.css'

const FLAG_OPTIONS = ['active', 'discontinued', 'no_insert', 'eshop_only', 'trial'].map((f) => ({
  value: f,
  label: f,
}))

export default function AdminItems() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [nameFilter, setNameFilter] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [allTeas, cats] = await Promise.all([getProducts(), getCategories()])
      setTeas(allTeas)
      setCategories(cats)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const nameQuery = nameFilter.trim().toLowerCase()
  const visibleTeas = (showInactive
    ? teas.filter((t) => t.flag !== 'active')
    : teas.filter((t) => t.flag === 'active')
  )
    .filter((t) => categoryFilter === null || t.category_id === categoryFilter)
    // Filtr podle jména – substring kdekoli (jako SQL LIKE %…%), bez diakr. citlivosti na velikost.
    .filter((t) => nameQuery === '' || t.name.toLowerCase().includes(nameQuery))

  const getCategoryName = (catId: number) =>
    categories.find((c) => c.id === catId)?.name || `[${catId}]`

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }))

  const columns: ColDef<Tea>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    {
      key: 'category_id',
      label: 'Kategorie',
      type: 'select',
      options: categoryOptions,
      render: (t) => getCategoryName(t.category_id),
    },
    { key: 'name', label: 'Název', type: 'text' },
    { key: 'flag', label: 'Status', type: 'select', options: FLAG_OPTIONS },
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

  async function handleSaveCell(tea: Tea, col: ColDef<Tea>, value: string) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = value
      if (col.type === 'number') parsed = value === '' ? null : parseFloat(value)
      if (col.key === 'category_id') parsed = parseInt(value, 10)

      if (col.key.startsWith('stock_')) {
        const updated = await updateStock(tea.id, { [col.key]: parsed })
        setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      } else {
        const updated = await updateProduct(tea.id, { [col.key]: parsed })
        setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      }
      toast.success('Záznam uložen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    if (categories.length === 0) {
      toast.error('Nejprve vytvořte kategorii')
      return
    }
    setSaving(true)
    try {
      const catId = categoryFilter ?? categories[0].id
      const created = await createProduct({ category_id: catId, name: 'Nový čaj', flag: 'active' })
      setTeas((prev) => [...prev, created])
      setShowInactive(false) // nový čaj je aktivní → ať je vidět
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba vytváření')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(tea: Tea) {
    setSaving(true)
    try {
      const newFlag = tea.flag === 'active' ? 'discontinued' : 'active'
      const updated = await updateProduct(tea.id, { flag: newFlag })
      setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      toast.success(newFlag === 'active' ? 'Čaj aktivován' : 'Čaj deaktivován')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tea: Tea) {
    setSaving(true)
    try {
      await deleteProduct(tea.id)
      setTeas((prev) => prev.filter((t) => t.id !== tea.id))
      toast.success('Čaj smazán')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba mazání')
    } finally {
      setSaving(false)
      setConfirmDeleteId(null)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Položky</h1>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Zobrazit jen neaktivní
        </label>
        <input
          type="text"
          className={styles.nameFilter}
          placeholder="Hledat podle názvu…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          + Přidat
        </button>
      </div>

      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Kategorie</label>
        <div className={styles.filterGrid}>
          {categories
            .filter((c) => !c.parent_id)
            .map((cat) => (
              <button
                key={cat.id}
                className={`${styles.filterBtn}${categoryFilter === cat.id ? ' ' + styles.filterActive : ''}`}
                onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
              >
                <span className={styles.filterId}>{String(cat.id).padStart(2, '0')}</span>{' '}
                {cat.name}
              </button>
            ))}
        </div>
      </div>


      <div className={styles.tableWrapper}>
        <EditableGrid<Tea>
          columns={columns}
          rows={visibleTeas}
          getRowId={(t) => t.id}
          onSaveCell={handleSaveCell}
          rowClassName={(t) => (t.flag !== 'active' ? styles.rowInactive : '')}
          renderRowActions={(tea) =>
            // Čaj bez prodejů lze rovnou smazat (dvoukrokově); s prodeji jen deaktivovat.
            !(Number(tea.has_sales) > 0) ? (
              confirmDeleteId === tea.id ? (
                <>
                  <button
                    className={`${styles.actionBtn} ${styles.actionDeactivate}`}
                    onClick={() => handleDelete(tea)}
                    disabled={saving}
                  >
                    Potvrdit
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionCancel}`}
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={saving}
                  >
                    Zrušit
                  </button>
                </>
              ) : (
                <button
                  className={`${styles.actionBtn} ${styles.actionDeactivate}`}
                  onClick={() => setConfirmDeleteId(tea.id)}
                  disabled={saving}
                >
                  smazat
                </button>
              )
            ) : (
              <button
                className={`${styles.actionBtn} ${
                  tea.flag === 'active' ? styles.actionDeactivate : styles.actionActivate
                }`}
                onClick={() => handleToggleActive(tea)}
                disabled={saving}
              >
                {tea.flag === 'active' ? 'deaktivovat' : 'aktivovat'}
              </button>
            )
          }
        />
      </div>

      {visibleTeas.length === 0 && !loading && (
        <p className={styles.empty}>
          {showInactive ? 'Žádné neaktivní položky.' : 'Žádné aktivní položky.'}
        </p>
      )}
    </div>
  )
}
