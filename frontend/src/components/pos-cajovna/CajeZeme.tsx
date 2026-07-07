import styles from './CajeCategories.module.css'

interface Props {
  options: string[]
  onSelect: (zeme: string | null) => void
}

export default function CajeZeme({ options, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        <button className={styles.card} onClick={() => onSelect(null)}>
          <span className={styles.name}>Vše</span>
        </button>
        {options.map((zeme) => (
          <button key={zeme} className={styles.card} onClick={() => onSelect(zeme)}>
            <span className={styles.name}>{zeme}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
