import { useEffect, useState, useCallback } from 'react'
import type { Bag } from '../../types'
import { getBags, createBag, updateBag, deleteBag } from '../../api/bags'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import { useToast } from '../../components/toast/useToast'
import styles from './Bags.module.css'

export default function AdminBags() {
  const [bags, setBags] = useState<Bag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const toast = useToast()

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

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await createBag({
        surface_type: 'nový',
        volume_ml: 0,
        dimensions: null,
        price_per_piece: 0,
      })
      setBags((prev) => [...prev, created])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba vytváření')
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
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          + Přidat
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <EditableGrid<Bag>
          columns={columns}
          rows={bags}
          getRowId={(b) => b.id}
          onSaveCell={handleSaveCell}
          renderRowActions={(bag) =>
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
          }
        />
      </div>
    </div>
  )
}
