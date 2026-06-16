import { useState, useEffect } from 'react'
import { getKasaStatus } from '../../api/kasa'
import type { KasaStatus } from '../../types'
import styles from './CajeKasa.module.css'

const fmtKc = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

export default function CajeKasa() {
  const [status, setStatus] = useState<KasaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getKasaStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.state}>Načítám…</div>
  if (error)   return <div className={styles.state}>Chyba: {error}</div>
  if (!status) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.label}>Uzávěrka předchozí den</div>
          <div className={styles.value}>
            {status.last_closing ? fmtKc(status.last_closing.confirmed_balance) : '—'}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.label}>Tržby dnes</div>
          <div className={styles.value}>{fmtKc(status.trzby_dnes)}</div>
        </div>
        <div className={`${styles.stat} ${styles.statTotal}`}>
          <div className={styles.label}>Aktuální stav kasy</div>
          <div className={styles.value}>
            {status.stav_kasy !== null
              ? fmtKc(status.stav_kasy)
              : `— + ${fmtKc(status.trzby_dnes + status.pohyby_dnes)}`}
          </div>
        </div>
      </div>

      {status.movements.length > 0 && (
        <div className={styles.movements}>
          <div className={styles.movTitle}>Pohyby dnes</div>
          {status.movements.map((m) => (
            <div key={m.id} className={styles.movement}>
              <span className={styles.movTime}>
                {new Date(m.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`${styles.movAmount} ${m.amount >= 0 ? styles.pos : styles.neg}`}>
                {m.amount >= 0 ? '+' : ''}{fmtKc(m.amount)}
              </span>
              <span className={styles.movNote}>{m.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
