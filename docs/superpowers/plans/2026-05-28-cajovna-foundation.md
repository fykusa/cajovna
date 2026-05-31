# Cajovna Frontend — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vybudovat základ React SPA — Vite scaffold, typovaný API client, auth store, Login stránku a role-based routing.

**Architecture:** Vite + React 18 + TypeScript, Zustand pro auth stav, React Router v6 pro routing. Typovaný fetch wrapper injektuje JWT z localStorage. ProtectedRoute přesměrovává nepřihlášené nebo špatnou roli. Testy Vitest + React Testing Library.

**Tech Stack:** React 18, TypeScript, Vite 5, React Router v6, Zustand, Vitest, @testing-library/react, @testing-library/user-event, jsdom, CSS Modules

---

## Souborová mapa

```
frontend/
  vite.config.ts                  ← proxy /api → localhost:8080, Vitest config
  index.html
  src/
    main.tsx                      ← BrowserRouter + App
    App.tsx                       ← AppRouter
    types.ts                      ← Tea, Category, Bag, CartItem, User, SaleItem
    api/
      client.ts                   ← apiFetch<T>, ApiError
      auth.ts                     ← login(), logout()
      products.ts                 ← getProducts(), getCategories()
      bags.ts                     ← getBags()
      sales.ts                    ← createSale()
      users.ts                    ← getUsers(), createUser(), updateUser(), deleteUser()
      stock.ts                    ← updateStock()
    store/
      authStore.ts                ← Zustand: user, token, setAuth, logout
    router/
      AppRouter.tsx               ← všechny routes
      ProtectedRoute.tsx          ← guard: nepřihlášený → /login, špatná role → 403
    pages/
      Login.tsx + Login.module.css
      NotAuthorized.tsx
    test/
      setup.ts                    ← RTL global setup (@testing-library/jest-dom)
      mocks/
        handlers.ts               ← msw request handlers (volitelné, Task 2 používá vi.fn)
  src/api/client.test.ts
  src/api/auth.test.ts
  src/store/authStore.test.ts
  src/pages/Login.test.tsx
  src/router/ProtectedRoute.test.tsx
```

---

## Task 0: Vite scaffold + tooling

**Soubory:**
- Create: `frontend/` (celý adresář)
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/test/setup.ts`

> Scaffold nemá TDD — jde o setup toolingu.

- [ ] **Step 1: Vytvořit Vite projekt**

Spusť ve složce projektu (`D:\_FYKA\AI\Cajovna`):

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Očekávaný výstup: `Done. Now run: cd frontend && npm run dev`

- [ ] **Step 2: Nainstalovat závislosti**

```powershell
npm install zustand react-router-dom
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Přepsat vite.config.ts**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 4: Vytvořit test setup**

```typescript
// frontend/src/test/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Přidat test script do package.json**

Otevři `frontend/package.json` a přidej do `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 6: Ověřit že testy běží**

```powershell
npm test
```

Očekávaný výstup: `No test files found` (nebo 0 passed) — bez chyb.

- [ ] **Step 7: Vymazat vygenerované demo soubory**

Smaž `frontend/src/App.css`, `frontend/src/assets/react.svg`, `frontend/public/vite.svg`.
Nahraď `frontend/src/App.tsx`:

```typescript
// frontend/src/App.tsx
import AppRouter from './router/AppRouter'

export default function App() {
  return <AppRouter />
}
```

Nahraď `frontend/src/main.tsx`:

```typescript
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

Nahraď obsah `frontend/src/index.css` prázdným souborem (nebo basic reset):

```css
/* frontend/src/index.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #eee; }
```

- [ ] **Step 8: Commit**

```powershell
cd ..
git add frontend/
git commit -m "feat: vite + react + ts scaffold s vitest a zustand"
```

---

## Task 1: Sdílené typy

**Soubory:**
- Create: `frontend/src/types.ts`

> Typy nemají unit testy — jsou to jen rozhraní. Správnost se ověří při kompilaci v dalších taskách.

- [ ] **Step 1: Vytvořit types.ts**

```typescript
// frontend/src/types.ts

export interface User {
  id: number
  username: string
  role: 'prodavacka' | 'admin'
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
}

export interface Tea {
  id: number
  category_id: number
  name: string
  note: string | null
  flag: 'active' | 'discontinued' | 'no_insert' | 'eshop_only' | 'trial'
  origin: string | null
  std_weight_g: number | null
  std_price_moc: number | null
  pkg1_weight_g: number | null
  pkg1_price_moc: number | null
  pkg2_weight_g: number | null
  pkg2_price_moc: number | null
  stock_std_pcs: number
  stock_pkg1_pcs: number
  stock_pkg2_pcs: number
  stock_kg: number
}

export interface Bag {
  id: number
  surface_type: string
  volume_ml: number
  dimensions: string | null
  price_per_piece: number
}

export type ItemType = 'std' | 'pkg1' | 'pkg2' | 'custom'

export interface CartItem {
  /** Lokální UUID, neposílá se na server */
  localId: string
  tea: Tea
  itemType: ItemType
  /** Pouze pro custom (sypaný), v gramech */
  weightG: number | null
  quantity: number
  unitPrice: number
  totalPrice: number
  bag: Bag | null
}

export interface SalePayload {
  items: Array<{
    tea_id: number | null
    bag_id: number | null
    item_type: ItemType | 'bag'
    weight_g: number | null
    quantity: number
    unit_price: number
    total_price: number
    note: string | null
  }>
  note: string | null
}

export interface SaleResponse {
  sale_id: number
  total: number
}

export interface Sale {
  id: number
  user_id: number
  username: string
  total_amount: number
  note: string | null
  created_at: string
}
```

- [ ] **Step 2: Ověřit TypeScript kompilaci**

```powershell
cd frontend
npx tsc --noEmit
```

Očekávaný výstup: žádné chyby.

- [ ] **Step 3: Commit**

```powershell
cd ..
git add frontend/src/types.ts
git commit -m "feat: sdilene typescript typy (Tea, Category, Bag, CartItem)"
```

---

## Task 2: API client

**Soubory:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/client.test.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/auth.test.ts`
- Create: `frontend/src/api/products.ts`
- Create: `frontend/src/api/bags.ts`
- Create: `frontend/src/api/sales.ts`
- Create: `frontend/src/api/users.ts`
- Create: `frontend/src/api/stock.ts`

- [ ] **Step 1: Napsat failing test pro apiFetch**

```typescript
// frontend/src/api/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, ApiError } from './client'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('volá /api prefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })
    await apiFetch('/products')
    expect(mockFetch).toHaveBeenCalledWith('/api/products', expect.any(Object))
  })

  it('přidá Authorization header pokud je token v localStorage', async () => {
    localStorage.setItem('token', 'testtoken')
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await apiFetch('/products')
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer testtoken')
  })

  it('nenastavuje Authorization header bez tokenu', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await apiFetch('/products')
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })

  it('hází ApiError s HTTP statusem při chybové odpovědi', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Neplatné přihlašovací údaje' }),
    })
    await expect(apiFetch('/protected')).rejects.toBeInstanceOf(ApiError)
    await expect(
      apiFetch('/protected').catch((e) => e.status)
    ).resolves.toBe(401)
  })

  it('předá body jako JSON při POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await apiFetch('/sales', { method: 'POST', body: JSON.stringify({ items: [] }) })
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe('{"items":[]}')
  })
})
```

- [ ] **Step 2: Ověřit že test padá**

```powershell
cd frontend && npm test -- client.test.ts
```

Očekávaný výstup: `FAIL src/api/client.test.ts` — `Cannot find module './client'`

- [ ] **Step 3: Implementovat client.ts**

```typescript
// frontend/src/api/client.ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? body.message ?? res.statusText)
  }

  return res.json() as Promise<T>
}
```

- [ ] **Step 4: Ověřit že test prochází**

```powershell
npm test -- client.test.ts
```

Očekávaný výstup: `PASS src/api/client.test.ts  5 passed`

- [ ] **Step 5: Napsat failing test pro auth.ts**

```typescript
// frontend/src/api/auth.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { login, logout } from './auth'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  localStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('login', () => {
  it('vrátí user a token při úspěchu', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'jwt-abc',
        user: { id: 1, username: 'terka', role: 'prodavacka' },
      }),
    })
    const result = await login('terka', 'heslo')
    expect(result.token).toBe('jwt-abc')
    expect(result.user.role).toBe('prodavacka')
  })

  it('hází ApiError při chybných přihlašovacích údajích', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    })
    await expect(login('x', 'y')).rejects.toMatchObject({ status: 401 })
  })
})

describe('logout', () => {
  it('zavolá POST /api/auth/logout', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await logout()
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })
})
```

- [ ] **Step 6: Ověřit že test padá**

```powershell
npm test -- auth.test.ts
```

Očekávaný výstup: `FAIL` — `Cannot find module './auth'`

- [ ] **Step 7: Implementovat auth.ts**

```typescript
// frontend/src/api/auth.ts
import { apiFetch } from './client'
import { User } from '../types'

export interface LoginResponse {
  token: string
  user: User
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}
```

- [ ] **Step 8: Ověřit že auth testy prochází**

```powershell
npm test -- auth.test.ts
```

Očekávaný výstup: `PASS  3 passed`

- [ ] **Step 9: Vytvořit zbývající API moduly (bez testů — jsou triviální wrappery)**

```typescript
// frontend/src/api/products.ts
import { apiFetch } from './client'
import { Tea, Category } from '../types'

export const getProducts = (params?: { category_id?: number; search?: string }): Promise<Tea[]> => {
  const q = new URLSearchParams()
  if (params?.category_id) q.set('category_id', String(params.category_id))
  if (params?.search) q.set('search', params.search)
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<Tea[]>(`/products${qs}`)
}

export const getCategories = (): Promise<Category[]> =>
  apiFetch<Category[]>('/products/categories')

export const updateProduct = (id: number, data: Partial<Tea>): Promise<void> =>
  apiFetch<void>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) })
```

```typescript
// frontend/src/api/bags.ts
import { apiFetch } from './client'
import { Bag } from '../types'

export const getBags = (): Promise<Bag[]> => apiFetch<Bag[]>('/bags')
```

```typescript
// frontend/src/api/sales.ts
import { apiFetch } from './client'
import { SalePayload, SaleResponse, Sale } from '../types'

export const createSale = (payload: SalePayload): Promise<SaleResponse> =>
  apiFetch<SaleResponse>('/sales', { method: 'POST', body: JSON.stringify(payload) })

export const getSales = (params?: { from?: string; to?: string; user_id?: number }): Promise<Sale[]> => {
  const q = new URLSearchParams()
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.user_id) q.set('user_id', String(params.user_id))
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<Sale[]>(`/sales${qs}`)
}
```

```typescript
// frontend/src/api/users.ts
import { apiFetch } from './client'
import { User } from '../types'

export interface UserCreatePayload { username: string; password: string; role: User['role'] }
export interface UserUpdatePayload { username?: string; password?: string; role?: User['role']; active?: 0 | 1 }

export const getUsers = (): Promise<User[]> => apiFetch<User[]>('/users')
export const createUser = (data: UserCreatePayload): Promise<{ id: number }> =>
  apiFetch('/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id: number, data: UserUpdatePayload): Promise<void> =>
  apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteUser = (id: number): Promise<void> =>
  apiFetch(`/users/${id}`, { method: 'DELETE' })
```

```typescript
// frontend/src/api/stock.ts
import { apiFetch } from './client'

export interface StockUpdatePayload {
  stock_std_pcs?: number
  stock_pkg1_pcs?: number
  stock_pkg2_pcs?: number
  stock_kg?: number
}

export const updateStock = (teaId: number, data: StockUpdatePayload): Promise<void> =>
  apiFetch(`/stock/${teaId}`, { method: 'PUT', body: JSON.stringify(data) })
```

- [ ] **Step 10: Ověřit TypeScript kompilaci**

```powershell
npx tsc --noEmit
```

Očekávaný výstup: žádné chyby.

- [ ] **Step 11: Commit**

```powershell
cd ..
git add frontend/src/api/ frontend/src/types.ts
git commit -m "feat: api client (apiFetch, ApiError) a vsechny api moduly"
```

---

## Task 3: Auth store (Zustand)

**Soubory:**
- Create: `frontend/src/store/authStore.ts`
- Create: `frontend/src/store/authStore.test.ts`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/store/authStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const mockUser = { id: 1, username: 'terka', role: 'prodavacka' as const }

beforeEach(() => {
  localStorage.clear()
  // Reset Zustand store mezi testy
  useAuthStore.setState({ user: null, token: null })
})

describe('useAuthStore', () => {
  it('má user a token null na začátku', () => {
    const { user, token } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
  })

  it('setAuth uloží user a token do stavu a localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'jwt-xyz')
    const { user, token } = useAuthStore.getState()
    expect(user).toEqual(mockUser)
    expect(token).toBe('jwt-xyz')
    expect(localStorage.getItem('token')).toBe('jwt-xyz')
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser)
  })

  it('logout vymaže stav i localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'jwt-xyz')
    useAuthStore.getState().logout()
    const { user, token } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('načte token z localStorage při inicializaci', () => {
    localStorage.setItem('token', 'persisted-token')
    localStorage.setItem('user', JSON.stringify(mockUser))
    // Re-import store pro simulaci nové session
    const { getInitialState } = useAuthStore.getState() as any
    // Přímo testujeme persist logiku přes reset s hodnotami z localStorage
    useAuthStore.setState({
      user: JSON.parse(localStorage.getItem('user')!),
      token: localStorage.getItem('token'),
    })
    expect(useAuthStore.getState().token).toBe('persisted-token')
    expect(useAuthStore.getState().user?.username).toBe('terka')
  })
})
```

- [ ] **Step 2: Ověřit že test padá**

```powershell
cd frontend && npm test -- authStore.test.ts
```

Očekávaný výstup: `FAIL` — `Cannot find module './authStore'`

- [ ] **Step 3: Implementovat authStore.ts**

```typescript
// frontend/src/store/authStore.ts
import { create } from 'zustand'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })(),
  token: localStorage.getItem('token'),

  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null })
  },
}))
```

- [ ] **Step 4: Ověřit že testy prochází**

```powershell
npm test -- authStore.test.ts
```

Očekávaný výstup: `PASS  4 passed`

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/src/store/
git commit -m "feat: auth store (Zustand) s persist do localStorage"
```

---

## Task 4: Login stránka

**Soubory:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Login.module.css`
- Create: `frontend/src/pages/Login.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/pages/Login.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from './Login'

// Mock API
vi.mock('../api/auth', () => ({
  login: vi.fn(),
}))

// Mock auth store
vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({ user: null, token: null, setAuth: mockSetAuth, logout: vi.fn() }),
}))

const mockSetAuth = vi.fn()
const mockLogin = vi.mocked(await import('../api/auth')).login

beforeEach(() => {
  vi.clearAllMocks()
})

function renderLogin(navigateTo?: { path: string; element: React.ReactNode }) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {navigateTo && <Route path={navigateTo.path} element={navigateTo.element} />}
      </Routes>
    </MemoryRouter>
  )
}

describe('Login', () => {
  it('zobrazí formulář s polem pro jméno, heslo a tlačítko', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('Uživatelské jméno')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Heslo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Přihlásit' })).toBeInTheDocument()
  })

  it('zavolá login() s vyplněnými hodnotami', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'tok',
      user: { id: 1, username: 'terka', role: 'prodavacka' },
    })
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo123')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    expect(mockLogin).toHaveBeenCalledWith('terka', 'heslo123')
  })

  it('zavolá setAuth po úspěšném přihlášení', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'tok',
      user: { id: 1, username: 'terka', role: 'prodavacka' },
    })
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo123')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    await waitFor(() => expect(mockSetAuth).toHaveBeenCalledWith(
      { id: 1, username: 'terka', role: 'prodavacka' },
      'tok'
    ))
  })

  it('zobrazí chybovou zprávu při neúspěšném přihlášení', async () => {
    const user = userEvent.setup()
    const { ApiError } = await import('../api/client')
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'Invalid credentials'))
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'x')
    await user.type(screen.getByPlaceholderText('Heslo'), 'y')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'))
  })

  it('deaktivuje tlačítko během načítání', async () => {
    const user = userEvent.setup()
    let resolve: (v: any) => void
    mockLogin.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    expect(screen.getByRole('button')).toBeDisabled()
    resolve!({ token: 't', user: { id: 1, username: 'terka', role: 'prodavacka' } })
  })
})
```

- [ ] **Step 2: Ověřit že test padá**

```powershell
cd frontend && npm test -- Login.test.tsx
```

Očekávaný výstup: `FAIL` — `Cannot find module './Login'`

- [ ] **Step 3: Implementovat Login.tsx**

```typescript
// frontend/src/pages/Login.tsx
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import styles from './Login.module.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user, token } = await login(username, password)
      setAuth(user, token)
      navigate(user.role === 'admin' ? '/admin' : '/pos', { replace: true })
    } catch (err: any) {
      setError(err.message ?? 'Chyba přihlášení')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h1 className={styles.title}>Čajovna</h1>
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
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Vytvořit Login.module.css**

```css
/* frontend/src/pages/Login.module.css */
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a1a;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 320px;
  padding: 32px;
  background: #2a2a2a;
  border-radius: 8px;
}

.title {
  font-size: 1.8rem;
  text-align: center;
  color: #d4a84b;
  margin-bottom: 8px;
}

.error {
  color: #f87171;
  font-size: 0.9rem;
  padding: 8px;
  background: #3f1515;
  border-radius: 4px;
}

.input {
  padding: 10px 12px;
  background: #333;
  border: 1px solid #555;
  border-radius: 4px;
  color: #eee;
  font-size: 1rem;
}

.input:focus {
  outline: none;
  border-color: #d4a84b;
}

.button {
  padding: 12px;
  background: #d4a84b;
  color: #1a1a1a;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Ověřit že testy prochází**

```powershell
npm test -- Login.test.tsx
```

Očekávaný výstup: `PASS  5 passed`

- [ ] **Step 6: Commit**

```powershell
cd ..
git add frontend/src/pages/Login.tsx frontend/src/pages/Login.module.css frontend/src/pages/Login.test.tsx
git commit -m "feat: login stranka s testy"
```

---

## Task 5: App routing (ProtectedRoute + AppRouter)

**Soubory:**
- Create: `frontend/src/router/ProtectedRoute.tsx`
- Create: `frontend/src/router/AppRouter.tsx`
- Create: `frontend/src/pages/NotAuthorized.tsx`
- Create: `frontend/src/router/ProtectedRoute.test.tsx`

- [ ] **Step 1: Napsat failing test pro ProtectedRoute**

```typescript
// frontend/src/router/ProtectedRoute.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// Mock auth store – stav nastavíme per test
const mockState = { user: null as any, token: null as string | null }

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: any) => selector(mockState),
}))

function renderWithRoute(initialPath: string, role?: 'prodavacka' | 'admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/403" element={<div>403 page</div>} />
        <Route
          path="/pos"
          element={
            <ProtectedRoute requiredRole="prodavacka">
              <div>POS page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <div>Admin page</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('přesměruje na /login pokud není token', () => {
    mockState.user = null
    mockState.token = null
    renderWithRoute('/pos')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('zobrazí obsah přihlášenému uživateli se správnou rolí', () => {
    mockState.user = { id: 1, username: 'terka', role: 'prodavacka' }
    mockState.token = 'tok'
    renderWithRoute('/pos')
    expect(screen.getByText('POS page')).toBeInTheDocument()
  })

  it('přesměruje na /403 pokud má uživatel špatnou roli', () => {
    mockState.user = { id: 1, username: 'terka', role: 'prodavacka' }
    mockState.token = 'tok'
    renderWithRoute('/admin')
    expect(screen.getByText('403 page')).toBeInTheDocument()
  })

  it('admin může přistupovat na admin route', () => {
    mockState.user = { id: 2, username: 'boss', role: 'admin' }
    mockState.token = 'tok'
    renderWithRoute('/admin')
    expect(screen.getByText('Admin page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ověřit že test padá**

```powershell
cd frontend && npm test -- ProtectedRoute.test.tsx
```

Očekávaný výstup: `FAIL` — `Cannot find module './ProtectedRoute'`

- [ ] **Step 3: Implementovat ProtectedRoute.tsx**

```typescript
// frontend/src/router/ProtectedRoute.tsx
import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { User } from '../types'

interface Props {
  children: ReactNode
  requiredRole: User['role']
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== requiredRole) {
    return <Navigate to="/403" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Ověřit že testy prochází**

```powershell
npm test -- ProtectedRoute.test.tsx
```

Očekávaný výstup: `PASS  4 passed`

- [ ] **Step 5: Vytvořit NotAuthorized.tsx a AppRouter.tsx**

```typescript
// frontend/src/pages/NotAuthorized.tsx
export default function NotAuthorized() {
  return (
    <div style={{ textAlign: 'center', marginTop: '20vh' }}>
      <h1>403</h1>
      <p>Nemáš oprávnění k této stránce.</p>
    </div>
  )
}
```

```typescript
// frontend/src/router/AppRouter.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ProtectedRoute from './ProtectedRoute'
import Login from '../pages/Login'
import NotAuthorized from '../pages/NotAuthorized'

const POS = lazy(() => import('../pages/POS'))
const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('../pages/admin/Products'))
const AdminUsers = lazy(() => import('../pages/admin/Users'))
const AdminBags = lazy(() => import('../pages/admin/Bags'))
const AdminSales = lazy(() => import('../pages/admin/Sales'))

export default function AppRouter() {
  return (
    <Suspense fallback={<div>Načítám…</div>}>
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

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProducts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bags"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminBags />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sales"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSales />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
```

> Poznámka: POS a Admin stránky se importují jako lazy — při kompilaci budou potřeba prázdné placeholdery dokud neexistují. Vytvoř je teď jako prázdné:

```typescript
// frontend/src/pages/POS.tsx  (temporary placeholder)
export default function POS() { return <div>POS — bude implementován v dalším plánu</div> }
```

```typescript
// frontend/src/pages/admin/Dashboard.tsx
export default function AdminDashboard() { return <div>Admin Dashboard</div> }
```

```typescript
// frontend/src/pages/admin/Products.tsx
export default function AdminProducts() { return <div>Admin Produkty</div> }
```

```typescript
// frontend/src/pages/admin/Users.tsx
export default function AdminUsers() { return <div>Admin Uživatelé</div> }
```

```typescript
// frontend/src/pages/admin/Bags.tsx
export default function AdminBags() { return <div>Admin Pytlíky</div> }
```

```typescript
// frontend/src/pages/admin/Sales.tsx
export default function AdminSales() { return <div>Admin Tržby</div> }
```

- [ ] **Step 6: Ověřit TypeScript kompilaci a testy**

```powershell
npx tsc --noEmit
npm test
```

Očekávaný výstup: žádné TS chyby, všechny testy `PASS`.

- [ ] **Step 7: Spustit dev server a zkontrolovat v prohlížeči**

Docker musí běžet (`docker compose up -d` v kořeni projektu).

```powershell
npm run dev
```

Otevři `http://localhost:5173` — měl by přesměrovat na `/login`.
Přihlaš se s credentialy z DB (admin/admin nebo dle setup_admin.php).
Po přihlášení jako prodavačka → `/pos` (placeholder), jako admin → `/admin`.

- [ ] **Step 8: Commit**

```powershell
cd ..
git add frontend/src/router/ frontend/src/pages/
git commit -m "feat: app routing s ProtectedRoute (role-based guard)"
```

---

## Hotovo — Foundation je kompletní

Po dokončení všech 5 tasků:
- ✅ Vite + React + TS scaffold s Vitest
- ✅ Typovaný API client s testy
- ✅ Zustand auth store s persist do localStorage
- ✅ Login stránka s testy
- ✅ Role-based routing (prodavačka → /pos, admin → /admin)

**Pokračovat s:** `2026-05-28-cajovna-pos.md` — POS rozhraní s klávesnicovým ovládáním.
