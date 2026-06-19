// frontend/src/components/pos-mobile/MobileTopBar.tsx
import styles from './MobileTopBar.module.css'

interface Props {
  mode: 'pos' | 'history' | 'kasa'
  onModeChange: (mode: 'pos' | 'history' | 'kasa') => void
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
        <button
          className={`${styles.tab} ${mode === 'kasa' ? styles.active : ''}`}
          onClick={() => onModeChange('kasa')}
        >
          Pokladna
        </button>
      </div>
      <div className={styles.user}>
        <span className={styles.username}>{username}</span>
        <button className={styles.logoutBtn} onClick={onLogout} aria-label="Odhlásit">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
