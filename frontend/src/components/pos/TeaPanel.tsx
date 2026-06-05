import { useRef, useEffect } from 'react'
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
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!listRef.current) return
      const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
      item?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedIndex])

  return (
    <div className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}>
      <div className={styles.header}>
        {isFilterActive ? (
          <span className={styles.filterLabel}>Hledám: <strong>{filterQuery}</strong></span>
        ) : (
          'Čaje'
        )}
      </div>
      <ul className={styles.list} ref={listRef} role="list">
        {teas.length === 0 ? (
          <li className={styles.empty}>Žádné čaje</li>
        ) : (
          teas.map((tea, idx) => (
            <li key={tea.id} className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`} role="listitem">
              <div className={styles.name}>{tea.name}</div>
              {tea.std_price_moc && <div className={styles.price}>{tea.std_price_moc} Kč</div>}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
