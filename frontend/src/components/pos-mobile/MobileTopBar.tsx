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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
            <polyline points="8 7 2 12 8 17"/>
            <line x1="2" y1="12" x2="14" y2="12"/>
            <path d="M14 7a5 5 0 0 1 0 10"/>
          </svg>
        </button>
      </div>
    </nav>
  )
}
