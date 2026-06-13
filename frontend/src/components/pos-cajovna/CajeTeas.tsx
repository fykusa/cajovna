import type { TeaRow } from '../../types'
import styles from './CajeTeas.module.css'

interface Props {
  teas: TeaRow[]
  categoryName: string
  onSelect: (tea: TeaRow) => void
}

export default function CajeTeas({ teas, categoryName, onSelect }: Props) {
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
                <span className={styles.name}>{tea.NAZEV}</span>
                {tea.POZNAMKA && <span className={styles.note}>{tea.POZNAMKA}</span>}
              </div>
              {tea.CENA1 != null && (
                <span className={styles.price}>{tea.CENA1} Kč</span>
              )}
              <span className={styles.arrow}>›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
