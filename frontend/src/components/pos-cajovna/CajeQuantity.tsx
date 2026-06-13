import type { CajeBaleni } from '../../types'
import styles from './CajeQuantity.module.css'

const QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]

interface Props {
  baleni: CajeBaleni
  onSelect: (n: number) => void
}

export default function CajeQuantity({ baleni, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <p className={styles.hint}>{baleni.label} · {baleni.mn} g · {baleni.cena} Kč/ks</p>
      <div className={styles.grid}>
        {QUANTITIES.map((n) => (
          <button key={n} className={styles.btn} onClick={() => onSelect(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
