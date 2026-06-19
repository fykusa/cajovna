import styles from './POSNavbar.module.css'

interface Props {
  activeTab: 'sell' | 'overview'
  onTabChange: (tab: 'sell' | 'overview') => void
  username: string
  onLogout: () => void
}

export default function POSNavbar({ activeTab, onTabChange, username, onLogout }: Props) {
  return (
    <header className={styles.navbar}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'sell' ? styles.active : ''}`}
          onClick={() => onTabChange('sell')}
        >
          Pokladna
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => onTabChange('overview')}
        >
          Dnešní přehled
        </button>
      </div>
      <div className={styles.footer}>
        <span className={styles.brand}>{username}</span>
        <button onClick={onLogout} className={styles.logoutBtn} aria-label="Odhlásit">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  )
}
