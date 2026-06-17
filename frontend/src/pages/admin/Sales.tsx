import { useEffect, useState } from 'react'
import type { CajovnaProdej } from '../../types'
import { getCajovnaProdeje, cancelCajovnaSale } from '../../api/cajovna'
import { useToast } from '../../components/toast/useToast'
import { periodRange, PERIODS, type Period } from './periodRange'
import HBarChart from '../../components/admin/HBarChart'
import { fmtKc } from './format'
import styles from './Sales.module.css'

// Pivot: klíč období (den/měsíc) → { prodavající → součet tržeb }.
function pivotByKey(sales: CajovnaProdej[], keyFn: (s: CajovnaProdej) => string): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>()
  for (const s of sales) {
    const key = keyFn(s)
    const row = map.get(key) ?? {}
    row[s.username] = (row[s.username] ?? 0) + s.total_kc
    map.set(key, row)
  }
  return map
}

// „2026-06" → „Červen 2026"
function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleString('cs-CZ', { month: 'long' })
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

export default function Sales() {
  const initRange = periodRange('month')
  const [from, setFrom] = useState(initRange.from)
  const [to, setTo] = useState(initRange.to)
  const [activePeriod, setActivePeriod] = useState<Period | null>('month')
  const [sales, setSales] = useState<CajovnaProdej[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const toast = useToast()

  async function load(f = from, t = to) {
    setLoading(true)
    try {
      const data = await getCajovnaProdeje({ from: f + ' 00:00:00', to: t + ' 23:59:59' })
      setSales(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(id: number) {
    setCancelling(true)
    try {
      await cancelCajovnaSale(id)
      setConfirmId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba při stornování')
    } finally {
      setCancelling(false)
    }
  }

  useEffect(() => { load() }, [])

  function selectPeriod(p: Period) {
    const range = periodRange(p)
    setFrom(range.from)
    setTo(range.to)
    setActivePeriod(p)
    load(range.from, range.to)
  }

  const activeSales = sales.filter((s) => !s.cancelled_at)

  const total = activeSales.reduce((s, sale) => s + sale.total_kc, 0)

  const perUser: Record<string, number> = {}
  activeSales.forEach((s) => {
    perUser[s.username] = (perUser[s.username] ?? 0) + s.total_kc
  })

  // Prodavající seřazení dle celkové tržby (sloupce pivotu i řádky souhrnu).
  const sellerTotals = Object.entries(perUser).sort((a, b) => b[1] - a[1])
  const sellers = sellerTotals.map(([name]) => name)

  // Pivoty den/měsíc (klíč z created_at „YYYY-MM-DD HH:MM:SS"), sestupně
  // (nejnovější nahoře). Měsíční pivot odpovídá filtru — klidně i jen 1 měsíc.
  const byDay = pivotByKey(activeSales, (s) => s.created_at.slice(0, 10))
  const days = Array.from(byDay.keys()).sort().reverse()
  const byMonth = pivotByKey(activeSales, (s) => s.created_at.slice(0, 7))
  const months = Array.from(byMonth.keys()).sort().reverse()

  // Pivot tabulka období × prodavající (sdílená pro denní i měsíční pohled).
  const pivotBlock = (
    title: string,
    firstCol: string,
    rowKeys: string[],
    byKey: Map<string, Record<string, number>>,
    labelFn: (k: string) => string,
  ) => (
    <div className={styles.summaryBlock}>
      <h3 className={styles.summaryTitle}>{title}</h3>
      <table className={styles.table} aria-label={title}>
        <thead>
          <tr>
            <th>{firstCol}</th>
            {sellers.map((name) => (
              <th key={name} style={{ textAlign: 'right' }}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((key) => {
            const row = byKey.get(key)!
            return (
              <tr key={key}>
                <td className={styles.time}>{labelFn(key)}</td>
                {sellers.map((name) => (
                  <td key={name} className={styles.amount}>
                    {row[name] ? fmtKc(row[name]) : '–'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <h1 className={styles.title}>Tržby</h1>

      <form onSubmit={(e) => { e.preventDefault(); load() }} className={styles.filter}>
        <div className={styles.periods}>
          {PERIODS.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              className={`${styles.periodBtn}${activePeriod === key ? ' ' + styles.active : ''}`}
              onClick={() => selectPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.dateRow}>
          <label>
            Od: <input aria-label="od" type="date" value={from}
              onChange={(e) => { setFrom(e.target.value); setActivePeriod(null) }} className={styles.dateInput} />
          </label>
          <label>
            Do: <input aria-label="do" type="date" value={to}
              onChange={(e) => { setTo(e.target.value); setActivePeriod(null) }} className={styles.dateInput} />
          </label>
          <button type="submit" className={styles.filterBtn}>Zobrazit</button>
        </div>
      </form>


      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Celkové tržby</div>
              <div className={styles.statValue}>{fmtKc(total)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Počet prodejů</div>
              <div className={styles.statValue}>{activeSales.length}</div>
            </div>
          </div>

          {sellers.length > 0 && (
            <div className={styles.summaryRow}>
              {pivotBlock('Denní tržby přes prodavající', 'Den', days, byDay,
                (k) => `${k.slice(8, 10)}.${k.slice(5, 7)}`)}

              {pivotBlock('Měsíční tržby přes prodavající', 'Měsíc', months, byMonth, monthLabel)}

              <div className={`${styles.summaryBlock} ${styles.summaryTotals}`}>
                <h3 className={styles.summaryTitle}>Celkové tržby za prodavajícího</h3>
                <table className={styles.table} aria-label="Celkové tržby za prodavajícího">
                  <thead>
                    <tr>
                      <th>Prodavající</th>
                      <th style={{ textAlign: 'right' }}>Tržba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerTotals.map(([name, amount]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td className={styles.amount}>{fmtKc(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.chartBlock}>
                <h3 className={styles.summaryTitle}>Tržby graficky</h3>
                <HBarChart
                  data={sellerTotals.map(([name, amount]) => ({ label: name, value: amount }))}
                />
              </div>
            </div>
          )}

          {sellers.length === 0 && (
            <p className={styles.empty}>Za zvolené období žádné prodeje.</p>
          )}

          <div style={{ marginTop: 32 }}>
            <h2 className={styles.sectionTitle}>Přehled prodejů</h2>
            <table className={styles.table} aria-label="Přehled prodejů">
              <thead>
                <tr>
                  <th>Datum a čas</th>
                  <th>Prodavačka</th>
                  <th style={{ textAlign: 'right' }}>Částka</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className={s.cancelled_at ? styles.cancelled : undefined}>
                    <td className={styles.time}>{s.created_at.slice(0, 16)}</td>
                    <td>{s.username}</td>
                    <td className={styles.amount}>{fmtKc(s.total_kc)}</td>
                    <td>
                      {s.cancelled_at ? (
                        <span className={styles.stornoBadge}>STORNO</span>
                      ) : (
                        <button className={styles.stornoBtn} onClick={() => setConfirmId(s.id)}>
                          Stornovat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirmId !== null && (
            <div className={styles.confirmOverlay}>
              <div className={styles.confirmBox}>
                <p>Opravdu stornovat prodej #{confirmId}? Tato akce je nevratná.</p>
                <div className={styles.confirmActions}>
                  <button className={styles.confirmBtn} disabled={cancelling} onClick={() => handleCancel(confirmId)}>
                    {cancelling ? 'Stornuji…' : 'Potvrdit'}
                  </button>
                  <button className={styles.confirmCancelBtn} disabled={cancelling} onClick={() => setConfirmId(null)}>
                    Zrušit
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
