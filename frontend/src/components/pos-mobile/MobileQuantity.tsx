// frontend/src/components/pos-mobile/MobileQuantity.tsx
import { QUANTITY_OPTIONS } from '../../hooks/useMobilePOS'
import type { PackagingOption } from '../../hooks/posHelpers'
import styles from './MobileQuantity.module.css'

interface Props {
  packaging: PackagingOption
  onSelect: (n: number) => void
}

export default function MobileQuantity({ packaging, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {QUANTITY_OPTIONS.map((n) => (
          <button key={n} className={styles.btn} onClick={() => onSelect(n)}>
            <span className={styles.num}>{n}</span>
            <span className={styles.unit}>ks</span>
            <span className={styles.price}>{(packaging.price * n).toLocaleString('cs-CZ')} Kč</span>
          </button>
        ))}
      </div>
    </div>
  )
}
