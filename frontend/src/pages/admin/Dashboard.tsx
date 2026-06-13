import { useEffect, useState, useCallback } from 'react'
import { getCajovnaProdeje, getCajovnaPolozky, getCajovnaKategorie } from '../../api/cajovna'
import { getUsers } from '../../api/users'
import type { CajovnaProdej, CajePolozkaSale, CajeCategory, User } from '../../types'
import { useToast } from '../../components/toast/useToast'
import ImportDialog from '../../components/admin/ImportDialog'
import RevenueChart from '../../components/admin/RevenueChart'
import { exportDatabase } from '../../api/admin'
import { bucketRevenue } from './revenueBuckets'
import { periodRange, PERIODS, type Period } from './periodRange'
import styles from './Dashboard.module.css'

const BALENI_LABELS: Record<number, string> = {
  1: 'Standard',
  2: 'Větší',
  3: 'Největší',
  4: 'Čajovna',
}

export default function AdminDashboard() {
  const initRange = periodRange('month')
  const [from, setFrom]                 = useState(initRange.from)
  const [to, setTo]                     = useState(initRange.to)
  const [activePeriod, setActivePeriod] = useState<Period | null>('month')
  const [sales, setSales]               = useState<CajovnaProdej[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedId, setSelectedId]     = useState<number | null>(null)
  const [items, setItems]               = useState<CajePolozkaSale[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [users, setUsers]               = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  const [kategorie, setKategorie]       = useState<CajeCategory[]>([])
  const [selectedKat, setSelectedKat]   = useState<CajeCategory | null>(null)
  const [showImport, setShowImport]     = useState(false)

  const toast = useToast()

  const load = useCallback(async (f: string, t: string, kat: CajeCategory | null = null) => {
    setLoading(true)
    setSelectedId(null)
    setItems([])
    try {
      setSales(await getCajovnaProdeje({
        from: f + ' 00:00:00',
        to: t + ' 23:59:59',
        ...(kat ? { kategorie: kat.kategorie, zeme: kat.zeme } : {}),
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load(from, to)
    getUsers().then((us) => {
      setUsers(us)
      setSelectedUsers(new Set(us.map((u) => u.id)))
    }).catch(() => {})
    getCajovnaKategorie().then(setKategorie).catch((e) => {
      toast.error('Filtry: ' + (e instanceof Error ? e.message : String(e)))
    })
  }, [])

  function selectPeriod(p: Period) {
    const range = periodRange(p)
    setFrom(range.from)
    setTo(range.to)
    setActivePeriod(p)
    load(range.from, range.to, selectedKat)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    load(from, to, selectedKat)
  }

  function toggleKat(k: CajeCategory) {
    const isSame = selectedKat?.kategorie === k.kategorie && selectedKat?.zeme === k.zeme
    const next = isSame ? null : k
    setSelectedKat(next)
    setSelectedId(null)
    setItems([])
    load(from, to, next)
  }

  async function selectSale(id: number) {
    setSelectedId(id)
    setItemsLoading(true)
    try {
      setItems(await getCajovnaPolozky(id))
    } catch {
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }

  function handleListKey(e: React.KeyboardEvent) {
    if (visibleSales.length === 0) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const idx = visibleSales.findIndex((s) => s.id === selectedId)
    let next: number
    if (e.key === 'ArrowDown') next = idx < visibleSales.length - 1 ? idx + 1 : idx
    else                       next = idx > 0 ? idx - 1 : 0
    selectSale(visibleSales[next].id)
    document.getElementById(`sale-${visibleSales[next].id}`)?.scrollIntoView({ block: 'nearest' })
  }

  function toggleUser(id: number) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
    setSelectedId(null)
    setItems([])
  }

  const allSelected = selectedUsers.size === users.length
  const visibleSales = allSelected
    ? sales
    : sales.filter((s) => selectedUsers.has(s.user_id))

  const total = visibleSales.reduce((s, sale) => s + sale.total_kc, 0)
  const selectedSale = visibleSales.find((s) => s.id === selectedId) ?? null
  const chartData = bucketRevenue(visibleSales, from, to)

  async function handleExport() {
    const csvRows: string[] = ['Datum;Čas;Uživatel;ID prodeje;Pořadí;Čaj;Balení;Kusů;Jedn. cena;Celk. cena']

    for (const sale of visibleSales) {
      let polozky: CajePolozkaSale[] = []
      try { polozky = await getCajovnaPolozky(sale.id) } catch { /* skip */ }
      const dt = new Date(sale.created_at)
      const date = dt.toLocaleString('cs-CZ', { year: 'numeric', month: '2-digit', day: '2-digit' })
      const time = dt.toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
      polozky.forEach((p, i) => {
        csvRows.push([
          date, time, sale.username, String(sale.id), String(i + 1),
          p.nazev ?? '',
          BALENI_LABELS[p.baleni] ?? String(p.baleni),
          String(p.kusu),
          String(p.jedn_cena),
          String(p.celk_cena),
        ].map((v) => `"${v}"`).join(';'))
      })
    }
    csvRows.push('')
    csvRows.push(['"","","","","","","","","CELKEM"', `"${Math.round(total)}"`].join(';'))

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const blob = new Blob([bom, new TextEncoder().encode(csvRows.join('\n'))], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `cajovna-export-${from}-${to}.csv`)
    link.click()
  }

  async function handleExportDb() {
    try {
      await exportDatabase()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export DB se nezdařil')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Přehled</h1>
        <div className={styles.periods}>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.periodBtn}${activePeriod === key ? ' ' + styles.active : ''}`}
              onClick={() => selectPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <form className={styles.rangeForm} onSubmit={handleSubmit}>
          <input
            type="date" value={from}
            onChange={(e) => { setFrom(e.target.value); setActivePeriod(null) }}
            className={styles.dateInput}
          />
          <span className={styles.rangeSep}>–</span>
          <input
            type="date" value={to}
            onChange={(e) => { setTo(e.target.value); setActivePeriod(null) }}
            className={styles.dateInput}
          />
          <button type="submit" className={styles.applyBtn}>Zobrazit</button>
          <button type="button" className={styles.exportBtn} onClick={handleExport}>Export CSV</button>
          <button type="button" className={styles.dbBtn} onClick={handleExportDb}>Export DB</button>
          <button type="button" className={styles.dbBtn} onClick={() => setShowImport(true)}>Import DB</button>
        </form>
      </div>

      {users.length > 0 && (
        <div className={styles.userFilter}>
          {users.map((u) => (
            <button
              key={u.id}
              className={`${styles.userBtn}${selectedUsers.has(u.id) ? ' ' + styles.userActive : ''}`}
              onClick={() => toggleUser(u.id)}
            >
              {u.username}
            </button>
          ))}
        </div>
      )}

      {kategorie.length > 0 && (
        <div className={styles.filterSection}>
          <label className={styles.filterLabel}>Kategorie</label>
          <div className={styles.filterGrid}>
            <button
              className={`${styles.filterBtn}${selectedKat === null ? ' ' + styles.filterActive : ''}`}
              onClick={() => { setSelectedKat(null); setSelectedId(null); setItems([]); load(from, to, null) }}
            >
              Vše
            </button>
            {kategorie.map((k) => {
              const label = k.zeme ? `${k.kategorie} — ${k.zeme}` : k.kategorie
              const isActive = selectedKat?.kategorie === k.kategorie && selectedKat?.zeme === k.zeme
              return (
                <button
                  key={`${k.kategorie}||${k.zeme ?? ''}`}
                  className={`${styles.filterBtn}${isActive ? ' ' + styles.filterActive : ''}`}
                  onClick={() => toggleKat(k)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Tržby</div>
              <div className={styles.statValue}>{Math.round(total).toLocaleString('cs-CZ')} Kč</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Prodejů</div>
              <div className={styles.statValue}>{visibleSales.length}</div>
            </div>
          </div>

          <div className={styles.panels}>
            <div className={styles.listPanel}>
              <div className={styles.panelTitle}>Prodeje</div>
              {visibleSales.length === 0 ? (
                <p className={styles.empty}>Za zvolené období žádné prodeje.</p>
              ) : (
                <ul className={styles.list} tabIndex={0} onKeyDown={handleListKey}>
                  {visibleSales.map((s) => (
                    <li
                      id={`sale-${s.id}`}
                      key={s.id}
                      className={`${styles.listItem}${selectedId === s.id ? ' ' + styles.selected : ''}`}
                      onClick={(e) => { selectSale(s.id); (e.currentTarget.closest('ul') as HTMLElement)?.focus() }}
                    >
                      <span className={styles.itemTime}>
                        {new Date(s.created_at).toLocaleString('cs-CZ', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </span>
                      <span className={styles.itemUser}>{s.username}</span>
                      <span className={styles.itemAmount}>{s.total_kc} Kč</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.detailPanel}>
              {!selectedSale ? (
                <div className={styles.detailEmpty}>← vyberte prodej</div>
              ) : (
                <>
                  <div className={styles.detailHeader}>
                    <span className={styles.detailId}>
                      #{selectedSale.id}&nbsp;·&nbsp;{selectedSale.username}&nbsp;·&nbsp;
                      {new Date(selectedSale.created_at).toLocaleString('cs-CZ', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                    <span className={styles.detailTotal}>{selectedSale.total_kc} Kč</span>
                  </div>
                  {itemsLoading ? (
                    <p className={styles.loading}>Načítám…</p>
                  ) : (
                    <ul className={styles.detailList}>
                      {items.map((p) => (
                        <li key={p.id} className={styles.detailRow}>
                          <span className={styles.detailQty}>{p.kusu}×</span>
                          <span className={styles.detailName}>
                            {p.nazev ?? `Čaj #${p.caje_id}`}
                            <span className={styles.detailCode}> ({BALENI_LABELS[p.baleni]})</span>
                          </span>
                          <span className={styles.detailPrices}>
                            <span className={styles.teaPrice}>{p.jedn_cena} Kč/ks</span>
                            <span className={styles.totalPrice}>{p.celk_cena} Kč</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className={styles.chartPanel}>
              <RevenueChart data={chartData} />
            </div>
          </div>
        </>
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onDone={() => load(from, to)}
        />
      )}
    </div>
  )
}
