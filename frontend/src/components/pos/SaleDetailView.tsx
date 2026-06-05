// frontend/src/components/pos/SaleDetailView.tsx
import type { Sale, SaleItem } from '../../types'
import styles from './SaleDetailView.module.css'

interface Props {
  sale: Sale | null
  items: SaleItem[]
}

export default function SaleDetailView({ sale, items }: Props) {
  if (!sale) {
    return (
      <div className={styles.empty}>
        <p>Prodej je prázdný</p>
      </div>
    )
  }

  const time = new Date(sale.created_at).toLocaleString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.time}>{time}</span>
          <span className={styles.user}>{sale.username}</span>
        </div>
        <div className={styles.total}>{Math.round(sale.total_amount)} Kč</div>
      </div>

      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.name}>{item.tea_name || 'Pytlík'}</span>
              <span className={styles.qty}>×{item.quantity}</span>
              <span className={styles.price}>{item.unit_price} Kč</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
