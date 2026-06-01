import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Přehled', end: true },
  { to: '/admin/products', label: 'Čaje', end: false },
  { to: '/admin/categories', label: 'Kategorie', end: false },
  { to: '/admin/users', label: 'Uživatelé', end: false },
  { to: '/admin/bags', label: 'Pytlíky', end: false },
  { to: '/admin/sales', label: 'Tržby', end: false },
]

export default function AdminLayout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  return (
    <div className={styles.layout}>
      <header className={styles.sidebar}>
        <div className={styles.brand}>Čajovna Admin</div>
        <nav>
          <ul className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `${styles.link} ${isActive ? styles.active : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.footer}>
          <span className={styles.username}>{user?.username}</span>
          <button onClick={logout} className={styles.logoutBtn}>Odhlásit</button>
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
