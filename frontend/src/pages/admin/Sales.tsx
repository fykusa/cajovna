import { useEffect, useState } from 'react'
import type { Sale } from '../../types'
import { getSales } from '../../api/sales'
import { useToast } from '../../components/toast/useToast'
import styles from './Sales.module.css'

export default function Sales() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await getSales({ from: from + ' 00:00:00', to: to + ' 23:59:59' })
      setSales(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = sales.reduce((s, sale) => s + Number(sale.total_amount), 0)

  const perUser: Record<string, number> = {}
  sales.forEach((s) => {
    perUser[s.username] = (perUser[s.username] ?? 0) + Number(s.total_amount)
  })

  return (
    <div>
      <h1 className={styles.title}>Tržby</h1>

      <form onSubmit={(e) => { e.preventDefault(); load() }} className={styles.filter}>
        <label>
          Od: <input aria-label="od" type="date" value={from}
            onChange={(e) => setFrom(e.target.value)} className={styles.dateInput} />
        </label>
        <label>
          Do: <input aria-label="do" type="date" value={to}
            onChange={(e) => setTo(e.target.value)} className={styles.dateInput} />
        </label>
        <button type="submit" className={styles.filterBtn}>Zobrazit</button>
      </form>


      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Celkové tržby</div>
              <div className={styles.statValue}>{Math.round(total)} Kč</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Počet prodejů</div>
              <div className={styles.statValue}>{sales.length}</div>
            </div>
          </div>

          {Object.keys(perUser).length > 0 && (
            <div className={styles.perUser}>
              <h3>Tržby per prodavačka</h3>
              <div className={styles.perUserList}>
                {Object.entries(perUser)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, amount]) => (
                    <span key={name} className={styles.perUserItem}>
                      {name}: <strong>{Math.round(amount)} Kč</strong>
                    </span>
                  ))}
              </div>
            </div>
          )}

          <h2 className={styles.sectionTitle}>Prodeje ({sales.length})</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Čas</th>
                <th>Prodavačka</th>
                <th style={{ textAlign: 'right' }}>Částka</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={s.id}>
                  <td className={styles.time}>
                    {new Date(s.created_at).toLocaleString('cs-CZ', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>{i === 0 || sales[i - 1].username !== s.username ? s.username : ''}</td>
                  <td className={styles.amount}>{Math.round(Number(s.total_amount))} Kč</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <p className={styles.empty}>Za zvolené období žádné prodeje.</p>
          )}
        </>
      )}
    </div>
  )
}
