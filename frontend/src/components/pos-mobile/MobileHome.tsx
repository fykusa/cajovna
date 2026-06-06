// frontend/src/components/pos-mobile/MobileHome.tsx
import type { CartItem } from '../../types'
import { bagLineTotal, cartTotal } from '../pos/cartTotals'
import styles from './MobileHome.module.css'

interface Props {
  cart: CartItem[]
  onAddItem: () => void
  onCheckout: () => void
  onRemove: (localId: string) => void
}

function packagingLabel(item: CartItem): string {
  switch (item.itemType) {
    case 'std':  return `std${item.tea.std_weight_g != null ? ` ${item.tea.std_weight_g}g` : ''}`
    case 'pkg1': return `1bal${item.tea.pkg1_weight_g != null ? ` ${item.tea.pkg1_weight_g}g` : ''}`
    case 'pkg2': return `2bal${item.tea.pkg2_weight_g != null ? ` ${item.tea.pkg2_weight_g}g` : ''}`
    default: return 'syp'
  }
}

export default function MobileHome({ cart, onAddItem, onCheckout, onRemove }: Props) {
  const total = cartTotal(cart)

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
                  <span className={styles.itemName}>{item.tea.name}</span>
                  <span className={styles.itemDetail}>
                    {item.quantity}× · {packagingLabel(item)} · {item.unitPrice} Kč/ks
                  </span>
                  {item.bag && (
                    <span className={styles.itemBag}>
                      ↳ {item.bag.surface_type} {item.bag.volume_ml} ml · {bagLineTotal(item)} Kč
                    </span>
                  )}
                </div>
                <span className={styles.itemPrice}>{item.totalPrice + bagLineTotal(item)} Kč</span>
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
