import { useEffect, useState, useCallback } from 'react'
import type { User } from '../../types'
import { getUsers, createUser, deleteUser } from '../../api/users'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import { useToast } from '../../components/toast/useToast'
import styles from './Users.module.css'

interface NewUserForm { username: string; password: string; role: User['role'] }

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewUserForm>({ username: '', password: '', role: 'prodavacka' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await getUsers())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const columns: ColDef<User>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    { key: 'username', label: 'Jméno', type: 'readonly' },
    { key: 'role', label: 'Role', type: 'readonly' },
  ]

  // Uživatelé se v gridu needitují (jen vytvoření + smazání).
  async function handleSaveCell() {}

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
    setSaving(true)
    try {
      await deleteUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
      toast.success('Uživatel smazán')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba mazání')
    } finally {
      setSaving(false)
      setConfirmDeleteId(null)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Uživatelé</h1>
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
            <button type="button" onClick={() => setShowForm(false)} className={styles.formCancelBtn}>Zrušit</button>
          </div>
        </form>
      )}

      <div className={styles.tableWrapper}>
        <EditableGrid<User>
          columns={columns}
          rows={users}
          getRowId={(u) => u.id}
          onSaveCell={handleSaveCell}
          renderRowActions={(u) =>
            confirmDeleteId === u.id ? (
              <>
                <button className={styles.deleteBtn} onClick={() => handleDelete(u.id)} disabled={saving}>
                  Potvrdit
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={saving}
                >
                  Zrušit
                </button>
              </>
            ) : (
              <button
                className={styles.deleteBtn}
                onClick={() => setConfirmDeleteId(u.id)}
                disabled={saving}
              >
                smazat
              </button>
            )
          }
        />
      </div>
    </div>
  )
}
