import { useState, useEffect } from 'react'
import type { CartItem, SalePayload } from '../../types'
import { createSale } from '../../api/sales'
import { cartTotal } from './cartTotals'
import styles from './CheckoutDialog.module.css'

interface Props {
  items: CartItem[]
  onSuccess: () => void
  onCancel: () => void
}

export default function CheckoutDialog({ items, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedBtn, setFocusedBtn] = useState<'pay' | 'cancel'>('pay')

  const total = cartTotal(items)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (loading) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); setFocusedBtn('cancel') }
      if (e.key === 'ArrowRight') { e.preventDefault(); setFocusedBtn('pay') }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (focusedBtn === 'pay') handlePay()
        else onCancel()
      }
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [loading, focusedBtn])

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const payload: SalePayload = {
        items: items.flatMap((item) => {
          const rows: SalePayload['items'] = [{
            tea_id: item.tea.id,
            bag_id: null,
            item_type: item.itemType,
            weight_g: item.weightG,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
            note: null,
          }]
          if (item.bag) {
            rows.push({
              tea_id: null,
              bag_id: item.bag.id,
              item_type: 'bag',
              weight_g: null,
              quantity: item.quantity,
              unit_price: item.bag.price_per_piece,
              total_price: item.bag.price_per_piece * item.quantity,
              note: null,
            })
          }
          return rows
        }),
        note: null,
      }
      await createSale(payload)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>Souhrn prodeje</h2>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.localId} className={styles.row}>
              <span className={styles.itemName}>{item.tea.name}</span>
              <span className={styles.qty}>×{item.quantity}</span>
              <span className={styles.price}>{item.unitPrice} Kč</span>
            </li>
          ))}
        </ul>
        <p className={styles.total}>{`Celkem: ${Math.round(total)} Kč`}</p>
        <div className={styles.actions}>
          <button
            onClick={onCancel}
            className={`${styles.cancelBtn} ${focusedBtn === 'cancel' ? styles.focused : ''}`}
            disabled={loading}
          >
            Zrušit
          </button>
          <button
            onClick={handlePay}
            className={`${styles.payBtn} ${focusedBtn === 'pay' ? styles.focused : ''}`}
            disabled={loading}
          >
            {loading ? 'Odesílám…' : 'Zaplatit'}
          </button>
        </div>
      </div>
    </div>
  )
}
