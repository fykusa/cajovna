import { useEffect, useState } from 'react'
import type { User } from '../../types'
import { getUsers, createUser, deleteUser } from '../../api/users'
import styles from './Users.module.css'

interface NewUserForm { username: string; password: string; role: User['role'] }

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewUserForm>({ username: '', password: '', role: 'prodavacka' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const data = await getUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createUser(form)
      setShowForm(false)
      setForm({ username: '', password: '', role: 'prodavacka' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteUser(id)
    await load()
  }

  return (
    <div>
      <div className={styles.header}>
        <h1>Uživatelé</h1>
        <button onClick={() => setShowForm(true)} className={styles.addBtn}>+ Přidat</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}
          <input
            placeholder="Uživatelské jméno"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            className={styles.input}
            autoFocus
          />
          <input
            type="password"
            placeholder="Heslo"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className={styles.input}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
            className={styles.input}
          >
            <option value="prodavacka">prodavacka</option>
            <option value="admin">admin</option>
          </select>
          <div className={styles.formActions}>
            <button type="submit" disabled={saving} className={styles.saveBtn}>Uložit</button>
            <button type="button" onClick={() => setShowForm(false)} className={styles.cancelBtn}>Zrušit</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Jméno</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td><span className={styles.role}>{u.role}</span></td>
                <td>
                  <button onClick={() => handleDelete(u.id)} className={styles.deleteBtn}>Smazat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
