# Cajovna Frontend — Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementovat Admin sekci — správa uživatelů, čajů, skladu, pytlíků a přehled tržeb.

**Architecture:** Každá Admin stránka je samostatná stránka s vlastním fetch + lokálním stavem (useState). Sdílený AdminLayout wrapper zajišťuje navigaci. Testy ověřují vykreslení dat a akce (přidat/upravit/smazat). Formuláře jsou inline (ne modal) pro jednoduchost.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest + RTL

**Předpoklady:** Foundation plán (`cajovna-foundation.md`) musí být hotový. Admin stránky nahradí placeholdery z Foundation plánu.

---

## Souborová mapa

```
frontend/src/
  components/admin/
    AdminLayout.tsx + .module.css    ← sidebar nav + outlet
  pages/admin/
    Dashboard.tsx                    ← přepíše placeholder
    Users.tsx + .module.css          ← přepíše placeholder
    Users.test.tsx
    Products.tsx + .module.css       ← přepíše placeholder
    Products.test.tsx
    Bags.tsx + .module.css           ← přepíše placeholder
    Bags.test.tsx
    Sales.tsx + .module.css          ← přepíše placeholder
    Sales.test.tsx
```

---

## Task 16: AdminLayout + Dashboard

**Soubory:**
- Create: `frontend/src/components/admin/AdminLayout.tsx`
- Create: `frontend/src/components/admin/AdminLayout.module.css`
- Modify: `frontend/src/pages/admin/Dashboard.tsx`
- Modify: `frontend/src/router/AppRouter.tsx` (nested routes)

- [ ] **Step 1: Vytvořit AdminLayout.tsx**

> AdminLayout nemá vlastní test — chování routování testujeme v AppRouter.

```typescript
// frontend/src/components/admin/AdminLayout.tsx
import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Přehled', end: true },
  { to: '/admin/products', label: 'Čaje', end: false },
  { to: '/admin/users', label: 'Uživatelé', end: false },
  { to: '/admin/bags', label: 'Pytlíky', end: false },
  { to: '/admin/sales', label: 'Tržby', end: false },
]

export default function AdminLayout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.brand}>Čajovna Admin</div>
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
        <div className={styles.footer}>
          <span className={styles.username}>{user?.username}</span>
          <button onClick={logout} className={styles.logoutBtn}>Odhlásit</button>
        </div>
      </nav>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
```

```css
/* frontend/src/components/admin/AdminLayout.module.css */
.layout { display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: 200px; background: #1e1e1e; display: flex; flex-direction: column;
           border-right: 1px solid #333; }
.brand { padding: 20px 16px; font-size: 1rem; font-weight: 700; color: #d4a84b;
         border-bottom: 1px solid #333; }
.nav { list-style: none; flex: 1; padding: 8px 0; }
.link { display: block; padding: 10px 16px; color: #aaa; text-decoration: none; }
.link:hover { background: #2a2a2a; color: #eee; }
.active { background: #2a2a2a; color: #d4a84b; border-left: 3px solid #d4a84b; }
.footer { padding: 12px 16px; border-top: 1px solid #333; }
.username { font-size: 0.85rem; color: #888; display: block; margin-bottom: 6px; }
.logoutBtn { background: none; border: 1px solid #555; color: #aaa; padding: 4px 10px;
             border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.content { flex: 1; overflow-y: auto; padding: 24px; }
```

- [ ] **Step 2: Aktualizovat AppRouter.tsx pro nested routes**

Nahraď admin routes v `frontend/src/router/AppRouter.tsx`:

```typescript
// frontend/src/router/AppRouter.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ProtectedRoute from './ProtectedRoute'
import Login from '../pages/Login'
import NotAuthorized from '../pages/NotAuthorized'
import AdminLayout from '../components/admin/AdminLayout'

const POS = lazy(() => import('../pages/POS'))
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('../pages/admin/Products'))
const AdminUsers = lazy(() => import('../pages/admin/Users'))
const AdminBags = lazy(() => import('../pages/admin/Bags'))
const AdminSales = lazy(() => import('../pages/admin/Sales'))

export default function AppRouter() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: '#aaa' }}>Načítám…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<NotAuthorized />} />

        <Route
          path="/pos"
          element={
            <ProtectedRoute requiredRole="prodavacka">
              <POS />
            </ProtectedRoute>
          }
        />

        {/* Admin nested routes pod AdminLayout */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bags" element={<AdminBags />} />
          <Route path="sales" element={<AdminSales />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
```

- [ ] **Step 3: Implementovat Dashboard.tsx**

```typescript
// frontend/src/pages/admin/Dashboard.tsx
import { useEffect, useState } from 'react'
import { getSales } from '../../api/sales'
import { Sale } from '../../types'

export default function AdminDashboard() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getSales({ from: today + ' 00:00:00', to: today + ' 23:59:59' })
      .then(setSales)
      .finally(() => setLoading(false))
  }, [today])

  const total = sales.reduce((s, sale) => s + Number(sale.total_amount), 0)

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: '#d4a84b' }}>Přehled — dnes</h1>
      {loading ? (
        <p style={{ color: '#aaa' }}>Načítám…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
            <Stat label="Počet prodejů" value={String(sales.length)} />
            <Stat label="Tržby celkem" value={`${Math.round(total)} Kč`} />
          </div>
          <h2 style={{ marginBottom: 12, fontSize: '1rem', color: '#aaa' }}>Poslední prodeje</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#888', textAlign: 'left', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '8px' }}>Čas</th>
                <th style={{ padding: '8px' }}>Prodavačka</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Částka</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                    {new Date(s.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '8px' }}>{s.username}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#6abf69', fontWeight: 600 }}>
                    {Math.round(Number(s.total_amount))} Kč
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <p style={{ color: '#555', fontStyle: 'italic' }}>Dnes zatím žádné prodeje.</p>}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#2a2a2a', padding: '20px 28px', borderRadius: 8 }}>
      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#d4a84b' }}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 4: Ověřit TS a commit**

```powershell
cd frontend && npx tsc --noEmit
cd ..
git add frontend/src/components/admin/ frontend/src/pages/admin/Dashboard.tsx frontend/src/router/AppRouter.tsx
git commit -m "feat: admin layout s navigaci a dashboard"
```

---

## Task 17: Admin — Správa uživatelů

**Soubory:**
- Modify: `frontend/src/pages/admin/Users.tsx`
- Create: `frontend/src/pages/admin/Users.module.css`
- Create: `frontend/src/pages/admin/Users.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/pages/admin/Users.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Users from './Users'

vi.mock('../../api/users', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

const mockApi = vi.mocked(await import('../../api/users'))

const USERS = [
  { id: 1, username: 'terka', role: 'prodavacka' as const },
  { id: 2, username: 'boss', role: 'admin' as const },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.getUsers.mockResolvedValue(USERS)
})

describe('Users', () => {
  it('zobrazí seznam uživatelů', async () => {
    render(<Users />)
    expect(await screen.findByText('terka')).toBeInTheDocument()
    expect(screen.getByText('boss')).toBeInTheDocument()
  })

  it('zobrazí roli každého uživatele', async () => {
    render(<Users />)
    await screen.findByText('terka')
    expect(screen.getByText('prodavacka')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('zobrazí formulář pro nového uživatele po kliku na Přidat', async () => {
    const user = userEvent.setup()
    render(<Users />)
    await screen.findByText('terka')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    expect(screen.getByPlaceholderText(/uživatelské jméno/i)).toBeInTheDocument()
  })

  it('zavolá createUser a obnoví seznam po odeslání formuláře', async () => {
    mockApi.createUser.mockResolvedValueOnce({ id: 3 })
    mockApi.getUsers.mockResolvedValueOnce([
      ...USERS,
      { id: 3, username: 'nova', role: 'prodavacka' as const },
    ])
    const user = userEvent.setup()
    render(<Users />)
    await screen.findByText('terka')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    await user.type(screen.getByPlaceholderText(/uživatelské jméno/i), 'nova')
    await user.type(screen.getByPlaceholderText(/heslo/i), 'heslo123')
    await user.click(screen.getByRole('button', { name: /uložit/i }))
    await waitFor(() => expect(mockApi.createUser).toHaveBeenCalledWith({
      username: 'nova', password: 'heslo123', role: 'prodavacka',
    }))
  })

  it('zavolá deleteUser po kliknutí na Smazat', async () => {
    mockApi.deleteUser.mockResolvedValueOnce(undefined)
    mockApi.getUsers.mockResolvedValueOnce([USERS[1]])
    const user = userEvent.setup()
    render(<Users />)
    await screen.findByText('terka')
    const deleteButtons = screen.getAllByRole('button', { name: /smazat/i })
    await user.click(deleteButtons[0])
    await waitFor(() => expect(mockApi.deleteUser).toHaveBeenCalledWith(1))
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat Users.tsx**

```typescript
// frontend/src/pages/admin/Users.tsx
import { useEffect, useState } from 'react'
import { User } from '../../types'
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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Smazat uživatele?')) return
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
```

```css
/* frontend/src/pages/admin/Users.module.css */
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h1 { font-size: 1.4rem; color: #d4a84b; }
.addBtn { padding: 8px 16px; background: #d4a84b; color: #111; border: none;
          border-radius: 4px; font-weight: 600; cursor: pointer; }
.form { background: #2a2a2a; padding: 20px; border-radius: 8px; margin-bottom: 24px;
        display: flex; flex-direction: column; gap: 10px; max-width: 400px; }
.error { color: #f87171; font-size: 0.9rem; }
.input { padding: 8px 12px; background: #333; border: 1px solid #555; border-radius: 4px;
         color: #eee; font-size: 1rem; }
.formActions { display: flex; gap: 10px; }
.saveBtn { padding: 8px 20px; background: #6abf69; color: #111; border: none;
           border-radius: 4px; font-weight: 600; cursor: pointer; }
.cancelBtn { padding: 8px 16px; background: #444; color: #eee; border: none;
             border-radius: 4px; cursor: pointer; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; padding: 10px 12px; color: #888; border-bottom: 1px solid #333; }
.table td { padding: 10px 12px; border-bottom: 1px solid #2a2a2a; }
.role { background: #2a2a3a; color: #aaa; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }
.deleteBtn { background: none; border: 1px solid #555; color: #f87171; padding: 4px 12px;
             border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.loading { color: #aaa; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
cd frontend && npm test -- Users.test.tsx
cd ..
git add frontend/src/pages/admin/Users*
git commit -m "feat: admin stranka - sprava uzivatelu"
```

---

## Task 18: Admin — Správa čajů a skladu

**Soubory:**
- Modify: `frontend/src/pages/admin/Products.tsx`
- Create: `frontend/src/pages/admin/Products.module.css`
- Create: `frontend/src/pages/admin/Products.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/pages/admin/Products.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Products from './Products'

vi.mock('../../api/products', () => ({
  getProducts: vi.fn(),
  updateProduct: vi.fn(),
}))
vi.mock('../../api/stock', () => ({
  updateStock: vi.fn(),
}))

const mockProducts = vi.mocked(await import('../../api/products'))
const mockStock = vi.mocked(await import('../../api/stock'))

const TEAS = [
  { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
    std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
    pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 1.5 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockProducts.getProducts.mockResolvedValue(TEAS)
})

describe('Products', () => {
  it('zobrazí seznam čajů', async () => {
    render(<Products />)
    expect(await screen.findByText('Show Mee')).toBeInTheDocument()
  })

  it('zobrazí stav skladu pro čaj', async () => {
    render(<Products />)
    await screen.findByText('Show Mee')
    expect(screen.getByText(/5 ks/)).toBeInTheDocument()
    expect(screen.getByText(/1.5 kg/)).toBeInTheDocument()
  })

  it('filtruje čaje podle vyhledávání', async () => {
    mockProducts.getProducts.mockResolvedValue([
      ...TEAS,
      { id: 2, category_id: 1, name: 'Bai Mu Dan', note: null, flag: 'active', origin: null,
        std_weight_g: 30, std_price_moc: 220, pkg1_weight_g: null, pkg1_price_moc: null,
        pkg2_weight_g: null, pkg2_price_moc: null,
        stock_std_pcs: 3, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0 },
    ])
    const user = userEvent.setup()
    render(<Products />)
    await screen.findByText('Show Mee')
    await user.type(screen.getByPlaceholderText(/hledat/i), 'bai')
    expect(screen.queryByText('Show Mee')).not.toBeInTheDocument()
    expect(screen.getByText('Bai Mu Dan')).toBeInTheDocument()
  })

  it('zavolá updateStock po úpravě skladu', async () => {
    mockStock.updateStock.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<Products />)
    await screen.findByText('Show Mee')
    // Klik na tlačítko úpravy skladu
    await user.click(screen.getByRole('button', { name: /sklad/i }))
    // Vyplnit novou hodnotu
    const stockInput = screen.getByDisplayValue('5')
    await user.clear(stockInput)
    await user.type(stockInput, '10')
    await user.click(screen.getByRole('button', { name: /uložit/i }))
    await waitFor(() => expect(mockStock.updateStock).toHaveBeenCalledWith(1, expect.objectContaining({
      stock_std_pcs: 10,
    })))
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat Products.tsx**

```typescript
// frontend/src/pages/admin/Products.tsx
import { useEffect, useState } from 'react'
import { Tea } from '../../types'
import { getProducts, updateProduct } from '../../api/products'
import { updateStock } from '../../api/stock'
import styles from './Products.module.css'

interface StockEdit {
  teaId: number
  std: number
  pkg1: number
  pkg2: number
  kg: number
}

export default function Products() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stockEdit, setStockEdit] = useState<StockEdit | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProducts().then(setTeas).finally(() => setLoading(false))
  }, [])

  const filtered = teas.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  function openStockEdit(tea: Tea) {
    setStockEdit({
      teaId: tea.id,
      std: tea.stock_std_pcs,
      pkg1: tea.stock_pkg1_pcs,
      pkg2: tea.stock_pkg2_pcs,
      kg: Number(tea.stock_kg),
    })
  }

  async function saveStock() {
    if (!stockEdit) return
    setSaving(true)
    await updateStock(stockEdit.teaId, {
      stock_std_pcs: stockEdit.std,
      stock_pkg1_pcs: stockEdit.pkg1,
      stock_pkg2_pcs: stockEdit.pkg2,
      stock_kg: stockEdit.kg,
    })
    // Aktualizuj lokální data
    setTeas((prev) =>
      prev.map((t) =>
        t.id === stockEdit.teaId
          ? { ...t, stock_std_pcs: stockEdit.std, stock_pkg1_pcs: stockEdit.pkg1,
              stock_pkg2_pcs: stockEdit.pkg2, stock_kg: stockEdit.kg }
          : t
      )
    )
    setStockEdit(null)
    setSaving(false)
  }

  return (
    <div>
      <div className={styles.header}>
        <h1>Čaje</h1>
        <input
          placeholder="Hledat čaj…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
      </div>

      {/* Inline sklad editor */}
      {stockEdit && (
        <div className={styles.stockForm}>
          <h3>Upravit sklad</h3>
          <label>
            Std ks:
            <input type="number" value={stockEdit.std}
              onChange={(e) => setStockEdit({ ...stockEdit, std: +e.target.value })}
              className={styles.numInput} />
          </label>
          <label>
            Bal 1 ks:
            <input type="number" value={stockEdit.pkg1}
              onChange={(e) => setStockEdit({ ...stockEdit, pkg1: +e.target.value })}
              className={styles.numInput} />
          </label>
          <label>
            Bal 2 ks:
            <input type="number" value={stockEdit.pkg2}
              onChange={(e) => setStockEdit({ ...stockEdit, pkg2: +e.target.value })}
              className={styles.numInput} />
          </label>
          <label>
            Sypný kg:
            <input type="number" step="0.001" value={stockEdit.kg}
              onChange={(e) => setStockEdit({ ...stockEdit, kg: +e.target.value })}
              className={styles.numInput} />
          </label>
          <div className={styles.formActions}>
            <button onClick={saveStock} disabled={saving} className={styles.saveBtn}>Uložit</button>
            <button onClick={() => setStockEdit(null)} className={styles.cancelBtn}>Zrušit</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Název</th>
              <th>Std Kč</th>
              <th>Sklad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tea) => (
              <tr key={tea.id}>
                <td>
                  {tea.name}
                  {tea.note && <span className={styles.note}> — {tea.note}</span>}
                </td>
                <td>{tea.std_price_moc ?? '—'}</td>
                <td className={styles.stock}>
                  {tea.stock_std_pcs > 0 && <span>{tea.stock_std_pcs} ks</span>}
                  {tea.stock_kg > 0 && <span>{tea.stock_kg} kg</span>}
                  {tea.stock_std_pcs === 0 && tea.stock_kg === 0 &&
                    <span className={styles.noStock}>0</span>}
                </td>
                <td>
                  <button onClick={() => openStockEdit(tea)} className={styles.editBtn}>
                    Sklad
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && filtered.length === 0 && (
        <p className={styles.noResults}>Žádné výsledky pro „{search}"</p>
      )}
    </div>
  )
}
```

```css
/* frontend/src/pages/admin/Products.module.css */
.header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
h1 { font-size: 1.4rem; color: #d4a84b; white-space: nowrap; }
.search { flex: 1; max-width: 300px; padding: 8px 12px; background: #333;
          border: 1px solid #555; border-radius: 4px; color: #eee; font-size: 1rem; }
.stockForm { background: #2a2a2a; padding: 16px; border-radius: 8px; margin-bottom: 20px;
             display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.stockForm h3 { width: 100%; margin: 0; color: #aaa; font-size: 0.95rem; }
.stockForm label { display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 0.9rem; }
.numInput { width: 80px; padding: 6px 8px; background: #333; border: 1px solid #555;
            border-radius: 4px; color: #eee; }
.formActions { display: flex; gap: 8px; }
.saveBtn { padding: 6px 16px; background: #6abf69; color: #111; border: none;
           border-radius: 4px; font-weight: 600; cursor: pointer; }
.cancelBtn { padding: 6px 12px; background: #444; color: #eee; border: none;
             border-radius: 4px; cursor: pointer; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; padding: 10px 12px; color: #888; border-bottom: 1px solid #333; }
.table td { padding: 8px 12px; border-bottom: 1px solid #2a2a2a; }
.note { color: #888; font-size: 0.85rem; font-style: italic; }
.stock { display: flex; gap: 8px; }
.stock span { background: #2a3a2a; color: #6abf69; padding: 2px 8px;
              border-radius: 4px; font-size: 0.85rem; }
.noStock { background: #3a2a2a !important; color: #888 !important; }
.editBtn { background: none; border: 1px solid #555; color: #aaa; padding: 4px 10px;
           border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.editBtn:hover { border-color: #d4a84b; color: #d4a84b; }
.loading, .noResults { color: #888; font-style: italic; padding: 16px 0; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
cd frontend && npm test -- Products.test.tsx
cd ..
git add frontend/src/pages/admin/Products*
git commit -m "feat: admin stranka - caje a sklad"
```

---

## Task 19: Admin — Pytlíky

**Soubory:**
- Modify: `frontend/src/pages/admin/Bags.tsx`
- Create: `frontend/src/pages/admin/Bags.module.css`
- Create: `frontend/src/pages/admin/Bags.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/pages/admin/Bags.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Bags from './Bags'

vi.mock('../../api/bags', () => ({
  getBags: vi.fn(),
}))

const mockBags = vi.mocked(await import('../../api/bags'))

beforeEach(() => {
  mockBags.getBags.mockResolvedValue([
    { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: '85x140', price_per_piece: 2.91 },
    { id: 2, surface_type: 'papír', volume_ml: 250, dimensions: '110x185', price_per_piece: 3.63 },
    { id: 3, surface_type: 'bílý matný', volume_ml: 250, dimensions: '110x185', price_per_piece: 3.88 },
  ])
})

describe('Bags', () => {
  it('zobrazí seznam pytlíků seskupený podle materiálu', async () => {
    render(<Bags />)
    expect(await screen.findByText('papír')).toBeInTheDocument()
    expect(screen.getByText('bílý matný')).toBeInTheDocument()
  })

  it('zobrazí objem a cenu pro každý pytlík', async () => {
    render(<Bags />)
    await screen.findByText('papír')
    expect(screen.getByText('100 ml')).toBeInTheDocument()
    expect(screen.getByText(/2,91 Kč/)).toBeInTheDocument()
    expect(screen.getAllByText('250 ml')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat Bags.tsx**

```typescript
// frontend/src/pages/admin/Bags.tsx
import { useEffect, useState } from 'react'
import { Bag } from '../../types'
import { getBags } from '../../api/bags'
import styles from './Bags.module.css'

export default function Bags() {
  const [bags, setBags] = useState<Bag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBags().then(setBags).finally(() => setLoading(false))
  }, [])

  // Seskupit podle materiálu
  const grouped: Record<string, Bag[]> = {}
  bags.forEach((b) => {
    if (!grouped[b.surface_type]) grouped[b.surface_type] = []
    grouped[b.surface_type].push(b)
  })

  return (
    <div>
      <h1 className={styles.title}>Pytlíky — ceník</h1>
      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        Object.entries(grouped).map(([material, items]) => (
          <div key={material} className={styles.group}>
            <h2 className={styles.material}>{material}</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Objem</th>
                  <th>Rozměry</th>
                  <th>Cena / ks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((bag) => (
                  <tr key={bag.id}>
                    <td>{bag.volume_ml} ml</td>
                    <td className={styles.dim}>{bag.dimensions ?? '—'}</td>
                    <td className={styles.price}>
                      {Number(bag.price_per_piece).toLocaleString('cs-CZ', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2
                      })} Kč
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
```

```css
/* frontend/src/pages/admin/Bags.module.css */
.title { font-size: 1.4rem; color: #d4a84b; margin-bottom: 20px; }
.loading { color: #aaa; font-style: italic; }
.group { margin-bottom: 28px; }
.material { font-size: 1rem; color: #6abf69; margin-bottom: 8px;
            text-transform: capitalize; border-bottom: 1px solid #333; padding-bottom: 4px; }
.table { width: 100%; border-collapse: collapse; max-width: 500px; }
.table th { text-align: left; padding: 8px 12px; color: #888; font-size: 0.85rem; }
.table td { padding: 8px 12px; border-bottom: 1px solid #2a2a2a; }
.dim { color: #888; font-size: 0.9rem; }
.price { font-weight: 600; color: #d4a84b; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
cd frontend && npm test -- Bags.test.tsx
cd ..
git add frontend/src/pages/admin/Bags*
git commit -m "feat: admin stranka - pytliky cenik"
```

---

## Task 20: Admin — Tržby a statistiky

**Soubory:**
- Modify: `frontend/src/pages/admin/Sales.tsx`
- Create: `frontend/src/pages/admin/Sales.module.css`
- Create: `frontend/src/pages/admin/Sales.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/pages/admin/Sales.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sales from './Sales'

vi.mock('../../api/sales', () => ({
  getSales: vi.fn(),
}))

const mockSales = vi.mocked(await import('../../api/sales'))

const SALES = [
  { id: 1, user_id: 1, username: 'terka', total_amount: 260, note: null, created_at: '2026-05-28 10:00:00' },
  { id: 2, user_id: 1, username: 'terka', total_amount: 130, note: null, created_at: '2026-05-28 11:00:00' },
  { id: 3, user_id: 2, username: 'boss', total_amount: 500, note: null, created_at: '2026-05-28 12:00:00' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockSales.getSales.mockResolvedValue(SALES)
})

describe('Sales', () => {
  it('zobrazí tabulku prodejů', async () => {
    render(<Sales />)
    expect(await screen.findByText('terka')).toBeInTheDocument()
    expect(screen.getByText('boss')).toBeInTheDocument()
  })

  it('zobrazí celkovou tržbu', async () => {
    render(<Sales />)
    await screen.findByText('terka')
    // celkem 260 + 130 + 500 = 890
    expect(screen.getByText(/890/)).toBeInTheDocument()
  })

  it('filtruje prodeje po kliku na Zobrazit', async () => {
    const user = userEvent.setup()
    render(<Sales />)
    await screen.findByText('terka')
    const fromInput = screen.getByLabelText(/od/i)
    await user.clear(fromInput)
    await user.type(fromInput, '2026-05-28')
    await user.click(screen.getByRole('button', { name: /zobrazit/i }))
    await waitFor(() => expect(mockSales.getSales).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat Sales.tsx**

```typescript
// frontend/src/pages/admin/Sales.tsx
import { useEffect, useState } from 'react'
import { Sale } from '../../types'
import { getSales } from '../../api/sales'
import styles from './Sales.module.css'

export default function Sales() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await getSales({
      from: from + ' 00:00:00',
      to: to + ' 23:59:59',
    })
    setSales(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const total = sales.reduce((s, sale) => s + Number(sale.total_amount), 0)

  // Tržby per prodavačka
  const perUser: Record<string, number> = {}
  sales.forEach((s) => {
    perUser[s.username] = (perUser[s.username] ?? 0) + Number(s.total_amount)
  })

  return (
    <div>
      <h1 className={styles.title}>Tržby</h1>

      <form onSubmit={(e) => { e.preventDefault(); load() }} className={styles.filter}>
        <label>
          Od: <input aria-label="od" type="date" value={from}
            onChange={(e) => setFrom(e.target.value)} className={styles.dateInput} />
        </label>
        <label>
          Do: <input aria-label="do" type="date" value={to}
            onChange={(e) => setTo(e.target.value)} className={styles.dateInput} />
        </label>
        <button type="submit" className={styles.filterBtn}>Zobrazit</button>
      </form>

      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <>
          {/* Statistiky */}
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Celkové tržby</div>
              <div className={styles.statValue}>{Math.round(total)} Kč</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Počet prodejů</div>
              <div className={styles.statValue}>{sales.length}</div>
            </div>
          </div>

          {/* Per prodavačka */}
          {Object.keys(perUser).length > 0 && (
            <div className={styles.perUser}>
              <h3>Tržby per prodavačka</h3>
              <table className={styles.table}>
                <tbody>
                  {Object.entries(perUser)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, amount]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td className={styles.amount}>{Math.round(amount)} Kč</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Seznam prodejů */}
          <h2 className={styles.sectionTitle}>Prodeje ({sales.length})</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Čas</th>
                <th>Prodavačka</th>
                <th style={{ textAlign: 'right' }}>Částka</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className={styles.time}>
                    {new Date(s.created_at).toLocaleString('cs-CZ', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>{s.username}</td>
                  <td className={styles.amount}>{Math.round(Number(s.total_amount))} Kč</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <p className={styles.empty}>Za zvolené období žádné prodeje.</p>
          )}
        </>
      )}
    </div>
  )
}
```

```css
/* frontend/src/pages/admin/Sales.module.css */
.title { font-size: 1.4rem; color: #d4a84b; margin-bottom: 20px; }
.filter { display: flex; gap: 16px; align-items: center; margin-bottom: 24px;
          flex-wrap: wrap; }
.filter label { display: flex; align-items: center; gap: 8px; color: #aaa; font-size: 0.9rem; }
.dateInput { padding: 6px 10px; background: #333; border: 1px solid #555;
             border-radius: 4px; color: #eee; }
.filterBtn { padding: 7px 20px; background: #d4a84b; color: #111; border: none;
             border-radius: 4px; font-weight: 600; cursor: pointer; }
.loading, .empty { color: #888; font-style: italic; }
.stats { display: flex; gap: 20px; margin-bottom: 24px; }
.stat { background: #2a2a2a; padding: 16px 24px; border-radius: 8px; }
.statLabel { color: #888; font-size: 0.85rem; margin-bottom: 4px; }
.statValue { font-size: 1.6rem; font-weight: 700; color: #d4a84b; }
.perUser { margin-bottom: 24px; }
.perUser h3 { color: #aaa; font-size: 0.95rem; margin-bottom: 8px; }
.sectionTitle { color: #aaa; font-size: 1rem; margin-bottom: 12px; }
.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; padding: 8px 12px; color: #888; border-bottom: 1px solid #333; }
.table td { padding: 8px 12px; border-bottom: 1px solid #2a2a2a; }
.time { color: #888; font-size: 0.9rem; }
.amount { text-align: right; font-weight: 600; color: #6abf69; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
cd frontend && npm test -- Sales.test.tsx
cd ..
git add frontend/src/pages/admin/Sales*
git commit -m "feat: admin stranka - trzby a statistiky"
```

---

## Finální ověření

- [ ] **Spustit všechny testy najednou**

```powershell
cd frontend && npm test
```

Očekávaný výstup: všechny testy `PASS`, žádné chyby.

- [ ] **TypeScript check**

```powershell
npx tsc --noEmit
```

Očekávaný výstup: žádné chyby.

- [ ] **Manuální test admin sekce**

Docker musí běžet. Vite dev server: `npm run dev`.

1. Přihlaš se jako admin na `http://localhost:5173/login`
2. Ověř všechny admin stránky (sidebar navigace)
3. Přidej uživatele, ověř v DB
4. Zkontroluj tržby (po prodeji přes /pos)
5. Uprav sklad u nějakého čaje

- [ ] **Build pro produkci**

```powershell
npm run build
```

Očekávaný výstup: `dist/` složka vytvořena bez chyb.

- [ ] **Finální commit**

```powershell
cd ..
git add frontend/
git commit -m "feat: kompletni frontend - login, pos, admin (build ok)"
```

---

## Hotovo — Admin je kompletní

Po dokončení všech tasků (16–20):
- ✅ AdminLayout se sidebar navigací
- ✅ Dashboard s dnešními tržbami
- ✅ Správa uživatelů (add / delete)
- ✅ Správa čajů + úprava skladu
- ✅ Přehled pytlíků
- ✅ Tržby s filtrováním a statistikami per prodavačka

**Pokračovat s:** `PLAN.md` → Fáze 4 — Deploy na Forpsi.
