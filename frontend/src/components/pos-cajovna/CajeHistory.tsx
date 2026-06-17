import { useState, useEffect } from 'react'
import { getCajovnaProdeje, getCajovnaPolozky, cancelCajovnaSale } from '../../api/cajovna'
import type { CajovnaProdej, CajePolozkaSale } from '../../types'
import { useAuthStore } from '../../store/authStore'
import styles from './CajeHistory.module.css'

const BALENI: Record<number, string> = { 1: 'Standard', 2: 'Větší', 3: 'Největší', 4: 'Čajovna' }

export default function CajeHistory() {
  const user = useAuthStore((s) => s.user)
  const [prodeje, setProdeje]         = useState<CajovnaProdej[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [items, setItems]             = useState<CajePolozkaSale[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [cancelling, setCancelling]     = useState(false)

  function loadProdeje() {
    const today = new Date().toISOString().slice(0, 10)
    return getCajovnaProdeje({ from: today + ' 00:00:00', to: today + ' 23:59:59' })
      .then((data) => setProdeje(user ? data.filter((p) => p.user_id === user.id) : data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProdeje() }, [])

  async function toggleSale(id: number) {
    if (selectedId === id) { setSelectedId(null); setItems([]); return }
    setSelectedId(id)
    setItems([])
    setItemsLoading(true)
    try { setItems(await getCajovnaPolozky(id)) } catch { /* tiché */ }
    finally { setItemsLoading(false) }
  }

  async function handleCancel(id: number) {
    setCancelling(true)
    try {
      await cancelCajovnaSale(id)
      setSelectedId(null)
      setItems([])
      await loadProdeje()
    } finally {
      setCancelling(false)
    }
  }

  const activeProdeje = prodeje.filter((p) => !p.cancelled_at)
  const total = activeProdeje.reduce((s, p) => s + p.total_kc, 0)
  const count = activeProdeje.length
  const countLabel = count === 1 ? 'prodej' : count < 5 ? 'prodeje' : 'prodejů'

  if (loading) return <div className={styles.state}>Načítám…</div>
  if (error)   return <div className={styles.state}>Chyba: {error}</div>
  if (count === 0) return <div className={styles.state}>Zatím žádné prodeje.</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        {count} {countLabel} · celkem {total.toLocaleString('cs-CZ')} Kč
      </div>
      <div className={styles.list}>
        {prodeje.map((p) => (
          <div key={p.id}>
            <div
              className={`${styles.sale}${selectedId === p.id ? ' ' + styles.saleSelected : ''}${p.cancelled_at ? ' ' + styles.saleCancelled : ''}`}
              onClick={() => toggleSale(p.id)}
            >
              <span className={styles.saleTime}>
                {new Date(p.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {p.cancelled_at
                ? <span className={styles.stornoBadge}>STORNO</span>
                : <span className={styles.saleTotal}>{p.total_kc.toLocaleString('cs-CZ')} Kč</span>
              }
            </div>
            {selectedId === p.id && (
              <div className={styles.items}>
                {itemsLoading
                  ? <div className={styles.itemsLoading}>Načítám…</div>
                  : items.map((it) => (
                    <div key={it.id} className={styles.item}>
                      <span className={styles.itemQty}>{it.kusu}×</span>
                      <span className={styles.itemName}>
                        {it.nazev ?? `Čaj #${it.caje_id}`}
                        <span className={styles.itemBaleni}> · {BALENI[it.baleni]}</span>
                      </span>
                      <span className={styles.itemPrice}>{it.celk_cena.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                  ))
                }
                {!p.cancelled_at && (
                  <button
                    className={styles.stornoBtn}
                    disabled={cancelling}
                    onClick={(e) => { e.stopPropagation(); handleCancel(p.id) }}
                  >
                    {cancelling ? 'Stornuji…' : 'Stornovat tento prodej'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
