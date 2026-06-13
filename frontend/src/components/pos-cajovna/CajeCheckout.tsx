import type { CajeCartItem } from '../../types'
import styles from './CajeCheckout.module.css'

interface Props {
  cart: CajeCartItem[]
  error: string | null
  loading?: boolean
  onConfirm: () => void
  onBack: () => void
}

export default function CajeCheckout({ cart, error, loading, onConfirm, onBack }: Props) {
  const total = cart.reduce((s, i) => s + i.celkCena, 0)

  return (
    <>
      <div className={styles.scroll}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <ul className={styles.list}>
          {cart.map((item) => (
            <li key={item.localId} className={styles.row}>
              <span className={styles.name}>{item.caj.NAZEV}</span>
              <span className={styles.qty}>×{item.kusu}</span>
              <span className={styles.price}>{item.celkCena} Kč</span>
            </li>
          ))}
        </ul>
        <div className={styles.totalRow}>
          <span>K zaplacení</span>
          <span className={styles.totalAmt}>{total.toLocaleString('cs-CZ')} Kč</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={onBack} disabled={loading}>
          Zpět na košík
        </button>
        <button className={styles.payBtn} onClick={onConfirm} disabled={loading}>
          {loading ? 'Ukládám…' : '✓ Zákazník zaplatil'}
        </button>
      </div>
    </>
  )
}
