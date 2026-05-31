import type { Tea } from '../../types'
import styles from './TeaList.module.css'

interface Props {
  teas: Tea[]
  activeIndex: number
  onSelect: (index: number) => void
}

function primaryPrice(tea: Tea): number | null {
  return tea.std_price_moc ?? tea.pkg1_price_moc ?? tea.pkg2_price_moc
}

export default function TeaList({ teas, activeIndex, onSelect }: Props) {
  return (
    <ul className={styles.list} role="list">
      {teas.map((tea, i) => (
        <li
          key={tea.id}
          className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
          onClick={() => onSelect(i)}
          role="listitem"
        >
          <span className={styles.name}>{tea.name}</span>
          {tea.note && <span className={styles.note}>{tea.note}</span>}
          <span className={styles.price}>
            {primaryPrice(tea) != null ? `${primaryPrice(tea)} Kč` : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
