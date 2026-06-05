import type { Sale } from '../../types'
import styles from './SalesSummary.module.css'

interface Props {
  sales: Sale[]
  currentUsername: string
  variant?: 'card' | 'compact'
}

export default function SalesSummary({ sales, currentUsername, variant = 'card' }: Props) {
  const mySales = sales.filter((s) => s.username === currentUsername)
  const totalAmount = mySales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0)

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        <span>{mySales.length} prodejů</span>
        <span>{totalAmount.toLocaleString('cs-CZ')} Kč</span>
      </div>
    )
  }

  return (
    <div className={styles.summary}>
      <div className={styles.card}>
        <div className={styles.label}>Počet prodejů</div>
        <div className={styles.value}>{mySales.length}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>Celkem prodáno</div>
        <div className={styles.value}>{totalAmount.toLocaleString('cs-CZ')} Kč</div>
      </div>
    </div>
  )
}
