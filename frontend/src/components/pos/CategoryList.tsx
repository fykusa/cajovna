import { useRef, useEffect } from 'react'
import type { Category } from '../../types'
import styles from './CategoryList.module.css'

interface Props {
  categories: Category[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function CategoryList({ categories, activeIndex, onSelect }: Props) {
  const listRef = useRef<HTMLUListElement>(null)

  // Scroll v requestAnimationFrame — nevytváří setTimeout, takže by mělo být bezpečnější pro testy
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!listRef.current) return
      const activeItem = listRef.current.children[activeIndex] as HTMLElement | undefined
      activeItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeIndex])

  return (
    <ul className={styles.list} ref={listRef} role="list">
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
