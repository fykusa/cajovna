// frontend/src/components/pos-mobile/MobileSuccess.tsx
import styles from './MobileSuccess.module.css'

interface Props {
  total: number
  onNewSale: () => void
}

export default function MobileSuccess({ total, onNewSale }: Props) {
  const now = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className={styles.wrap}>
      <div className={styles.circle}>✓</div>
      <h2 className={styles.title}>Prodej zaúčtován</h2>
      <p className={styles.sub}>Platba přijata · {now}</p>
      <p className={styles.amount}>{total.toLocaleString('cs-CZ')} Kč</p>
      <button className={styles.btn} onClick={onNewSale}>Nový prodej</button>
    </div>
  )
}
