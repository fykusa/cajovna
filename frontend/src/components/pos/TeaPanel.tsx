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

function fmtPrice(weight: number, price: number, stock: number) {
  return (
    <>
      {weight}g · {price} Kč
      <span className={styles.stock}> ({stock})</span>
    </>
  )
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
      {isFilterActive ? (
        <div className={styles.header}>
          <span className={styles.filterLabel}>Hledám: <strong>{filterQuery}</strong></span>
        </div>
      ) : (
        <div className={`${styles.header} ${styles.colRow}`}>
          <span className={styles.colName}>Čaje</span>
          <span className={styles.colNote}>Poznámka</span>
          <span className={styles.colPrice}>Std</span>
          <span className={styles.colPrice}>Bal1</span>
          <span className={styles.colPrice}>Bal2</span>
        </div>
      )}
      <ul className={styles.list} ref={listRef} role="list">
        {teas.length === 0 ? (
          <li className={styles.empty}>Žádné čaje</li>
        ) : (
          teas.map((tea, idx) => (
            <li
              key={tea.id}
              className={`${styles.item} ${styles.colRow} ${idx === selectedIndex ? styles.selected : ''}`}
              role="listitem"
            >
              <span className={styles.colName}>{tea.name}</span>
              <span className={styles.colNote}>{tea.note ?? ''}</span>
              <span className={styles.colPrice}>
                {tea.std_weight_g != null && tea.std_price_moc != null
                  ? fmtPrice(tea.std_weight_g, tea.std_price_moc, tea.stock_std_pcs)
                  : <span className={styles.na}>—</span>}
              </span>
              <span className={styles.colPrice}>
                {tea.pkg1_weight_g != null && tea.pkg1_price_moc != null
                  ? fmtPrice(tea.pkg1_weight_g, tea.pkg1_price_moc, tea.stock_pkg1_pcs)
                  : <span className={styles.na}>—</span>}
              </span>
              <span className={styles.colPrice}>
                {tea.pkg2_weight_g != null && tea.pkg2_price_moc != null
                  ? fmtPrice(tea.pkg2_weight_g, tea.pkg2_price_moc, tea.stock_pkg2_pcs)
                  : <span className={styles.na}>—</span>}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
