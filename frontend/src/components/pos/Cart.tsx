// frontend/src/components/pos/Cart.tsx
import { CartItem } from '../../types'
import styles from './Cart.module.css'

interface Props {
  items: CartItem[]
  onRemove: (localId: string) => void
  onCheckout: () => void
}

export default function Cart({ items, onRemove, onCheckout }: Props) {
  const total = items.reduce((sum, i) => sum + i.totalPrice, 0)

  return (
    <div className={styles.cart}>
      <h2 className={styles.title}>Košík</h2>
      {items.length === 0 ? (
        <p className={styles.empty}>Košík je prázdný</p>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.localId} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.name}>{item.tea.name}</span>
                  <span className={styles.qty}>×{item.quantity}</span>
                  <span className={styles.price}>{item.totalPrice} Kč</span>
                  <button
                    className={styles.remove}
                    onClick={() => onRemove(item.localId)}
                    aria-label="smazat"
                  >
                    ×
                  </button>
                </div>
                {item.bag && (
                  <div className={styles.bag}>
                    {item.bag.surface_type} {item.bag.volume_ml} ml
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.footer}>
            <strong className={styles.total}>{Math.round(total)} Kč</strong>
            <button className={styles.checkoutBtn} onClick={onCheckout}>
              Zaplatit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
