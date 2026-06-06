// frontend/src/components/pos-mobile/MobileTopBar.tsx
import styles from './MobileTopBar.module.css'

interface Props {
  mode: 'pos' | 'history'
  onModeChange: (mode: 'pos' | 'history') => void
  username: string
  onLogout: () => void
}

export default function MobileTopBar({ mode, onModeChange, username, onLogout }: Props) {
  return (
    <nav className={styles.bar}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === 'pos' ? styles.active : ''}`}
          onClick={() => onModeChange('pos')}
        >
          Prodej
        </button>
        <button
          className={`${styles.tab} ${mode === 'history' ? styles.active : ''}`}
          onClick={() => onModeChange('history')}
        >
          Přehled
        </button>
      </div>
      <div className={styles.user}>
        <span className={styles.username}>{username}</span>
        <button className={styles.logoutBtn} onClick={onLogout} aria-label="Odhlásit">
          ↩
        </button>
      </div>
    </nav>
  )
}
