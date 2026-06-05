import type { Category } from '../../types'
import styles from './CategoryPanel.module.css'

interface Props {
  categories: Category[]
  selectedIndex: number
  isActive: boolean
}

export default function CategoryPanel({ categories, selectedIndex, isActive }: Props) {
  return (
    <div className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}>
      <div className={styles.header}>Kategorie</div>
      <ul className={styles.list} role="list">
        {categories.map((cat, idx) => (
          <li
            key={cat.id}
            className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}
            role="listitem"
          >
            {cat.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
