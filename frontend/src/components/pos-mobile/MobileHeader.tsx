// frontend/src/components/pos-mobile/MobileHeader.tsx
import styles from './MobileHeader.module.css'

interface Props {
  title: string
  subtitle?: string
  cartCount: number
  onBack?: () => void
}

export default function MobileHeader({ title, subtitle, cartCount, onBack }: Props) {
  return (
    <header className={styles.hdr}>
      <div className={styles.left}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="Zpět">
            ‹
          </button>
        )}
      </div>
      <div className={styles.center}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.sub}>{subtitle}</span>}
      </div>
      <div className={styles.right}>
        {cartCount > 0 && (
          <span className={styles.badge}>{cartCount}</span>
        )}
      </div>
    </header>
  )
}
