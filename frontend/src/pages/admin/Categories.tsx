import { useEffect, useState, useCallback } from 'react'
import type { Category } from '../../types'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api/categories'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import { useToast } from '../../components/toast/useToast'
import styles from './Categories.module.css'

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await getCategories())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const visibleCats = categories.filter((c) =>
    showInactive ? Number(c.active) === 0 : Number(c.active) !== 0
  )

  const getCatName = (id: number | null) =>
    id === null ? '(žádná)' : categories.find((c) => c.id === id)?.name ?? `[${id}]`

  const parentOptions = categories.map((c) => ({ value: String(c.id), label: c.name }))

  const columns: ColDef<Category>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    { key: 'name', label: 'Název', type: 'text' },
    {
      key: 'parent_id',
      label: 'Nadřazená',
      type: 'select',
      options: parentOptions,
      render: (c) => getCatName(c.parent_id),
    },
    { key: 'sort_order', label: 'Pořadí', type: 'number' },
  ]

  async function handleSaveCell(cat: Category, col: ColDef<Category>, value: string) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = value
      if (col.type === 'number') parsed = value === '' ? 0 : parseInt(value, 10)
      if (col.key === 'parent_id') parsed = value === '' ? null : parseInt(value, 10)
      const updated = await updateCategory(cat.id, { [col.key]: parsed })
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await createCategory({ name: 'Nová kategorie', parent_id: null, sort_order: 0 })
      setCategories((prev) => [...prev, created])
      setShowInactive(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba vytváření')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(cat: Category) {
    setSaving(true)
    try {
      const newActive = Number(cat.active) === 0 ? 1 : 0
      const updated = await updateCategory(cat.id, { active: newActive })
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)))
      toast.success(newActive ? 'Kategorie aktivována' : 'Kategorie deaktivována')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    setSaving(true)
    try {
      await deleteCategory(cat.id)
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      toast.success('Kategorie smazána')
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
        <h1 className={styles.title}>Kategorie</h1>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Zobrazit jen neaktivní
        </label>
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          + Přidat
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <EditableGrid<Category>
          columns={columns}
          rows={visibleCats}
          getRowId={(c) => c.id}
          onSaveCell={handleSaveCell}
          rowClassName={(c) => (Number(c.active) === 0 ? styles.rowInactive : '')}
          renderRowActions={(cat) =>
            // Kategorie bez čajů lze smazat (dvoukrokově); s čaji jen deaktivovat.
            !(Number(cat.has_teas) > 0) ? (
              confirmDeleteId === cat.id ? (
                <>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(cat)} disabled={saving}>
                    Potvrdit
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={saving}
                  >
                    Zrušit
                  </button>
                </>
              ) : (
                <button
                  className={styles.deleteBtn}
                  onClick={() => setConfirmDeleteId(cat.id)}
                  disabled={saving}
                >
                  smazat
                </button>
              )
            ) : (
              <button
                className={Number(cat.active) === 0 ? styles.activateBtn : styles.deleteBtn}
                onClick={() => handleToggleActive(cat)}
                disabled={saving}
              >
                {Number(cat.active) === 0 ? 'aktivovat' : 'deaktivovat'}
              </button>
            )
          }
        />
      </div>

      {visibleCats.length === 0 && (
        <p className={styles.loading}>
          {showInactive ? 'Žádné neaktivní kategorie.' : 'Žádné aktivní kategorie.'}
        </p>
      )}
    </div>
  )
}
