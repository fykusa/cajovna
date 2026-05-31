import { useEffect, useState } from 'react'
import type { Tea } from '../../types'
import { getProducts } from '../../api/products'
import { updateStock } from '../../api/stock'
import styles from './Products.module.css'

interface StockEdit {
  teaId: number
  std: number
  pkg1: number
  pkg2: number
  kg: number
}

export default function Products() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stockEdit, setStockEdit] = useState<StockEdit | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    getProducts().then(setTeas).finally(() => setLoading(false))
  }, [])

  const filtered = teas.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  function openStockEdit(tea: Tea) {
    setStockEdit({
      teaId: tea.id,
      std: tea.stock_std_pcs,
      pkg1: tea.stock_pkg1_pcs,
      pkg2: tea.stock_pkg2_pcs,
      kg: Number(tea.stock_kg),
    })
  }

  async function saveStock() {
    if (!stockEdit) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateStock(stockEdit.teaId, {
        stock_std_pcs: stockEdit.std,
        stock_pkg1_pcs: stockEdit.pkg1,
        stock_pkg2_pcs: stockEdit.pkg2,
        stock_kg: stockEdit.kg,
      })
      setTeas((prev) =>
        prev.map((t) =>
          t.id === stockEdit.teaId
            ? { ...t, stock_std_pcs: stockEdit.std, stock_pkg1_pcs: stockEdit.pkg1,
                stock_pkg2_pcs: stockEdit.pkg2, stock_kg: stockEdit.kg }
            : t
        )
      )
      setStockEdit(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1>Čaje</h1>
        <input
          placeholder="Hledat čaj…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>

      {stockEdit && (
        <div className={styles.stockForm}>
          <h3>Upravit sklad</h3>
          {saveError && <p style={{ color: '#f87171', width: '100%' }}>{saveError}</p>}
          <label>
            Std ks:
            <input type="number" value={stockEdit.std}
              onChange={(e) => setStockEdit({ ...stockEdit, std: +e.target.value })}
              className={styles.numInput} />
          </label>
          <label>
            Bal 1 ks:
            <input type="number" value={stockEdit.pkg1}
              onChange={(e) => setStockEdit({ ...stockEdit, pkg1: +e.target.value })}
              className={styles.numInput} />
          </label>
          <label>
            Bal 2 ks:
            <input type="number" value={stockEdit.pkg2}
              onChange={(e) => setStockEdit({ ...stockEdit, pkg2: +e.target.value })}
              className={styles.numInput} />
          </label>
          <label>
            Sypný kg:
            <input type="number" step="0.001" value={stockEdit.kg}
              onChange={(e) => setStockEdit({ ...stockEdit, kg: +e.target.value })}
              className={styles.numInput} />
          </label>
          <div className={styles.formActions}>
            <button onClick={saveStock} disabled={saving} className={styles.saveBtn}>Uložit</button>
            <button onClick={() => setStockEdit(null)} className={styles.cancelBtn}>Zrušit</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Název</th>
              <th>Std Kč</th>
              <th>Sklad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tea) => (
              <tr key={tea.id}>
                <td>
                  {tea.name}
                  {tea.note && <span className={styles.note}> — {tea.note}</span>}
                </td>
                <td>{tea.std_price_moc ?? '—'}</td>
                <td className={styles.stock}>
                  {tea.stock_std_pcs > 0 && <span>{tea.stock_std_pcs} ks</span>}
                  {tea.stock_kg > 0 && <span>{tea.stock_kg} kg</span>}
                  {tea.stock_std_pcs === 0 && tea.stock_kg === 0 &&
                    <span className={styles.noStock}>0</span>}
                </td>
                <td>
                  <button onClick={() => openStockEdit(tea)} className={styles.editBtn}>
                    Sklad
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && filtered.length === 0 && (
        <p className={styles.noResults}>Žádné výsledky pro „{search}"</p>
      )}
    </div>
  )
}
