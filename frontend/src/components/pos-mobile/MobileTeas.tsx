// frontend/src/components/pos-mobile/MobileTeas.tsx
import type { Tea } from '../../types'
import styles from './MobileTeas.module.css'

interface Props {
  teas: Tea[]
  categoryName: string
  onSelect: (tea: Tea) => void
}

export default function MobileTeas({ teas, categoryName, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      {teas.length === 0 && (
        <p className={styles.empty}>Žádné čaje v kategorii {categoryName}.</p>
      )}
      <ul className={styles.list}>
        {teas.map((tea) => (
          <li key={tea.id}>
            <button className={styles.row} onClick={() => onSelect(tea)}>
              <div className={styles.info}>
                <span className={styles.name}>{tea.name}</span>
                {tea.note && <span className={styles.note}>{tea.note}</span>}
              </div>
              {tea.std_price_moc != null && (
                <span className={styles.price}>{tea.std_price_moc} Kč</span>
              )}
              <span className={styles.arrow}>›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
