import type { CajeCartItem } from '../../types'
import styles from './CajeHome.module.css'

interface Props {
  cart: CajeCartItem[]
  onAddItem: () => void
  onCheckout: () => void
  onRemove: (localId: string) => void
}

export default function CajeHome({ cart, onAddItem, onCheckout, onRemove }: Props) {
  const total = cart.reduce((s, i) => s + i.celkCena, 0)

  return (
    <>
      <div className={styles.scroll}>
        {cart.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyChar}>茶</span>
            <p>Košík je prázdný. Přidejte první položku.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {cart.map((item) => (
              <li key={item.localId} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.caj.NAZEV}</span>
                  <span className={styles.itemDetail}>
                    {item.kusu}× · {item.baleni.label} {item.baleni.mn}g · {item.baleni.cena} Kč/ks
                  </span>
                </div>
                <span className={styles.itemPrice}>{item.celkCena} Kč</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => onRemove(item.localId)}
                  aria-label="Odstranit"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <div className={styles.totalRow}>
          <span>Celkem</span>
          <span className={styles.totalAmt}>{total.toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.addBtn} onClick={onAddItem}>+ Přidat položku</button>
        {cart.length > 0 && (
          <button className={styles.checkoutBtn} onClick={onCheckout}>
            Zaúčtovat prodej →
          </button>
        )}
      </div>
    </>
  )
}
