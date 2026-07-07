import styles from './CajeCategories.module.css'

interface Props {
  categories: string[]
  onSelect: (kategorie: string) => void
}

export default function CajeCategories({ categories, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {categories.map((kategorie) => (
          <button
            key={kategorie}
            className={styles.card}
            onClick={() => onSelect(kategorie)}
          >
            <span className={styles.name}>{kategorie}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
