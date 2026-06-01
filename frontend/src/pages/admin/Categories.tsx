import { useEffect, useState, useCallback } from 'react'
import type { Category } from '../../types'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api/categories'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import styles from './Categories.module.css'

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await getCategories())
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
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await createCategory({ name: 'Nová kategorie', parent_id: null, sort_order: 0 })
      setCategories((prev) => [...prev, created])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba vytváření')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    setSaving(true)
    try {
      await deleteCategory(cat.id)
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba mazání')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Kategorie</h1>
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          + Přidat
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrapper}>
        <EditableGrid<Category>
          columns={columns}
          rows={categories}
          getRowId={(c) => c.id}
          onSaveCell={handleSaveCell}
          renderRowActions={(cat) => (
            <button className={styles.deleteBtn} onClick={() => handleDelete(cat)} disabled={saving}>
              smazat
            </button>
          )}
        />
      </div>
    </div>
  )
}
