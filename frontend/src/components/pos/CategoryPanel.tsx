import { useRef, useEffect } from 'react'
import type { Category } from '../../types'
import styles from './CategoryPanel.module.css'

interface Props {
  categories: Category[]
  selectedIndex: number
  isActive: boolean
}

export default function CategoryPanel({ categories, selectedIndex, isActive }: Props) {
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
      <div className={styles.header}>Kategorie</div>
      <ul className={styles.list} ref={listRef} role="list">
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
