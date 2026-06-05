import type { Tea } from '../../types'
import styles from './TeaPanel.module.css'

interface Props {
  teas: Tea[]
  selectedIndex: number
  isActive: boolean
  isFilterActive: boolean
  filterQuery?: string
}

export default function TeaPanel({ teas, selectedIndex, isActive, isFilterActive, filterQuery = '' }: Props) {
  return (
    <div className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}>
      <div className={styles.header}>
        {isFilterActive ? (
          <span className={styles.filterLabel}>Hledám: <strong>{filterQuery}</strong></span>
        ) : (
          'Čaje'
        )}
      </div>
      <ul className={styles.list}>
        {teas.length === 0 ? (
          <li className={styles.empty}>Žádné čaje</li>
        ) : (
          teas.map((tea, idx) => (
            <li key={tea.id} className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}>
              <div className={styles.name}>{tea.name}</div>
              {tea.std_price_moc && <div className={styles.price}>{tea.std_price_moc} Kč</div>}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
