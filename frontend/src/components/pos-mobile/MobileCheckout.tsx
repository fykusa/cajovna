// frontend/src/components/pos-mobile/MobileCheckout.tsx
import type { CartItem } from '../../types'
import { cartTotal } from '../pos/cartTotals'
import styles from './MobileCheckout.module.css'

interface Props {
  cart: CartItem[]
  error: string | null
  loading?: boolean
  onConfirm: () => void
  onBack: () => void
}

export default function MobileCheckout({ cart, error, loading, onConfirm, onBack }: Props) {
  const total = cartTotal(cart)
  return (
    <>
      <div className={styles.scroll}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <ul className={styles.list}>
          {cart.map((item) => (
            <li key={item.localId} className={styles.row}>
              <span className={styles.name}>{item.tea.name}</span>
              <span className={styles.qty}>×{item.quantity}</span>
              <span className={styles.price}>{item.totalPrice} Kč</span>
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
