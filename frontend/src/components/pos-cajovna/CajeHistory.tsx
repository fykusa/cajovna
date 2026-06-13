import { useState, useEffect } from 'react'
import { getCajovnaProdeje } from '../../api/cajovna'
import type { CajovnaProdej } from '../../types'
import { useAuthStore } from '../../store/authStore'
import styles from './CajeHistory.module.css'

export default function CajeHistory() {
  const user = useAuthStore((s) => s.user)
  const [prodeje, setProdeje] = useState<CajovnaProdej[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    getCajovnaProdeje({ from: today + ' 00:00:00', to: today + ' 23:59:59' })
      .then((data) => setProdeje(user ? data.filter((p) => p.user_id === user.id) : data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  const total = prodeje.reduce((s, p) => s + p.total_kc, 0)
  const count = prodeje.length
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
          <div key={p.id} className={styles.sale}>
            <span className={styles.saleTime}>
              {new Date(p.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={styles.saleTotal}>{p.total_kc.toLocaleString('cs-CZ')} Kč</span>
          </div>
        ))}
      </div>
    </div>
  )
}
