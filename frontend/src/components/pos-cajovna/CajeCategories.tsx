import type { CajeCategory } from '../../types'
import styles from './CajeCategories.module.css'

interface Props {
  categories: CajeCategory[]
  onSelect: (cat: CajeCategory) => void
}

export default function CajeCategories({ categories, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {categories.map((cat) => (
          <button
            key={`${cat.kategorie}||${cat.zeme ?? ''}`}
            className={styles.card}
            onClick={() => onSelect(cat)}
          >
            <span className={styles.name}>{cat.kategorie}</span>
            {cat.zeme && <span className={styles.zeme}>{cat.zeme}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
