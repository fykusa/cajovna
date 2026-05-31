import type { Category } from '../../types'
import styles from './CategoryList.module.css'

interface Props {
  categories: Category[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function CategoryList({ categories, activeIndex, onSelect }: Props) {
  return (
    <ul className={styles.list} role="list">
      {categories.map((cat, i) => (
        <li
          key={cat.id}
          className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
          onClick={() => onSelect(i)}
          role="listitem"
        >
          {cat.name}
        </li>
      ))}
    </ul>
  )
}
