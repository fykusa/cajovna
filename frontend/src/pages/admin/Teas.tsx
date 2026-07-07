import { useEffect, useState, useCallback } from 'react'
import { getTeas } from '../../api/teas'
import type { TeaRow } from '../../types'
import { useToast } from '../../components/toast/useToast'
import { syncFromSheets } from '../../api/admin'
import styles from './Items.module.css'
import gridStyles from '../../components/admin/EditableGrid.module.css'

export default function AdminTeas() {
  const [rows, setRows] = useState<TeaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [kategorieFilter, setKategorieFilter] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getTeas())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncFromSheets()
      toast.success(`Sync hotový — ${result.synced} položek (${result.vyrazeno} vyřazeno)`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync se nezdařil')
    } finally {
      setSyncing(false)
    }
  }

  const categories = Array.from(new Set(rows.map((r) => r.KATEGORIE).filter(Boolean))) as string[]
  categories.sort()

  const nameQuery = nameFilter.trim().toLowerCase()
  const visible = rows
    .filter((r) => showInactive ? r.AKTIV !== 'x' : r.AKTIV === 'x')
    .filter((r) => kategorieFilter === null || r.KATEGORIE === kategorieFilter)
    .filter((r) => nameQuery === '' || (r.NAZEV ?? '').toLowerCase().includes(nameQuery))

  const fmt = (v: number | null) => (v == null ? '' : String(v))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>TEAs — import ze Sheets</h1>
        <input
          className={styles.nameFilter}
          placeholder="Hledat název…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setKategorieFilter(null) }}
          />
          Zobrazit neaktivní
        </label>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{ marginLeft: 'auto', padding: '6px 14px', background: '#4a90d9', color: '#fff',
                   border: 'none', borderRadius: 4, cursor: syncing ? 'not-allowed' : 'pointer',
                   opacity: syncing ? 0.6 : 1, fontSize: '0.9rem' }}
        >
          {syncing ? 'Synchronizuji…' : '↻ Sync ze Sheets'}
        </button>
        <span style={{ color: '#666', fontSize: '0.85rem' }}>
          {visible.length} záznamů
        </span>
      </div>

      {categories.length > 0 && (
        <div className={styles.filterSection}>
          <span className={styles.filterLabel}>Kategorie</span>
          <div className={styles.filterGrid}>
            <button
              className={`${styles.filterBtn} ${kategorieFilter === null ? styles.filterActive : ''}`}
              onClick={() => setKategorieFilter(null)}
            >
              Vše
            </button>
            {categories.map((k) => (
              <button
                key={k}
                className={`${styles.filterBtn} ${kategorieFilter === k ? styles.filterActive : ''}`}
                onClick={() => setKategorieFilter(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Načítám…</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            {rows.length === 0 ? 'Tabulka je prázdná — data se načtou po synchronizaci ze Sheets.' : 'Žádné záznamy.'}
          </div>
        ) : (
          <table className={gridStyles.table}>
            <thead>
              <tr>
                <th colSpan={6} style={{ borderRight: '2px solid #444' }}>Základní info</th>
                <th colSpan={2} style={{ borderRight: '2px solid #444' }}>Standard</th>
                <th colSpan={2} style={{ borderRight: '2px solid #444' }}>Větší</th>
                <th colSpan={2} style={{ borderRight: '2px solid #444' }}>Největší</th>
                <th colSpan={2}>Čajovna</th>
              </tr>
              <tr>
                <th>Kód</th>
                <th>Kategorie</th>
                <th>Země</th>
                <th>Aktiv</th>
                <th>Název</th>
                <th style={{ borderRight: '2px solid #444' }}>Poznámka</th>
                <th>g</th>
                <th style={{ borderRight: '2px solid #444' }}>Kč</th>
                <th>g</th>
                <th style={{ borderRight: '2px solid #444' }}>Kč</th>
                <th>g</th>
                <th style={{ borderRight: '2px solid #444' }}>Kč</th>
                <th>g</th>
                <th>Kč</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.AKTIV !== 'x' ? styles.rowInactive : undefined}>
                  <td>{r.KOD}</td>
                  <td>{r.KATEGORIE}</td>
                  <td>{r.ZEME}</td>
                  <td>{r.AKTIV}</td>
                  <td>{r.NAZEV}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{r.POZNAMKA}</td>
                  <td>{fmt(r.MN1)}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{fmt(r.CENA1)}</td>
                  <td>{fmt(r.MN2)}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{fmt(r.CENA2)}</td>
                  <td>{fmt(r.MN3)}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{fmt(r.CENA3)}</td>
                  <td>{fmt(r.MN4)}</td>
                  <td>{fmt(r.CENA4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
