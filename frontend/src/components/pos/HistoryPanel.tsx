// frontend/src/components/pos/HistoryPanel.tsx
import type { Sale } from '../../types'
import styles from './HistoryPanel.module.css'

interface Props {
  sales: Sale[]
  selectedIndex: number
  onSelect: (sale: Sale, index: number) => void
  isActive: boolean
}

export default function HistoryPanel({
  sales,
  selectedIndex,
  onSelect,
  isActive,
}: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.list}>
        {sales.map((sale, idx) => (
          <div
            key={sale.id}
            data-testid="history-item"
            className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}
            onClick={() => onSelect(sale, idx)}
          >
            <div className={styles.itemMain}>
              <span className={styles.amount}>{Math.round(sale.total_amount)} Kč</span>
              <span className={styles.time}>
                {new Date(sale.created_at).toLocaleTimeString('cs-CZ', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className={styles.itemMeta}>
              <span className={styles.user}>{sale.username}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
