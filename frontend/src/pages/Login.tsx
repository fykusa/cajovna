// frontend/src/pages/Login.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, changePassword } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuthStore } from '../store/authStore'
import Modal from '../components/Modal'
import styles from './Login.module.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showChange, setShowChange] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user, token } = await login(username, password)
      setAuth(user, token)
      const dest = user.role === 'admin' ? '/admin' : '/cajovna'
      navigate(dest, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Chyba přihlášení')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h1 className={styles.title}>TAO čajovna</h1>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <input
          type="text"
          placeholder="Uživatelské jméno"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={styles.input}
          autoFocus
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Heslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Přihlašování…' : 'Přihlásit'}
        </button>
        <button type="button" className={styles.linkBtn} onClick={() => setShowChange(true)}>
          Změnit heslo
        </button>
      </form>

      {showChange && <ChangePasswordModal onClose={() => setShowChange(false)} />}
    </div>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await changePassword(username, oldPassword, newPassword)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chyba změny hesla')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Změna hesla" onClose={onClose}>
      {done ? (
        <div className={styles.changeForm}>
          <p className={styles.success}>Heslo bylo změněno. Nyní se můžete přihlásit.</p>
          <button type="button" className={styles.button} onClick={onClose}>Zavřít</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.changeForm}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <input
            type="text"
            placeholder="Uživatelské jméno"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={styles.input}
            required
            autoFocus
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Stávající heslo"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={styles.input}
            required
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder="Nové heslo (min. 4 znaky)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={styles.input}
            required
            minLength={4}
            autoComplete="new-password"
          />
          <div className={styles.changeActions}>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? 'Ukládám…' : 'Změnit heslo'}
            </button>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Zrušit</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
