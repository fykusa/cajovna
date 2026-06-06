// frontend/src/components/pos-mobile/MobileHistory.tsx
import { useState, useEffect } from 'react'
import { getSales, getSaleItems } from '../../api/sales'
import type { Sale, SaleItem } from '../../types'
import styles from './MobileHistory.module.css'

interface SaleWithItems extends Sale {
  items: SaleItem[]
}

export default function MobileHistory() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    setLoading(true)
    setError(null)
    getSales({ from: today, to: `${today} 23:59:59` })
      .then((raw) => {
        const sorted = [...raw].sort((a, b) => b.id - a.id)
        return Promise.all(
          sorted.map((s) => getSaleItems(s.id).then((items) => ({ ...s, items })))
        )
      })
      .then(setSales)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  const totalAmount = sales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const count = sales.length
  const countLabel = count === 1 ? 'prodej' : count < 5 ? 'prodeje' : 'prodejů'

  if (loading) return <div className={styles.state}>Načítám…</div>
  if (error) return <div className={styles.state}>Chyba: {error}</div>
  if (sales.length === 0) return <div className={styles.state}>Dnes zatím žádné prodeje.</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        {count} {countLabel} · celkem {totalAmount.toLocaleString('cs-CZ')} Kč
      </div>
      <div className={styles.list}>
        {sales.map((sale) => (
          <div key={sale.id} className={styles.sale}>
            <div className={styles.saleHead}>
              <span className={styles.saleTime}>
                {new Date(sale.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={styles.saleUser}>{sale.username}</span>
              <span className={styles.saleTotal}>
                {Number(sale.total_amount).toLocaleString('cs-CZ')} Kč
              </span>
            </div>
            <div className={styles.items}>
              {sale.items.map((item) => (
                <div key={item.id} className={styles.item}>
                  {item.item_type === 'bag'
                    ? `↳ ${item.surface_type} ${item.volume_ml} ml · ${item.quantity} ks · ${Number(item.total_price).toLocaleString('cs-CZ')} Kč`
                    : `${item.tea_name} · ${item.quantity} ks · ${Number(item.total_price).toLocaleString('cs-CZ')} Kč`
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
