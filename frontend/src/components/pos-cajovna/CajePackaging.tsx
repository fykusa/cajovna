import type { CajeBaleni } from '../../types'
import styles from './CajePackaging.module.css'

interface Props {
  options: CajeBaleni[]
  selected: CajeBaleni | null
  onSelect: (b: CajeBaleni) => void
}

export default function CajePackaging({ options, selected, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <ul className={styles.list}>
        {options.map((b) => (
          <li key={b.cislo}>
            <button
              className={`${styles.row} ${selected?.cislo === b.cislo ? styles.active : ''}`}
              onClick={() => onSelect(b)}
            >
              <div className={styles.info}>
                <span className={styles.label}>{b.label}</span>
                <span className={styles.weight}>{b.mn} g</span>
              </div>
              <span className={styles.price}>{b.cena} Kč</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
