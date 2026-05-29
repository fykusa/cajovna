import { Tea } from '../../types'
import styles from './SearchResults.module.css'

interface Props {
  query: string
  results: Tea[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function SearchResults({ query, results, activeIndex, onSelect }: Props) {
  return (
    <div className={styles.container}>
      <p className={styles.query}>Hledám: <strong>{query}</strong></p>
      {results.length === 0 ? (
        <p className={styles.empty}>Nic nenalezeno</p>
      ) : (
        <ul className={styles.list} role="list">
          {results.map((tea, i) => (
            <li
              key={tea.id}
              className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
              onClick={() => onSelect(i)}
              role="listitem"
            >
              <span className={styles.name}>{tea.name}</span>
              <span className={styles.price}>
                {(tea.std_price_moc ?? tea.pkg1_price_moc) != null
                  ? `${tea.std_price_moc ?? tea.pkg1_price_moc} Kč`
                  : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
