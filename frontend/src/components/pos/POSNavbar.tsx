import styles from './POSNavbar.module.css'

interface Props {
  activeTab: 'sell' | 'overview'
  onTabChange: (tab: 'sell' | 'overview') => void
  username: string
  onLogout: () => void
  step?: string
}

export default function POSNavbar({ activeTab, onTabChange, username, onLogout, step }: Props) {
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
        {step && activeTab === 'sell' && <span className={styles.step}>Krok: {step}</span>}
      </div>
      <div className={styles.footer}>
        <span className={styles.username}>{username}</span>
        <button onClick={onLogout} className={styles.logoutBtn}>Odhlásit</button>
      </div>
    </header>
  )
}
