import { useEffect, useState, useCallback } from 'react'
import type { Bag } from '../../types'
import { getBags, createBag, updateBag, deleteBag } from '../../api/bags'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import Modal from '../../components/Modal'
import { useToast } from '../../components/toast/useToast'
import styles from './Bags.module.css'
import modal from '../../components/Modal.module.css'

export default function AdminBags() {
  const [bags, setBags] = useState<Bag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ surface_type: '', volume_ml: 0 })
  const toast = useToast()

  const visibleBags = bags.filter((b) =>
    showInactive ? Number(b.active) === 0 : Number(b.active) !== 0
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBags(await getBags())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const columns: ColDef<Bag>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    { key: 'surface_type', label: 'Materiál', type: 'text' },
    { key: 'volume_ml', label: 'Objem ml', type: 'number' },
    { key: 'dimensions', label: 'Rozměry', type: 'text' },
    { key: 'price_per_piece', label: 'Cena/ks', type: 'number' },
    { key: 'var1_qty', label: 'V1 ks', type: 'number' },
    { key: 'var1_price', label: 'V1 cena', type: 'number' },
    { key: 'var1_margin_pct', label: 'V1 marže %', type: 'number' },
    { key: 'var2_qty', label: 'V2 ks', type: 'number' },
    { key: 'var2_price', label: 'V2 cena', type: 'number' },
    { key: 'var2_margin_pct', label: 'V2 marže %', type: 'number' },
    { key: 'var3_qty', label: 'V3 ks', type: 'number' },
    { key: 'var3_price', label: 'V3 cena', type: 'number' },
    { key: 'var3_margin_pct', label: 'V3 marže %', type: 'number' },
    { key: 'supplier_url', label: 'Dodavatel URL', type: 'text' },
  ]

  async function handleSaveCell(bag: Bag, col: ColDef<Bag>, value: string) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = value
      if (col.type === 'number') parsed = value === '' ? null : parseFloat(value)
      const updated = await updateBag(bag.id, { [col.key]: parsed })
      setBags((prev) => prev.map((b) => (b.id === bag.id ? updated : b)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setAddForm({ surface_type: '', volume_ml: 0 })
    setShowAdd(true)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createBag({
        surface_type: addForm.surface_type,
        volume_ml: addForm.volume_ml,
        dimensions: null,
        price_per_piece: 0,
      })
      setBags((prev) => [...prev, created])
      setShowInactive(false)
      setShowAdd(false)
      toast.success('Pytlík vytvořen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba vytváření')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(bag: Bag) {
    setSaving(true)
    try {
      const newActive = Number(bag.active) === 0 ? 1 : 0
      const updated = await updateBag(bag.id, { active: newActive })
      setBags((prev) => prev.map((b) => (b.id === bag.id ? updated : b)))
      toast.success(newActive ? 'Pytlík aktivován' : 'Pytlík deaktivován')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bag: Bag) {
    setSaving(true)
    try {
      await deleteBag(bag.id)
      setBags((prev) => prev.filter((b) => b.id !== bag.id))
      toast.success('Pytlík smazán')
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
        <h1 className={styles.title}>Pytlíky</h1>
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
        <EditableGrid<Bag>
          columns={columns}
          rows={visibleBags}
          getRowId={(b) => b.id}
          onSaveCell={handleSaveCell}
          rowClassName={(b) => (Number(b.active) === 0 ? styles.rowInactive : '')}
          renderRowActions={(bag) =>
            // Pytlík bez prodejů lze smazat (dvoukrokově); s prodeji jen deaktivovat.
            !(Number(bag.has_sales) > 0) ? (
              confirmDeleteId === bag.id ? (
                <>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(bag)} disabled={saving}>
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
                  onClick={() => setConfirmDeleteId(bag.id)}
                  disabled={saving}
                >
                  smazat
                </button>
              )
            ) : (
              <button
                className={Number(bag.active) === 0 ? styles.activateBtn : styles.deleteBtn}
                onClick={() => handleToggleActive(bag)}
                disabled={saving}
              >
                {Number(bag.active) === 0 ? 'aktivovat' : 'deaktivovat'}
              </button>
            )
          }
        />
      </div>

      {visibleBags.length === 0 && (
        <p className={styles.loading}>
          {showInactive ? 'Žádné neaktivní pytlíky.' : 'Žádné aktivní pytlíky.'}
        </p>
      )}

      {showAdd && (
        <Modal title="Nový pytlík" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAddSubmit} className={modal.form}>
            <div className={modal.field}>
              <label className={modal.label}>Materiál</label>
              <input
                className={modal.input}
                value={addForm.surface_type}
                onChange={(e) => setAddForm({ ...addForm, surface_type: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className={modal.field}>
              <label className={modal.label}>Objem (ml)</label>
              <input
                type="number"
                className={modal.input}
                value={addForm.volume_ml}
                onChange={(e) => setAddForm({ ...addForm, volume_ml: Number(e.target.value) })}
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
