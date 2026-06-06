// frontend/src/components/pos-mobile/MobileCategories.tsx
import type { Category } from '../../types'
import styles from './MobileCategories.module.css'

interface Props {
  categories: Category[]
  onSelect: (cat: Category) => void
}

export default function MobileCategories({ categories, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {categories.map((cat) => (
          <button key={cat.id} className={styles.card} onClick={() => onSelect(cat)}>
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
