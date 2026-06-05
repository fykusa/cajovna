import { useEffect, useState, useCallback } from 'react'
import type { Category } from '../../types'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api/categories'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import Modal from '../../components/Modal'
import { useToast } from '../../components/toast/useToast'
import styles from './Categories.module.css'
import modal from '../../components/Modal.module.css'

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', parent_id: '', sort_order: 0 })
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
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...updated } : c)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setAddForm({ name: '', parent_id: '', sort_order: 0 })
    setShowAdd(true)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createCategory({
        name: addForm.name,
        parent_id: addForm.parent_id === '' ? null : Number(addForm.parent_id),
        sort_order: addForm.sort_order,
      })
      setCategories((prev) => [...prev, created])
      setShowInactive(false)
      setShowAdd(false)
      toast.success('Kategorie vytvořena')
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
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...updated } : c)))
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
        <button className={styles.addBtn} onClick={openAdd} disabled={saving}>
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

      {showAdd && (
        <Modal title="Nová kategorie" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddSubmit} className={modal.form}>
            <div className={modal.field}>
              <label className={modal.label}>Název</label>
              <input
                className={modal.input}
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className={modal.field}>
              <label className={modal.label}>Nadřazená</label>
              <select
                className={modal.input}
                value={addForm.parent_id}
                onChange={(e) => setAddForm({ ...addForm, parent_id: e.target.value })}
              >
                <option value="">(žádná)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className={modal.field}>
              <label className={modal.label}>Pořadí</label>
              <input
                type="number"
                className={modal.input}
                value={addForm.sort_order}
                onChange={(e) => setAddForm({ ...addForm, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className={modal.actions}>
              <button type="submit" className={modal.submitBtn} disabled={saving}>Vytvořit</button>
              <button type="button" className={modal.cancelBtn} onClick={() => setShowAdd(false)}>Zrušit</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
