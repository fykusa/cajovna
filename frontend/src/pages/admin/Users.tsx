import { useEffect, useState, useCallback } from 'react'
import type { User } from '../../types'
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import Modal from '../../components/Modal'
import { useToast } from '../../components/toast/useToast'
import styles from './Users.module.css'

interface NewUserForm { username: string; password: string; role: User['role'] }

function formatDateTime(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewUserForm>({ username: '', password: '', role: 'prodavacka' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  // Uživatel, kterému admin resetuje heslo (modal), + nové heslo.
  const [pwdUser, setPwdUser] = useState<User | null>(null)
  const [newPwd, setNewPwd] = useState('')
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
    {
      key: 'password_changed_at',
      label: 'Změna hesla',
      type: 'readonly',
      render: (u) => formatDateTime(u.password_changed_at),
    },
  ]

  // Uživatelé se v gridu needitují (jen vytvoření, reset hesla, smazání).
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
      toast.success('Uživatel vytvořen')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwdUser) return
    setSaving(true)
    setError(null)
    try {
      await updateUser(pwdUser.id, { password: newPwd })
      setPwdUser(null)
      setNewPwd('')
      await load()
      toast.success('Heslo změněno')
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
        <button onClick={() => { setError(null); setShowForm(true) }} className={styles.addBtn}>
          + Přidat
        </button>
      </div>

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
              <>
                <button
                  className={styles.actionBtn}
                  onClick={() => { setError(null); setNewPwd(''); setPwdUser(u) }}
                  disabled={saving}
                >
                  heslo
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => setConfirmDeleteId(u.id)}
                  disabled={saving}
                >
                  smazat
                </button>
              </>
            )
          }
        />
      </div>

      {showForm && (
        <Modal title="Nový uživatel" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className={styles.modalForm}>
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
              autoComplete="new-password"
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
        </Modal>
      )}

      {pwdUser && (
        <Modal title={`Změnit heslo – ${pwdUser.username}`} onClose={() => setPwdUser(null)}>
          <form onSubmit={handleResetPassword} className={styles.modalForm}>
            {error && <p className={styles.error}>{error}</p>}
            <input
              type="password"
              placeholder="Nové heslo (min. 6 znaků)"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
              minLength={6}
              className={styles.input}
              autoFocus
              autoComplete="new-password"
            />
            <div className={styles.formActions}>
              <button type="submit" disabled={saving} className={styles.saveBtn}>Uložit</button>
              <button type="button" onClick={() => setPwdUser(null)} className={styles.formCancelBtn}>Zrušit</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
