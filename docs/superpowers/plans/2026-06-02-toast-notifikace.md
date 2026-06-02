# Toast notifikace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nahradit inline `error`/`success` hlášky globálním plovoucím toast systémem (nahoře uprostřed, success auto-mizí po 3 s, chyby zůstanou do zavření křížkem, žádný layout shift).

**Architecture:** `ToastProvider` (React context) obalí appku v `App.tsx`, drží seznam toastů a auto-dismiss success. `useToast()` poskytuje `{ success, error }`. `ToastContainer` renderuje toasty přes `createPortal` do `document.body` (`position: fixed`). Stránky s feedbackem akcí přejdou z lokálního stavu na `toast.*`; validace formulářů (Login, Checkout) zůstává inline.

**Tech Stack:** React 19 + TypeScript + Vite, vitest + @testing-library/react, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-06-02-toast-notifikace-design.md`
**Větev:** `feat/edit-kategorie-pytliky` (toasty sahají do Items/Categories/Bags, které žijí jen tady).

---

## File Structure

**Nové soubory:**
- `frontend/src/components/toast/ToastProvider.tsx` — context, stav toastů, `addToast`/`removeToast`, auto-dismiss success.
- `frontend/src/components/toast/useToast.ts` — hook `{ success, error }`.
- `frontend/src/components/toast/ToastContainer.tsx` — portal render toastů + tlačítko ×.
- `frontend/src/components/toast/Toast.module.css` — styly.
- `frontend/src/components/toast/ToastProvider.test.tsx` — testy systému.
- `frontend/src/test/renderWithToast.tsx` — testovací helper obalující UI `ToastProvider`em.

**Modifikované soubory:**
- `frontend/src/App.tsx` — obalit `<AppRouter/>` `<ToastProvider>`.
- `frontend/src/pages/admin/Items.tsx` + `Items.test.tsx`
- `frontend/src/pages/admin/Categories.tsx` + `Categories.test.tsx`
- `frontend/src/pages/admin/Bags.tsx` + `Bags.test.tsx`
- `frontend/src/pages/admin/Users.tsx` + `Users.test.tsx`
- `frontend/src/pages/admin/Dashboard.tsx` (bez testu)
- `frontend/src/pages/admin/Sales.tsx` + `Sales.test.tsx`
- `frontend/src/pages/POS.tsx` + `POS.test.tsx`

**Beze změny:** `Login.tsx`, `components/pos/CheckoutDialog.tsx` (validace zůstává inline), `Products.tsx` (legacy, neroutováno).

**Konvence:** `npm`/`npx` z `frontend/`. Testy `npm run test` (NE `npx vitest`). `git` z rootu `/d/_FYKA/AI/Cajovna` v samostatném příkazu.

---

# FÁZE A — Toast systém

## Task 1: `ToastProvider` + `useToast`

**Files:**
- Create: `frontend/src/components/toast/ToastProvider.tsx`
- Create: `frontend/src/components/toast/useToast.ts`

- [ ] **Step 1: Vytvořit `ToastProvider.tsx`**

```tsx
import { createContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import ToastContainer from './ToastContainer'

export type ToastType = 'success' | 'error'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: number) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextValue | null>(null)

const SUCCESS_DURATION_MS = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current
      setToasts((prev) => [{ id, type, message }, ...prev]) // nejnovější nahoře
      if (type === 'success') {
        setTimeout(() => removeToast(id), SUCCESS_DURATION_MS)
      }
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}
```

- [ ] **Step 2: Vytvořit `useToast.ts`**

```ts
import { useContext } from 'react'
import { ToastContext } from './ToastProvider'

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return {
    success: (message: string) => ctx.addToast('success', message),
    error: (message: string) => ctx.addToast('error', message),
  }
}
```

- [ ] **Step 3: Commit** (typecheck zatím selže kvůli chybějícímu `ToastContainer` — commit až po Tasku 2; tady jen ulož rozpracované)

Pozn.: `ToastProvider` importuje `ToastContainer`, který vznikne v Tasku 2. Necommituj samostatně — pokračuj rovnou Taskem 2 a commitni společně.

---

## Task 2: `ToastContainer` + styly

**Files:**
- Create: `frontend/src/components/toast/ToastContainer.tsx`
- Create: `frontend/src/components/toast/Toast.module.css`

- [ ] **Step 1: Vytvořit `Toast.module.css`**

```css
.container {
  position: fixed;
  top: 16px;
  left: 0;
  right: 0;
  margin: 0 auto;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 240px;
  max-width: 90vw;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 0.9rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  animation: toastIn 0.18s ease-out;
}

.success {
  background: #1a3a1a;
  color: #a8e6a1;
  border-left: 3px solid #6abf69;
}

.error {
  background: #3a1a1a;
  color: #ffb4b4;
  border-left: 3px solid #ff6b6b;
}

.message {
  flex: 1;
}

.close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0;
  opacity: 0.7;
}

.close:hover {
  opacity: 1;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Vytvořit `ToastContainer.tsx`**

```tsx
import { createPortal } from 'react-dom'
import type { Toast } from './ToastProvider'
import styles from './Toast.module.css'

interface Props {
  toasts: Toast[]
  onClose: (id: number) => void
}

export default function ToastContainer({ toasts, onClose }: Props) {
  if (toasts.length === 0) return null

  return createPortal(
    <div className={styles.container}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.type === 'success' ? styles.success : styles.error}`}
          role="alert"
        >
          <span className={styles.message}>{t.message}</span>
          <button
            className={styles.close}
            onClick={() => onClose(t.id)}
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
```

- [ ] **Step 3: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/toast/
git commit -m "feat(toast): Add ToastProvider, useToast and ToastContainer"
```

---

## Task 3: Zapojit `ToastProvider` do `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Přepsat `App.tsx`**

```tsx
// frontend/src/App.tsx
import AppRouter from './router/AppRouter'
import { ToastProvider } from './components/toast/ToastProvider'

export default function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  )
}
```

- [ ] **Step 2: Ověřit typecheck + běh testů**

Run (z `frontend/`): `npx tsc -b && npm run test`
Expected: tsc bez chyb; všechny stávající testy PASS (105).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(toast): Wrap app in ToastProvider"
```

---

## Task 4: Testy toast systému + helper `renderWithToast`

**Files:**
- Create: `frontend/src/test/renderWithToast.tsx`
- Create: `frontend/src/components/toast/ToastProvider.test.tsx`

- [ ] **Step 1: Vytvořit helper `renderWithToast.tsx`**

```tsx
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { ToastProvider } from '../components/toast/ToastProvider'

export function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}
```

- [ ] **Step 2: Napsat testy `ToastProvider.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function Harness() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Uloženo')}>ok</button>
      <button onClick={() => toast.error('Chyba operace')}>err</button>
    </div>
  )
}

describe('ToastProvider / useToast', () => {
  it('success se zobrazí a po 3 s sám zmizí', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Harness />
        </ToastProvider>
      )
      fireEvent.click(screen.getByText('ok'))
      expect(screen.getByText('Uloženo')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.queryByText('Uloženo')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('error zůstane i po čase a zavře se křížkem', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Harness />
        </ToastProvider>
      )
      fireEvent.click(screen.getByText('err'))
      expect(screen.getByText('Chyba operace')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(screen.getByText('Chyba operace')).toBeInTheDocument() // pořád tu je
      fireEvent.click(screen.getByLabelText('Zavřít'))
      expect(screen.queryByText('Chyba operace')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('víc toastů se zobrazí současně (stohování)', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('err'))
    fireEvent.click(screen.getByText('err'))
    expect(screen.getAllByText('Chyba operace')).toHaveLength(2)
  })

  it('useToast mimo ToastProvider vyhodí chybu', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})
```

- [ ] **Step 3: Spustit testy**

Run (z `frontend/`): `npm run test -- src/components/toast/ToastProvider.test.tsx`
Expected: PASS (4 testy).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/toast/ToastProvider.test.tsx frontend/src/test/renderWithToast.tsx
git commit -m "test(toast): Add toast system tests and renderWithToast helper"
```

---

# FÁZE B — Integrace do stránek

Vzor pro každou stránku: přidat `import { useToast } from '../../components/toast/useToast'`, uvnitř komponenty `const toast = useToast()`, nahradit `setError(x)` → `toast.error(x)` a `setSuccess(x)` → `toast.success(x)`, odstranit lokální `error`/`success` state, jejich `setX(null)` clearing a inline `<p>`. Pak v testu nahradit `render(<Page/>)` za `renderWithToast(<Page/>)`.

## Task 5: Integrace `Items.tsx`

**Files:**
- Modify: `frontend/src/pages/admin/Items.tsx`
- Modify: `frontend/src/pages/admin/Items.test.tsx`

- [ ] **Step 1: Přidat import a hook do `Items.tsx`**

Přidat za řádek `import styles from './Items.module.css'`:

```tsx
import { useToast } from '../../components/toast/useToast'
```

Odstranit tyto dva řádky stavu:

```tsx
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
```

Přidat (za `const [categoryFilter, setCategoryFilter] = useState<number | null>(null)`):

```tsx
  const toast = useToast()
```

- [ ] **Step 2: Nahradit hlášky v handlerech `Items.tsx`**

`load()` catch — nahradit:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba načítání')
```
za:
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
```

`handleSaveCell` — nahradit blok:
```tsx
      setError(null)
      setSuccess('Záznam uložen')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
```
za:
```tsx
      toast.success('Záznam uložen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
```

`handleAdd` — nahradit:
```tsx
    if (categories.length === 0) {
      setError('Nejprve vytvořte kategorii')
      return
    }
```
za:
```tsx
    if (categories.length === 0) {
      toast.error('Nejprve vytvořte kategorii')
      return
    }
```
a dále v `handleAdd` nahradit `setShowInactive(false)` ponechat, ale `setError(null)` smazat a catch:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba vytváření')
```
za:
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba vytváření')
```

`handleToggleActive` — odstranit `setError(null)` a nahradit catch:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba')
```
za:
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba')
```

- [ ] **Step 3: Odstranit inline hlášky z JSX `Items.tsx`**

Odstranit řádek:
```tsx
      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}
```

(Nepoužité `.error`/`.success` styly v `Items.module.css` ponech — jsou neškodné.)

- [ ] **Step 4: Upravit `Items.test.tsx` na `renderWithToast`**

Přidat import (za `import Items from './Items'`):
```tsx
import { renderWithToast } from '../../test/renderWithToast'
```
Nahradit všechny výskyty `render(<Items />)` za `renderWithToast(<Items />)`.

- [ ] **Step 5: Ověřit**

Run (z `frontend/`): `npx tsc -b && npm run test -- src/pages/admin/Items.test.tsx`
Expected: tsc bez chyb; PASS (3 testy).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Items.tsx frontend/src/pages/admin/Items.test.tsx
git commit -m "feat(toast): Use toasts for feedback in Items page"
```

---

## Task 6: Integrace `Categories.tsx`

**Files:**
- Modify: `frontend/src/pages/admin/Categories.tsx`
- Modify: `frontend/src/pages/admin/Categories.test.tsx`

- [ ] **Step 1: Import + hook v `Categories.tsx`**

Přidat za `import styles from './Categories.module.css'`:
```tsx
import { useToast } from '../../components/toast/useToast'
```
Odstranit stav:
```tsx
  const [error, setError] = useState<string | null>(null)
```
Přidat za `const [saving, setSaving] = useState(false)`:
```tsx
  const toast = useToast()
```

- [ ] **Step 2: Nahradit hlášky v `Categories.tsx`**

V `load()` catch:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba načítání')
```
→
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
```

V `handleSaveCell` odstranit `setError(null)` a catch `setError(...)` → `toast.error(...)`:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba uložení')
```
→
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba uložení')
```

V `handleAdd` odstranit `setError(null)`, catch:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba vytváření')
```
→
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba vytváření')
```

V `handleDelete` odstranit `setError(null)`, catch:
```tsx
      setError(e instanceof Error ? e.message : 'Chyba mazání')
```
→
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba mazání')
```

- [ ] **Step 3: Odstranit inline `<p>` z JSX `Categories.tsx`**

Odstranit:
```tsx
      {error && <p className={styles.error}>{error}</p>}
```

- [ ] **Step 4: Upravit `Categories.test.tsx`**

Přidat import:
```tsx
import { renderWithToast } from '../../test/renderWithToast'
```
Nahradit `render(<Categories />)` → `renderWithToast(<Categories />)` ve všech testech.
Test `409 při mazání zobrazí chybu` zůstává — text se teď renderuje v toastu v `document.body`, `screen.findByText(/použita u čajů/i)` ho najde i v portálu.

- [ ] **Step 5: Ověřit**

Run (z `frontend/`): `npx tsc -b && npm run test -- src/pages/admin/Categories.test.tsx`
Expected: tsc bez chyb; PASS (5 testů).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Categories.tsx frontend/src/pages/admin/Categories.test.tsx
git commit -m "feat(toast): Use toasts for feedback in Categories page"
```

---

## Task 7: Integrace `Bags.tsx`

**Files:**
- Modify: `frontend/src/pages/admin/Bags.tsx`
- Modify: `frontend/src/pages/admin/Bags.test.tsx`

- [ ] **Step 1: Import + hook v `Bags.tsx`**

Přidat za `import styles from './Bags.module.css'`:
```tsx
import { useToast } from '../../components/toast/useToast'
```
Odstranit stav `const [error, setError] = useState<string | null>(null)`.
Přidat za `const [saving, setSaving] = useState(false)`:
```tsx
  const toast = useToast()
```

- [ ] **Step 2: Nahradit hlášky v `Bags.tsx`**

`load()` catch: `setError(... 'Chyba načítání')` → `toast.error(... 'Chyba načítání')`.
`handleSaveCell`: odstranit `setError(null)`, catch `setError(... 'Chyba uložení')` → `toast.error(...)`.
`handleAdd`: odstranit `setError(null)`, catch `setError(... 'Chyba vytváření')` → `toast.error(...)`.
`handleDelete`: odstranit `setError(null)`, catch `setError(... 'Chyba mazání')` → `toast.error(...)`.

(Vzor identický jako Categories Task 6 Step 2.)

- [ ] **Step 3: Odstranit inline `<p>` z JSX `Bags.tsx`**

Odstranit:
```tsx
      {error && <p className={styles.error}>{error}</p>}
```

- [ ] **Step 4: Upravit `Bags.test.tsx`**

Přidat import `renderWithToast` a nahradit `render(<Bags />)` → `renderWithToast(<Bags />)`.
Test `409 při mazání zobrazí chybu` zůstává (`screen.findByText(/použit v prodeji/i)` najde toast v portálu).

- [ ] **Step 5: Ověřit**

Run (z `frontend/`): `npx tsc -b && npm run test -- src/pages/admin/Bags.test.tsx`
Expected: tsc bez chyb; PASS (6 testů).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Bags.tsx frontend/src/pages/admin/Bags.test.tsx
git commit -m "feat(toast): Use toasts for feedback in Bags page"
```

---

## Task 8: Integrace `Users.tsx`

**Files:**
- Modify: `frontend/src/pages/admin/Users.tsx`
- Modify: `frontend/src/pages/admin/Users.test.tsx`

Pozn.: Validační/operační chyba **uvnitř formuláře** nového uživatele zůstává inline (uživatel ji vidí u formuláře). Do toastu jde jen **chyba mazání** (`handleDelete`).

- [ ] **Step 1: Import + hook v `Users.tsx`**

Přidat za `import styles from './Users.module.css'`:
```tsx
import { useToast } from '../../components/toast/useToast'
```
Přidat hook za `const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)`:
```tsx
  const toast = useToast()
```
(`error` state PONECHAT — používá ho formulář nového uživatele inline.)

- [ ] **Step 2: Nahradit chybu mazání v `handleDelete`**

Nahradit:
```tsx
  async function handleDelete(id: number) {
    try {
      await deleteUser(id)
      setConfirmDeleteId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba mazání')
    }
  }
```
za:
```tsx
  async function handleDelete(id: number) {
    try {
      await deleteUser(id)
      setConfirmDeleteId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chyba mazání')
    }
  }
```

(Chyba načítání v `load()` a chyba ve `handleCreate` zůstávají na `setError` — inline u formuláře/stránky.)

- [ ] **Step 3: Upravit `Users.test.tsx`**

Přidat import `renderWithToast` a nahradit `render(<Users />)` → `renderWithToast(<Users />)` ve všech testech.

- [ ] **Step 4: Ověřit**

Run (z `frontend/`): `npx tsc -b && npm run test -- src/pages/admin/Users.test.tsx`
Expected: tsc bez chyb; PASS (5 testů).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Users.tsx frontend/src/pages/admin/Users.test.tsx
git commit -m "feat(toast): Use toast for delete error in Users page"
```

---

## Task 9: Integrace `Dashboard.tsx` + `Sales.tsx`

**Files:**
- Modify: `frontend/src/pages/admin/Dashboard.tsx`
- Modify: `frontend/src/pages/admin/Sales.tsx`
- Modify: `frontend/src/pages/admin/Sales.test.tsx`

- [ ] **Step 1: `Dashboard.tsx`**

Přidat import (za poslední `import ... from './...css'`):
```tsx
import { useToast } from '../../components/toast/useToast'
```
Odstranit stav `const [error, setError] = useState<string | null>(null)` (řádek 74).
Přidat `const toast = useToast()` na začátek těla komponenty (za ostatní `useState`).
Nahradit `setError(null)` (řádek 87) — smazat.
Nahradit `setError(e instanceof Error ? e.message : 'Chyba načítání')` (řádek 98) →
```tsx
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
```
Odstranit z JSX (řádek 356): `{error && <p className={styles.error}>{error}</p>}`.

- [ ] **Step 2: `Sales.tsx`**

Přidat import:
```tsx
import { useToast } from '../../components/toast/useToast'
```
Odstranit stav `const [error, setError] = useState<string | null>(null)` (řádek 12).
Přidat `const toast = useToast()`.
Smazat `setError(null)` (řádek 16). Nahradit (řádek 21):
```tsx
      setError(err instanceof Error ? err.message : 'Chyba načítání')
```
→
```tsx
      toast.error(err instanceof Error ? err.message : 'Chyba načítání')
```
Odstranit z JSX (řádek 52): `{error && <p style={{ color: '#f87171' }}>{error}</p>}`.

- [ ] **Step 3: Upravit `Sales.test.tsx`**

Přidat import `renderWithToast` a nahradit `render(<Sales />)` → `renderWithToast(<Sales />)` ve všech testech.

- [ ] **Step 4: Ověřit**

Run (z `frontend/`): `npx tsc -b && npm run test -- src/pages/admin/Sales.test.tsx`
Expected: tsc bez chyb; PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/Dashboard.tsx frontend/src/pages/admin/Sales.tsx frontend/src/pages/admin/Sales.test.tsx
git commit -m "feat(toast): Use toasts for load errors in Dashboard and Sales"
```

---

## Task 10: `POS.tsx` — success toast po prodeji

**Files:**
- Modify: `frontend/src/pages/POS.tsx`
- Modify: `frontend/src/pages/POS.test.tsx`

Pozn.: `state.error` (řádek 110) je **fatální fallback celé stránky** — ponechat beze změny. Přidá se jen pozitivní toast po dokončení prodeje.

- [ ] **Step 1: Import + hook v `POS.tsx`**

Přidat import (za stávající importy):
```tsx
import { useToast } from '../components/toast/useToast'
```
Přidat `const toast = useToast()` do těla komponenty (vedle ostatních hooků, před `return`/early-returns — musí být volán bezpodmínečně, tedy nad `if (state.loading) return …`).

- [ ] **Step 2: Toast v `onSuccess`**

Nahradit:
```tsx
          onSuccess={() => {
            clearCart()
            setShowCheckout(false)
          }}
```
za:
```tsx
          onSuccess={() => {
            clearCart()
            setShowCheckout(false)
            toast.success('Prodej uložen')
          }}
```

- [ ] **Step 3: Upravit `POS.test.tsx`**

Přidat import `renderWithToast` (cesta `../test/renderWithToast`) a nahradit `render(<POS />)` → `renderWithToast(<POS />)` ve všech testech.

- [ ] **Step 4: Ověřit**

Run (z `frontend/`): `npx tsc -b && npm run test`
Expected: tsc bez chyb; **celá suite PASS**.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/POS.tsx frontend/src/pages/POS.test.tsx
git commit -m "feat(toast): Success toast after completed sale in POS"
```

---

## Finální ověření

- [ ] **Plná suite + typecheck**

Run (z `frontend/`): `npx tsc -b && npm run test`
Expected: tsc bez chyb; všechny testy PASS.

- [ ] **Manuální smoke test**

`docker compose up -d` + `npm run dev`. Ověřit, že napříč admin sekcemi se hlášky (uložení/smazání/chyba/409) zobrazují jako plovoucí toast nahoře uprostřed, success sám zmizí po ~3 s, chyba čeká na ×, a obsah stránky **neposkakuje**. Login a checkout validace zůstávají inline.

---

## Poznámky

- **Layout shift:** kontejner je `position: fixed` v portálu na `document.body` → nikdy neovlivní tok stránky.
- **Auto-dismiss vlastní provider:** `setTimeout` běží v provideru nad routami, takže přežije odmountování stránky.
- **Mimo rozsah:** `info`/`warning` typy, fronta s limitem, akční tlačítka v toastu, změna validace formulářů.
