# Mobilní POS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat mobilní touch-first POS na `/pos`; stávající klávesnicový POS přesunout na `/pos-desktop`.

**Architecture:** Nový `useMobilePOS` hook + komponenty v `components/pos-mobile/`. Sdílené utility (`PackagingOption`, `getPackagingOptions`, `getBagList`, `buildCartItem`) se extrahují z `usePOS.ts` do `posHelpers.ts`. Žádná změna backendu.

**Tech Stack:** React 19 + TypeScript, Vitest + @testing-library/react, Playwright, CSS Modules (OKLCH béžová paleta), Vite lazy imports.

---

## Soubory

### Nové
```
frontend/src/hooks/posHelpers.ts                  sdílené utility (extrahováno z usePOS)
frontend/src/hooks/useMobilePOS.ts                mobile hook (useState, 8 views)
frontend/src/hooks/useMobilePOS.test.ts           unit testy hooku (11 testů)
frontend/src/pages/MobilePOS.tsx                  orchestrátor stránky
frontend/src/pages/MobilePOS.module.css           CSS tokeny + slide animace
frontend/src/components/pos-mobile/MobileHeader.tsx
frontend/src/components/pos-mobile/MobileProgressBar.tsx
frontend/src/components/pos-mobile/MobileActionBar.tsx
frontend/src/components/pos-mobile/MobileHome.tsx
frontend/src/components/pos-mobile/MobileCategories.tsx
frontend/src/components/pos-mobile/MobileTeas.tsx
frontend/src/components/pos-mobile/MobilePackaging.tsx
frontend/src/components/pos-mobile/MobileQuantity.tsx
frontend/src/components/pos-mobile/MobileBags.tsx
frontend/src/components/pos-mobile/MobileCheckout.tsx
frontend/src/components/pos-mobile/MobileSuccess.tsx
e2e/mobile-pos-flow.spec.ts
```

### Upravené
```
frontend/src/hooks/usePOS.ts            importovat z posHelpers místo lokální definice
frontend/src/router/AppRouter.tsx       přidat /pos (MobilePOS) + /pos-desktop (POS)
frontend/src/pages/Login.tsx            redirect prodavačky na /pos
e2e/pos-flow.spec.ts                   URL /pos → /pos-desktop
```

---

## Task 1: Extrahovat posHelpers.ts

**Files:**
- Create: `frontend/src/hooks/posHelpers.ts`
- Modify: `frontend/src/hooks/usePOS.ts`

- [ ] **Krok 1: Vytvořit posHelpers.ts**

```typescript
// frontend/src/hooks/posHelpers.ts
import type { Tea, Bag, CartItem, ItemType } from '../types'

export type PackagingOption = { type: ItemType; label: string; weightG: number; price: number }

export function getPackagingOptions(tea: Tea): PackagingOption[] {
  const opts: PackagingOption[] = []
  if (tea.std_weight_g != null && tea.std_price_moc != null)
    opts.push({ type: 'std', label: `Std ${tea.std_weight_g}g`, weightG: tea.std_weight_g, price: tea.std_price_moc })
  if (tea.pkg1_weight_g != null && tea.pkg1_price_moc != null)
    opts.push({ type: 'pkg1', label: `Bal 1 ${tea.pkg1_weight_g}g`, weightG: tea.pkg1_weight_g, price: tea.pkg1_price_moc })
  if (tea.pkg2_weight_g != null && tea.pkg2_price_moc != null)
    opts.push({ type: 'pkg2', label: `Bal 2 ${tea.pkg2_weight_g}g`, weightG: tea.pkg2_weight_g, price: tea.pkg2_price_moc })
  return opts
}

export type BagListItem = { bag: Bag | null; label: string }

export function getBagList(bags: Bag[]): BagListItem[] {
  const sorted = [...bags].sort((a, b) =>
    a.surface_type.localeCompare(b.surface_type) || a.volume_ml - b.volume_ml
  )
  return [{ bag: null, label: 'Žádný' }, ...sorted.map(b => ({ bag: b, label: `${b.surface_type} ${b.volume_ml} ml` }))]
}

export function buildCartItem(tea: Tea, itemType: ItemType, quantity: number, bag: Bag | null): CartItem {
  const unitPrice =
    itemType === 'std' ? (tea.std_price_moc ?? 0)
    : itemType === 'pkg1' ? (tea.pkg1_price_moc ?? 0)
    : itemType === 'pkg2' ? (tea.pkg2_price_moc ?? 0)
    : 0
  return {
    localId: `${Date.now()}-${Math.random()}`,
    tea,
    itemType,
    weightG: null,
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    bag,
  }
}
```

- [ ] **Krok 2: Upravit usePOS.ts — importovat z posHelpers**

Nahraď v `usePOS.ts` (řádky 75–95) lokální definice importy:

```typescript
// přidej na začátek souboru (za existující importy)
import { getPackagingOptions, getBagList, buildCartItem, type PackagingOption, type BagListItem } from './posHelpers'
```

Smaž z `usePOS.ts` tyto lokální definice (jsou nyní v posHelpers):
- `export type PackagingOption = ...` (řádek 75)
- `export function getPackagingOptions(...)` (řádky 77–86)
- `export type BagListItem = ...` (řádek 88)
- `export function getBagList(...)` (řádky 90–95)
- `function buildCartItem(...)` (řádky 102–119)

Zachovej existující re-export v usePOS.ts pro zpětnou kompatibilitu (POS.tsx importuje z usePOS):
```typescript
export { getPackagingOptions, getBagList, type PackagingOption, type BagListItem } from './posHelpers'
```

- [ ] **Krok 3: Spustit testy**

```
cd frontend && npm run test
```

Očekávaný výsledek: všechny testy pass (stejný počet jako před změnou).

- [ ] **Krok 4: Commit**

```
git add frontend/src/hooks/posHelpers.ts frontend/src/hooks/usePOS.ts
git commit -m "refactor(pos): extrahovat posHelpers.ts ze usePOS (PackagingOption, getBagList, buildCartItem)"
```

---

## Task 2: Routing + Login redirect + E2E URL

**Files:**
- Modify: `frontend/src/router/AppRouter.tsx`
- Modify: `frontend/src/pages/Login.tsx:27`
- Modify: `e2e/pos-flow.spec.ts`

- [ ] **Krok 1: Upravit AppRouter.tsx**

Přidej lazy import pro MobilePOS a přejmenuj route:

```typescript
// přidej za existující lazy importy
const MobilePOS = lazy(() => import('../pages/MobilePOS'))
```

Změň routes blok — `/pos` → `MobilePOS`, přidej `/pos-desktop` → `POS`:

```typescript
<Route
  path="/pos"
  element={
    <ProtectedRoute requiredRole="prodavacka">
      <MobilePOS />
    </ProtectedRoute>
  }
/>

<Route
  path="/pos-desktop"
  element={
    <ProtectedRoute requiredRole="prodavacka">
      <POS />
    </ProtectedRoute>
  }
/>
```

- [ ] **Krok 2: Vytvořit stub MobilePOS.tsx (placeholder dokud není hotová stránka)**

```typescript
// frontend/src/pages/MobilePOS.tsx
export default function MobilePOS() {
  return <div style={{ padding: 32, color: '#666' }}>Mobilní POS — připravuji se…</div>
}
```

- [ ] **Krok 3: Upravit Login.tsx řádek 27 — redirect na /pos**

```typescript
navigate(user.role === 'admin' ? '/admin' : '/pos', { replace: true })
```

(Tato hodnota je již `/pos` — žádná změna nutná. Ověř, že tam opravdu je `/pos`.)

- [ ] **Krok 4: Upravit e2e/pos-flow.spec.ts — URL /pos → /pos-desktop**

Nahraď všechny výskyty `'/pos'` za `'/pos-desktop'` v `e2e/pos-flow.spec.ts`. Typicky jde o řádky s `goto('/pos')` nebo `waitForURL('/pos')`.

- [ ] **Krok 5: Spustit testy**

```
cd frontend && npm run test
```

Všechny pass. E2E testy není potřeba spouštět teď.

- [ ] **Krok 6: Commit**

```
git add frontend/src/router/AppRouter.tsx frontend/src/pages/MobilePOS.tsx e2e/pos-flow.spec.ts
git commit -m "feat(mobile-pos): routing /pos→MobilePOS, /pos-desktop→POS, oprava E2E URL"
```

---

## Task 3: Hook useMobilePOS (TDD)

**Files:**
- Create: `frontend/src/hooks/useMobilePOS.test.ts`
- Create: `frontend/src/hooks/useMobilePOS.ts`

- [ ] **Krok 1: Napsat testy (useMobilePOS.test.ts)**

```typescript
// frontend/src/hooks/useMobilePOS.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useMobilePOS } from './useMobilePOS'
import * as productsApi from '../api/products'
import * as bagsApi from '../api/bags'
import * as salesApi from '../api/sales'

vi.mock('../api/products')
vi.mock('../api/bags')
vi.mock('../api/sales')

const mockCat = { id: 1, name: 'Zelené čaje' }
const mockTea = {
  id: 1, category_id: 1, name: 'Sencha', note: null, flag: 'active' as const,
  origin: null, std_weight_g: 100, std_price_moc: 120,
  pkg1_weight_g: null, pkg1_price_moc: null, pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 10, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 1,
}
const mockBag = { id: 1, surface_type: 'Papír', volume_ml: 500, dimensions: null, price_per_piece: 2, active: 1 }

beforeEach(() => {
  vi.mocked(productsApi.getCategories).mockResolvedValue([mockCat])
  vi.mocked(productsApi.getProducts).mockResolvedValue([mockTea])
  vi.mocked(bagsApi.getBags).mockResolvedValue([mockBag])
  vi.mocked(salesApi.createSale).mockResolvedValue({ sale_id: 1, total: 120 })
})

describe('useMobilePOS', () => {
  test('starts at home, loads data', async () => {
    const { result } = renderHook(() => useMobilePOS())
    expect(result.current.view).toBe('home')
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.categories).toHaveLength(1)
    expect(result.current.bagList).toHaveLength(2) // Žádný + Papír 500ml
  })

  test('selectCategory → teas view, filtruje čaje', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    expect(result.current.view).toBe('teas')
    expect(result.current.teas).toHaveLength(1)
    expect(result.current.teas[0].name).toBe('Sencha')
  })

  test('selectTea → packaging view, selectedPackaging nastaven', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    expect(result.current.view).toBe('packaging')
    expect(result.current.selectedTea).toBe(mockTea)
    expect(result.current.selectedPackaging?.type).toBe('std')
  })

  test('selectPackaging → quantity view', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    expect(result.current.view).toBe('quantity')
  })

  test('selectQuantity → bags view, quantity nastaven', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(3))
    expect(result.current.view).toBe('bags')
    expect(result.current.quantity).toBe(3)
  })

  test('selectBag(null) → přidá do košíku, home, resetuje výběr', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(2))
    act(() => result.current.selectBag(null))
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].totalPrice).toBe(240)
    expect(result.current.selectedTea).toBeNull()
  })

  test('removeFromCart odstraní správnou položku', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    const id = result.current.cart[0].localId
    act(() => result.current.removeFromCart(id))
    expect(result.current.cart).toHaveLength(0)
  })

  test('goBack z teas → categories', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('categories')
  })

  test('goBack z home → zůstane home', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('home')
  })

  test('goBack z checkout → home', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.startCheckout())
    act(() => result.current.goBack())
    expect(result.current.view).toBe('home')
  })

  test('confirmCheckout volá createSale, přejde na success', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(salesApi.createSale).toHaveBeenCalledOnce()
    expect(result.current.view).toBe('success')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.lastTotal).toBe(120)
  })

  test('confirmCheckout na API chybě nastaví checkoutError', async () => {
    vi.mocked(salesApi.createSale).mockRejectedValueOnce(new Error('Server error'))
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(result.current.view).toBe('checkout')
    expect(result.current.checkoutError).toBe('Server error')
  })

  test('newSale resetuje košík a výběry', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    act(() => result.current.newSale())
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCategory).toBeNull()
  })
})
```

- [ ] **Krok 2: Spustit testy — musí FAILOVAT**

```
cd frontend && npm run test -- useMobilePOS
```

Očekávaný výsledek: FAIL (modul neexistuje).

- [ ] **Krok 3: Implementovat useMobilePOS.ts**

```typescript
// frontend/src/hooks/useMobilePOS.ts
import { useState, useEffect } from 'react'
import type { Category, Tea, Bag, CartItem, SalePayload } from '../types'
import { getCategories, getProducts } from '../api/products'
import { getBags } from '../api/bags'
import { createSale } from '../api/sales'
import { getPackagingOptions, getBagList, buildCartItem, type PackagingOption, type BagListItem } from './posHelpers'

export type MobileView = 'home' | 'categories' | 'teas' | 'packaging' | 'quantity' | 'bags' | 'checkout' | 'success'

export const VIEW_ORDER: MobileView[] = [
  'home', 'categories', 'teas', 'packaging', 'quantity', 'bags', 'checkout', 'success',
]

export const QUANTITY_OPTIONS = [1, 2, 3, 5, 10, 20]

export { type PackagingOption, type BagListItem }

export function useMobilePOS() {
  const [view, setView] = useState<MobileView>('home')
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [allTeas, setAllTeas] = useState<Tea[]>([])
  const [bagStore, setBagStore] = useState<Bag[]>([])
  const [teas, setTeas] = useState<Tea[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedTea, setSelectedTea] = useState<Tea | null>(null)
  const [selectedPackaging, setSelectedPackaging] = useState<PackagingOption | null>(null)
  const [quantity, setQuantityState] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [lastTotal, setLastTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getCategories(), getProducts(), getBags()])
      .then(([cats, teas, bags]) => {
        setAllCategories([...cats].sort((a, b) => a.id - b.id))
        setAllTeas(teas)
        setBagStore(bags)
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Chyba načítání dat')
        setLoading(false)
      })
  }, [])

  function selectCategory(cat: Category) {
    setSelectedCategory(cat)
    setTeas(allTeas.filter((t) => t.category_id === cat.id))
    setView('teas')
  }

  function selectTea(tea: Tea) {
    setSelectedTea(tea)
    setSelectedPackaging(getPackagingOptions(tea)[0] ?? null)
    setView('packaging')
  }

  function selectPackaging(pkg: PackagingOption) {
    setSelectedPackaging(pkg)
    setView('quantity')
  }

  function selectQuantity(n: number) {
    setQuantityState(n)
    setView('bags')
  }

  function selectBag(bag: Bag | null) {
    if (!selectedTea || !selectedPackaging) return
    const item = buildCartItem(selectedTea, selectedPackaging.type, quantity, bag)
    setCart((prev) => [...prev, item])
    setSelectedTea(null)
    setSelectedPackaging(null)
    setQuantityState(1)
    setView('home')
  }

  function removeFromCart(localId: string) {
    setCart((prev) => prev.filter((i) => i.localId !== localId))
  }

  function goBack() {
    if (view === 'checkout') { setView('home'); return }
    const idx = VIEW_ORDER.indexOf(view)
    if (idx <= 0) return
    setView(VIEW_ORDER[idx - 1])
  }

  function startCheckout() {
    setCheckoutError(null)
    setView('checkout')
  }

  async function confirmCheckout() {
    setCheckoutError(null)
    try {
      const total = cart.reduce((sum, i) => sum + i.totalPrice, 0)
      const payload: SalePayload = {
        items: cart.flatMap((item) => {
          const rows: SalePayload['items'] = [{
            tea_id: item.tea.id,
            bag_id: null,
            item_type: item.itemType,
            weight_g: item.weightG,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
            note: null,
          }]
          if (item.bag) {
            rows.push({
              tea_id: null,
              bag_id: item.bag.id,
              item_type: 'bag',
              weight_g: null,
              quantity: item.quantity,
              unit_price: item.bag.price_per_piece,
              total_price: item.bag.price_per_piece * item.quantity,
              note: null,
            })
          }
          return rows
        }),
        note: null,
      }
      await createSale(payload)
      setLastTotal(total)
      setCart([])
      setView('success')
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    }
  }

  function goToCategories() {
    setView('categories')
  }

  function newSale() {
    setCart([])
    setSelectedCategory(null)
    setSelectedTea(null)
    setSelectedPackaging(null)
    setQuantityState(1)
    setView('home')
  }

  return {
    view,
    categories: allCategories,
    teas,
    bagList: getBagList(bagStore),
    selectedCategory,
    selectedTea,
    selectedPackaging,
    quantity,
    cart,
    lastTotal,
    loading,
    error,
    checkoutError,
    selectCategory,
    selectTea,
    selectPackaging,
    selectQuantity,
    selectBag,
    removeFromCart,
    goBack,
    goToCategories,
    startCheckout,
    confirmCheckout,
    newSale,
  }
}
```

- [ ] **Krok 4: Spustit testy — musí PASS**

```
cd frontend && npm run test -- useMobilePOS
```

Očekávaný výsledek: 11/11 pass.

- [ ] **Krok 5: Commit**

```
git add frontend/src/hooks/useMobilePOS.ts frontend/src/hooks/useMobilePOS.test.ts
git commit -m "feat(mobile-pos): hook useMobilePOS — 8 views, cart, checkout (11 testů)"
```

---

## Task 4: CSS tokeny + layout

**Files:**
- Create: `frontend/src/pages/MobilePOS.module.css`

- [ ] **Krok 1: Vytvořit MobilePOS.module.css**

```css
/* frontend/src/pages/MobilePOS.module.css */

.root {
  --mob-bg:           oklch(93% 0.025 68);
  --mob-surface:      oklch(97% 0.018 70);
  --mob-surface-alt:  oklch(89% 0.032 66);
  --mob-fg:           oklch(20% 0.06 32);
  --mob-fg-2:         oklch(36% 0.07 34);
  --mob-muted:        oklch(54% 0.055 38);
  --mob-border:       oklch(83% 0.035 64);
  --mob-border-strong: oklch(72% 0.048 58);
  --mob-accent:       oklch(36% 0.11 28);
  --mob-accent-mid:   oklch(50% 0.10 30);
  --mob-accent-bg:    oklch(90% 0.04 52);
  --mob-success:      oklch(46% 0.13 148);
  --mob-success-bg:   oklch(91% 0.05 132);
  --mob-danger:       oklch(50% 0.15 22);
  --mob-danger-bg:    oklch(93% 0.04 20);
  --mob-r:            12px;
  --mob-r-sm:         8px;
  --mob-r-lg:         16px;

  background: var(--mob-bg);
  color: var(--mob-fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 15px;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
}

.frame {
  width: 100%;
  max-width: 430px;
  position: relative;
  overflow: hidden;
  min-height: 100dvh;
  background: var(--mob-bg);
}

.view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--mob-bg);
}

.scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 16px 16px;
}

/* Slide animace */
.slideFwd {
  animation: slideFwd 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

.slideBack {
  animation: slideBack 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes slideFwd {
  from { transform: translateX(100%); opacity: 0.7; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes slideBack {
  from { transform: translateX(-30%); opacity: 0.7; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* Loading / error stav */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  color: var(--mob-muted);
  font-size: 14px;
}
```

- [ ] **Krok 2: Commit**

```
git add frontend/src/pages/MobilePOS.module.css
git commit -m "feat(mobile-pos): CSS tokeny a slide animace (béžová OKLCH paleta)"
```

---

## Task 5: Sdílené sub-komponenty

**Files:**
- Create: `frontend/src/components/pos-mobile/MobileHeader.tsx`
- Create: `frontend/src/components/pos-mobile/MobileProgressBar.tsx`
- Create: `frontend/src/components/pos-mobile/MobileActionBar.tsx`

Všechny tři sdílejí CSS proměnné z `.root` v `MobilePOS.module.css` (jsou renderovány uvnitř `.root` divu).

- [ ] **Krok 1: MobileHeader.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileHeader.tsx
import styles from './MobileHeader.module.css'

interface Props {
  title: string
  subtitle?: string
  cartCount: number
  onBack?: () => void   // undefined = žádné tlačítko zpět (home view)
}

export default function MobileHeader({ title, subtitle, cartCount, onBack }: Props) {
  return (
    <header className={styles.hdr}>
      <div className={styles.left}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="Zpět">
            ‹
          </button>
        )}
      </div>
      <div className={styles.center}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.sub}>{subtitle}</span>}
      </div>
      <div className={styles.right}>
        {cartCount > 0 && (
          <span className={styles.badge}>{cartCount}</span>
        )}
      </div>
    </header>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileHeader.module.css */
.hdr {
  display: flex;
  align-items: center;
  padding: calc(env(safe-area-inset-top) + 10px) 16px 10px;
  background: var(--mob-surface);
  border-bottom: 1px solid var(--mob-border);
  gap: 8px;
  flex-shrink: 0;
}
.left, .right { width: 40px; flex-shrink: 0; }
.right { display: flex; justify-content: flex-end; }
.center { flex: 1; display: flex; flex-direction: column; align-items: center; }
.title { font-size: 16px; font-weight: 600; color: var(--mob-fg); }
.sub { font-size: 11px; color: var(--mob-muted); margin-top: 1px; }
.backBtn {
  font-size: 24px; color: var(--mob-accent); background: none; border: none;
  cursor: pointer; padding: 0 4px; line-height: 1;
}
.backBtn:active { opacity: 0.6; }
.badge {
  background: var(--mob-accent); color: #fff;
  font-size: 12px; font-weight: 700;
  border-radius: 999px; padding: 2px 7px; min-width: 20px; text-align: center;
}
```

- [ ] **Krok 2: MobileProgressBar.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileProgressBar.tsx
import type { MobileView } from '../../hooks/useMobilePOS'
import styles from './MobileProgressBar.module.css'

const STEPS: MobileView[] = ['categories', 'teas', 'packaging', 'quantity', 'bags']

interface Props { view: MobileView }

export default function MobileProgressBar({ view }: Props) {
  const currentIdx = STEPS.indexOf(view)
  if (currentIdx === -1) return null  // home, checkout, success — bar se nezobrazí
  return (
    <div className={styles.bar}>
      {STEPS.map((step, i) => (
        <div
          key={step}
          className={`${styles.seg} ${i < currentIdx ? styles.done : ''} ${i === currentIdx ? styles.active : ''}`}
        />
      ))}
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileProgressBar.module.css */
.bar { display: flex; gap: 3px; padding: 6px 16px 0; flex-shrink: 0; }
.seg { flex: 1; height: 3px; border-radius: 2px; background: var(--mob-border); transition: background 0.2s; }
.done { background: var(--mob-accent-mid); }
.active { background: var(--mob-accent); }
```

- [ ] **Krok 3: MobileActionBar.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileActionBar.tsx
import styles from './MobileActionBar.module.css'

interface Props {
  primary?: { label: string; onClick: () => void; disabled?: boolean }
  secondary?: { label: string; onClick: () => void }
}

export default function MobileActionBar({ primary, secondary }: Props) {
  return (
    <div className={styles.bar}>
      {secondary && (
        <button className={styles.secondary} onClick={secondary.onClick}>
          {secondary.label}
        </button>
      )}
      {primary && (
        <button className={styles.primary} onClick={primary.onClick} disabled={primary.disabled}>
          {primary.label}
        </button>
      )}
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileActionBar.module.css */
.bar {
  display: flex; gap: 10px;
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 12px);
  background: var(--mob-surface); border-top: 1px solid var(--mob-border);
  flex-shrink: 0;
}
.primary {
  flex: 1; padding: 14px; border-radius: var(--mob-r); border: none;
  background: var(--mob-accent); color: #fff; font-size: 16px; font-weight: 600;
  cursor: pointer;
}
.primary:active:not(:disabled) { transform: scale(0.985); opacity: 0.85; }
.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.secondary {
  flex: 1; padding: 14px; border-radius: var(--mob-r);
  background: var(--mob-surface-alt); color: var(--mob-fg-2);
  border: 1px solid var(--mob-border); font-size: 15px; cursor: pointer;
}
.secondary:active { transform: scale(0.985); opacity: 0.85; }
```

- [ ] **Krok 4: Spustit testy**

```
cd frontend && npm run test
```

Všechny pass.

- [ ] **Krok 5: Commit**

```
git add frontend/src/components/pos-mobile/
git commit -m "feat(mobile-pos): sdílené sub-komponenty (MobileHeader, MobileProgressBar, MobileActionBar)"
```

---

## Task 6: MobileHome + MobileSuccess

**Files:**
- Create: `frontend/src/components/pos-mobile/MobileHome.tsx` + `.module.css`
- Create: `frontend/src/components/pos-mobile/MobileSuccess.tsx` + `.module.css`

- [ ] **Krok 1: MobileHome.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileHome.tsx
import type { CartItem } from '../../types'
import styles from './MobileHome.module.css'

interface Props {
  cart: CartItem[]
  onAddItem: () => void
  onCheckout: () => void
  onRemove: (localId: string) => void
}

export default function MobileHome({ cart, onAddItem, onCheckout, onRemove }: Props) {
  const total = cart.reduce((s, i) => s + i.totalPrice, 0)

  return (
    <>
      <div className={styles.scroll}>
        {cart.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyChar}>茶</span>
            <p>Košík je prázdný. Přidejte první položku.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {cart.map((item) => (
              <li key={item.localId} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.tea.name}</span>
                  <span className={styles.itemDetail}>
                    {item.quantity}× · {item.unitPrice} Kč/{item.quantity > 1 ? 'ks' : 'ks'}
                  </span>
                </div>
                <span className={styles.itemPrice}>{item.totalPrice} Kč</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => onRemove(item.localId)}
                  aria-label="Odstranit"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <div className={styles.totalRow}>
          <span>Celkem</span>
          <span className={styles.totalAmt}>{total.toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.addBtn} onClick={onAddItem}>+ Přidat položku</button>
        {cart.length > 0 && (
          <button className={styles.checkoutBtn} onClick={onCheckout}>
            Zaúčtovat prodej →
          </button>
        )}
      </div>
    </>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileHome.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 8px 0; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 60px 32px; color: var(--mob-muted); text-align: center; }
.emptyChar { font-size: 64px; opacity: 0.22; line-height: 1; margin-bottom: 16px; }
.list { list-style: none; padding: 0 16px; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.item { display: flex; align-items: center; gap: 10px; background: var(--mob-surface); border-radius: var(--mob-r); padding: 12px 14px; }
.itemInfo { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.itemName { font-weight: 600; font-size: 15px; }
.itemDetail { font-size: 12px; color: var(--mob-muted); }
.itemPrice { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600; white-space: nowrap; }
.removeBtn { color: var(--mob-danger); background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px; }
.removeBtn:active { opacity: 0.6; }
.totalRow { display: flex; justify-content: space-between; padding: 12px 16px; border-top: 1px solid var(--mob-border); font-size: 15px; }
.totalAmt { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-weight: 700; font-size: 18px; }
.actions { display: flex; flex-direction: column; gap: 8px; padding: 8px 16px calc(env(safe-area-inset-bottom) + 12px); }
.addBtn { padding: 14px; border-radius: var(--mob-r); background: var(--mob-surface-alt); border: 1px solid var(--mob-border); color: var(--mob-accent); font-size: 15px; font-weight: 600; cursor: pointer; }
.addBtn:active { transform: scale(0.985); }
.checkoutBtn { padding: 14px; border-radius: var(--mob-r); background: var(--mob-accent); color: #fff; border: none; font-size: 16px; font-weight: 600; cursor: pointer; }
.checkoutBtn:active { transform: scale(0.985); opacity: 0.9; }
```

- [ ] **Krok 2: MobileSuccess.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileSuccess.tsx
import styles from './MobileSuccess.module.css'

interface Props {
  total: number
  onNewSale: () => void
}

export default function MobileSuccess({ total, onNewSale }: Props) {
  const now = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className={styles.wrap}>
      <div className={styles.circle}>✓</div>
      <h2 className={styles.title}>Prodej zaúčtován</h2>
      <p className={styles.sub}>Platba přijata · {now}</p>
      <p className={styles.amount}>{total.toLocaleString('cs-CZ')} Kč</p>
      <button className={styles.btn} onClick={onNewSale}>Nový prodej</button>
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileSuccess.module.css */
.wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; gap: 12px; }
.circle { width: 72px; height: 72px; border-radius: 50%; background: var(--mob-success-bg); color: var(--mob-success); font-size: 36px; display: flex; align-items: center; justify-content: center; }
.title { font-size: 22px; font-weight: 700; margin: 0; }
.sub { font-size: 13px; color: var(--mob-muted); margin: 0; }
.amount { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-size: 32px; font-weight: 700; margin: 8px 0; }
.btn { margin-top: 16px; padding: 14px 32px; border-radius: var(--mob-r); background: var(--mob-accent); color: #fff; border: none; font-size: 16px; font-weight: 600; cursor: pointer; }
.btn:active { transform: scale(0.985); }
```

- [ ] **Krok 3: Commit**

```
git add frontend/src/components/pos-mobile/MobileHome.tsx frontend/src/components/pos-mobile/MobileHome.module.css frontend/src/components/pos-mobile/MobileSuccess.tsx frontend/src/components/pos-mobile/MobileSuccess.module.css
git commit -m "feat(mobile-pos): MobileHome (košík) a MobileSuccess komponenty"
```

---

## Task 7: MobileCategories + MobileTeas

**Files:**
- Create: `frontend/src/components/pos-mobile/MobileCategories.tsx` + `.module.css`
- Create: `frontend/src/components/pos-mobile/MobileTeas.tsx` + `.module.css`

- [ ] **Krok 1: MobileCategories.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileCategories.tsx
import type { Category } from '../../types'
import styles from './MobileCategories.module.css'

interface Props {
  categories: Category[]
  onSelect: (cat: Category) => void
}

export default function MobileCategories({ categories, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {categories.map((cat) => (
          <button key={cat.id} className={styles.card} onClick={() => onSelect(cat)}>
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileCategories.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 16px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.card {
  padding: 18px 12px; border-radius: var(--mob-r); background: var(--mob-surface);
  border: 1px solid var(--mob-border); color: var(--mob-fg);
  font-size: 14px; font-weight: 500; text-align: center; cursor: pointer;
  min-height: 72px; display: flex; align-items: center; justify-content: center;
}
.card:active { background: var(--mob-accent-bg); border-color: var(--mob-accent); transform: scale(0.97); }
```

- [ ] **Krok 2: MobileTeas.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileTeas.tsx
import type { Tea } from '../../types'
import styles from './MobileTeas.module.css'

interface Props {
  teas: Tea[]
  categoryName: string
  onSelect: (tea: Tea) => void
}

export default function MobileTeas({ teas, categoryName, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      {teas.length === 0 && (
        <p className={styles.empty}>Žádné čaje v kategorii {categoryName}.</p>
      )}
      <ul className={styles.list}>
        {teas.map((tea) => (
          <li key={tea.id}>
            <button className={styles.row} onClick={() => onSelect(tea)}>
              <div className={styles.info}>
                <span className={styles.name}>{tea.name}</span>
                {tea.note && <span className={styles.note}>{tea.note}</span>}
              </div>
              {tea.std_price_moc != null && (
                <span className={styles.price}>{tea.std_price_moc} Kč</span>
              )}
              <span className={styles.arrow}>›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileTeas.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 8px 16px; }
.empty { padding: 32px 0; color: var(--mob-muted); text-align: center; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1px; }
.row {
  display: flex; align-items: center; gap: 10px; width: 100%;
  background: var(--mob-surface); border: none; padding: 14px 12px;
  border-radius: var(--mob-r-sm); cursor: pointer; text-align: left;
}
.row:active { background: var(--mob-accent-bg); transform: scale(0.99); }
.info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.name { font-size: 15px; font-weight: 500; color: var(--mob-fg); }
.note { font-size: 12px; color: var(--mob-muted); }
.price { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-size: 13px; color: var(--mob-fg-2); white-space: nowrap; }
.arrow { font-size: 20px; color: var(--mob-muted); }
```

- [ ] **Krok 3: Commit**

```
git add frontend/src/components/pos-mobile/MobileCategories.tsx frontend/src/components/pos-mobile/MobileCategories.module.css frontend/src/components/pos-mobile/MobileTeas.tsx frontend/src/components/pos-mobile/MobileTeas.module.css
git commit -m "feat(mobile-pos): MobileCategories a MobileTeas komponenty"
```

---

## Task 8: MobilePackaging + MobileQuantity + MobileBags

**Files:**
- Create: `frontend/src/components/pos-mobile/MobilePackaging.tsx` + `.module.css`
- Create: `frontend/src/components/pos-mobile/MobileQuantity.tsx` + `.module.css`
- Create: `frontend/src/components/pos-mobile/MobileBags.tsx` + `.module.css`

- [ ] **Krok 1: MobilePackaging.tsx**

```typescript
// frontend/src/components/pos-mobile/MobilePackaging.tsx
import type { PackagingOption } from '../../hooks/posHelpers'
import styles from './MobilePackaging.module.css'

interface Props {
  options: PackagingOption[]
  selected: PackagingOption | null
  onSelect: (pkg: PackagingOption) => void
}

export default function MobilePackaging({ options, selected, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <ul className={styles.list}>
        {options.map((pkg) => (
          <li key={pkg.type}>
            <button
              className={`${styles.row} ${selected?.type === pkg.type ? styles.active : ''}`}
              onClick={() => onSelect(pkg)}
            >
              <div className={styles.info}>
                <span className={styles.label}>{pkg.label}</span>
                <span className={styles.weight}>{pkg.weightG} g</span>
              </div>
              <span className={styles.price}>{pkg.price} Kč</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobilePackaging.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 8px 16px; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.row {
  display: flex; align-items: center; width: 100%; gap: 12px;
  background: var(--mob-surface); border: 1px solid var(--mob-border);
  border-radius: var(--mob-r); padding: 14px 16px; cursor: pointer; text-align: left;
}
.row:active { transform: scale(0.99); background: var(--mob-accent-bg); }
.active { border-color: var(--mob-accent); background: var(--mob-accent-bg); }
.info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.label { font-size: 15px; font-weight: 500; color: var(--mob-fg); }
.weight { font-size: 12px; color: var(--mob-muted); }
.price { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-weight: 600; font-size: 15px; }
```

- [ ] **Krok 2: MobileQuantity.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileQuantity.tsx
import { QUANTITY_OPTIONS } from '../../hooks/useMobilePOS'
import type { PackagingOption } from '../../hooks/posHelpers'
import styles from './MobileQuantity.module.css'

interface Props {
  packaging: PackagingOption
  onSelect: (n: number) => void
}

export default function MobileQuantity({ packaging, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {QUANTITY_OPTIONS.map((n) => (
          <button key={n} className={styles.btn} onClick={() => onSelect(n)}>
            <span className={styles.num}>{n}</span>
            <span className={styles.unit}>ks</span>
            <span className={styles.price}>{(packaging.price * n).toLocaleString('cs-CZ')} Kč</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileQuantity.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 16px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--mob-surface); border: 1px solid var(--mob-border);
  border-radius: var(--mob-r); padding: 14px 8px; cursor: pointer;
}
.btn:active { background: var(--mob-accent-bg); border-color: var(--mob-accent); transform: scale(0.97); }
.num { font-size: 22px; font-weight: 700; color: var(--mob-fg); }
.unit { font-size: 11px; color: var(--mob-muted); }
.price { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-size: 12px; color: var(--mob-accent); margin-top: 2px; }
```

- [ ] **Krok 3: MobileBags.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileBags.tsx
import type { Bag } from '../../types'
import type { BagListItem } from '../../hooks/posHelpers'
import styles from './MobileBags.module.css'

interface Props {
  bagList: BagListItem[]
  onSelect: (bag: Bag | null) => void
}

export default function MobileBags({ bagList, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {bagList.map((item, i) => (
          <button key={i} className={styles.btn} onClick={() => onSelect(item.bag)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileBags.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 16px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.btn {
  padding: 18px 10px; border-radius: var(--mob-r); background: var(--mob-surface);
  border: 1px solid var(--mob-border); color: var(--mob-fg);
  font-size: 14px; font-weight: 500; text-align: center; cursor: pointer;
  min-height: 72px; display: flex; align-items: center; justify-content: center;
}
.btn:active { background: var(--mob-accent-bg); border-color: var(--mob-accent); transform: scale(0.97); }
```

- [ ] **Krok 4: Commit**

```
git add frontend/src/components/pos-mobile/MobilePackaging.tsx frontend/src/components/pos-mobile/MobilePackaging.module.css frontend/src/components/pos-mobile/MobileQuantity.tsx frontend/src/components/pos-mobile/MobileQuantity.module.css frontend/src/components/pos-mobile/MobileBags.tsx frontend/src/components/pos-mobile/MobileBags.module.css
git commit -m "feat(mobile-pos): MobilePackaging, MobileQuantity, MobileBags komponenty"
```

---

## Task 9: MobileCheckout

**Files:**
- Create: `frontend/src/components/pos-mobile/MobileCheckout.tsx` + `.module.css`

- [ ] **Krok 1: MobileCheckout.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileCheckout.tsx
import type { CartItem } from '../../types'
import styles from './MobileCheckout.module.css'

interface Props {
  cart: CartItem[]
  error: string | null
  loading?: boolean
  onConfirm: () => void
  onBack: () => void
}

export default function MobileCheckout({ cart, error, loading, onConfirm, onBack }: Props) {
  const total = cart.reduce((s, i) => s + i.totalPrice, 0)
  return (
    <>
      <div className={styles.scroll}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <ul className={styles.list}>
          {cart.map((item) => (
            <li key={item.localId} className={styles.row}>
              <span className={styles.name}>{item.tea.name}</span>
              <span className={styles.qty}>×{item.quantity}</span>
              <span className={styles.price}>{item.totalPrice} Kč</span>
            </li>
          ))}
        </ul>
        <div className={styles.totalRow}>
          <span>K zaplacení</span>
          <span className={styles.totalAmt}>{total.toLocaleString('cs-CZ')} Kč</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={onBack} disabled={loading}>
          Zpět na košík
        </button>
        <button className={styles.payBtn} onClick={onConfirm} disabled={loading}>
          {loading ? 'Ukládám…' : '✓ Zákazník zaplatil'}
        </button>
      </div>
    </>
  )
}
```

```css
/* frontend/src/components/pos-mobile/MobileCheckout.module.css */
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px; }
.error { color: var(--mob-danger); background: var(--mob-danger-bg); border-radius: var(--mob-r-sm); padding: 10px 12px; margin-bottom: 12px; font-size: 14px; }
.list { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 10px; background: var(--mob-surface); border-radius: var(--mob-r-sm); padding: 12px 14px; }
.name { flex: 1; font-size: 15px; }
.qty { color: var(--mob-muted); font-size: 14px; }
.price { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-weight: 600; }
.totalRow { display: flex; justify-content: space-between; padding: 12px 0; border-top: 1px solid var(--mob-border); font-size: 15px; }
.totalAmt { font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace; font-weight: 700; font-size: 20px; color: var(--mob-accent); }
.actions { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px calc(env(safe-area-inset-bottom) + 12px); }
.payBtn { padding: 16px; border-radius: var(--mob-r); background: var(--mob-success); color: #fff; border: none; font-size: 16px; font-weight: 600; cursor: pointer; }
.payBtn:active:not(:disabled) { transform: scale(0.985); opacity: 0.9; }
.payBtn:disabled { opacity: 0.5; cursor: not-allowed; }
.backBtn { padding: 12px; border-radius: var(--mob-r); background: var(--mob-surface-alt); border: 1px solid var(--mob-border); color: var(--mob-fg-2); font-size: 15px; cursor: pointer; }
.backBtn:active:not(:disabled) { transform: scale(0.985); }
```

- [ ] **Krok 2: Commit**

```
git add frontend/src/components/pos-mobile/MobileCheckout.tsx frontend/src/components/pos-mobile/MobileCheckout.module.css
git commit -m "feat(mobile-pos): MobileCheckout komponenta"
```

---

## Task 10: MobilePOS orchestrátor

**Files:**
- Modify: `frontend/src/pages/MobilePOS.tsx` (nahradit stub)

- [ ] **Krok 1: Implementovat MobilePOS.tsx**

```typescript
// frontend/src/pages/MobilePOS.tsx
import { useRef, useEffect, useState } from 'react'
import { useMobilePOS, VIEW_ORDER, type MobileView } from '../hooks/useMobilePOS'
import { useAuthStore } from '../store/authStore'
import { getPackagingOptions } from '../hooks/posHelpers'
import MobileHeader from '../components/pos-mobile/MobileHeader'
import MobileProgressBar from '../components/pos-mobile/MobileProgressBar'
import MobileHome from '../components/pos-mobile/MobileHome'
import MobileCategories from '../components/pos-mobile/MobileCategories'
import MobileTeas from '../components/pos-mobile/MobileTeas'
import MobilePackaging from '../components/pos-mobile/MobilePackaging'
import MobileQuantity from '../components/pos-mobile/MobileQuantity'
import MobileBags from '../components/pos-mobile/MobileBags'
import MobileCheckout from '../components/pos-mobile/MobileCheckout'
import MobileSuccess from '../components/pos-mobile/MobileSuccess'
import styles from './MobilePOS.module.css'

const VIEW_TITLES: Record<MobileView, string> = {
  home: 'Čajovna POS',
  categories: 'Kategorie',
  teas: 'Vyberte čaj',
  packaging: 'Typ balení',
  quantity: 'Množství',
  bags: 'Typ pytlíku',
  checkout: 'Přehled prodeje',
  success: 'Hotovo',
}

export default function MobilePOS() {
  const pos = useMobilePOS()
  const logout = useAuthStore((s) => s.logout)
  const prevViewRef = useRef<MobileView>('home')
  const [slideClass, setSlideClass] = useState<string>('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    const prevIdx = VIEW_ORDER.indexOf(prevViewRef.current)
    const newIdx = VIEW_ORDER.indexOf(pos.view)
    if (prevViewRef.current !== pos.view) {
      setSlideClass(newIdx >= prevIdx ? styles.slideFwd : styles.slideBack)
    }
    prevViewRef.current = pos.view
  }, [pos.view])

  async function handleConfirmCheckout() {
    setCheckoutLoading(true)
    await pos.confirmCheckout()
    setCheckoutLoading(false)
  }

  if (pos.loading) return <div className={styles.loading}>Načítám…</div>
  if (pos.error) return <div className={styles.loading}>Chyba: {pos.error}</div>

  const showBack = pos.view !== 'home' && pos.view !== 'success'
  const packagingOptions = pos.selectedTea ? getPackagingOptions(pos.selectedTea) : []

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <div className={`${styles.view} ${slideClass}`}>
          {pos.view !== 'success' && (
            <MobileHeader
              title={VIEW_TITLES[pos.view]}
              subtitle={pos.selectedCategory?.name}
              cartCount={pos.cart.length}
              onBack={showBack ? pos.goBack : undefined}
            />
          )}
          <MobileProgressBar view={pos.view} />

          {pos.view === 'home' && (
            <MobileHome
              cart={pos.cart}
              onAddItem={pos.goToCategories}
              onCheckout={pos.startCheckout}
              onRemove={pos.removeFromCart}
            />
          )}
          {pos.view === 'categories' && (
            <MobileCategories categories={pos.categories} onSelect={pos.selectCategory} />
          )}
          {pos.view === 'teas' && (
            <MobileTeas
              teas={pos.teas}
              categoryName={pos.selectedCategory?.name ?? ''}
              onSelect={pos.selectTea}
            />
          )}
          {pos.view === 'packaging' && (
            <MobilePackaging
              options={packagingOptions}
              selected={pos.selectedPackaging}
              onSelect={pos.selectPackaging}
            />
          )}
          {pos.view === 'quantity' && pos.selectedPackaging && (
            <MobileQuantity packaging={pos.selectedPackaging} onSelect={pos.selectQuantity} />
          )}
          {pos.view === 'bags' && (
            <MobileBags bagList={pos.bagList} onSelect={pos.selectBag} />
          )}
          {pos.view === 'checkout' && (
            <MobileCheckout
              cart={pos.cart}
              error={pos.checkoutError}
              loading={checkoutLoading}
              onConfirm={handleConfirmCheckout}
              onBack={pos.goBack}
            />
          )}
          {pos.view === 'success' && (
            <MobileSuccess total={pos.lastTotal} onNewSale={pos.newSale} />
          )}
        </div>
      </div>
    </div>
  )
}

- [ ] **Krok 2: Spustit testy**

```
cd frontend && npm run test
```

Všechny pass.

- [ ] **Krok 3: Spustit dev server a manuálně ověřit**

```
docker compose up -d
cd frontend && npm run dev
```

Otevři `http://localhost:5173`, přihlaš se jako `prodavacka` / `prodavacka123`. Měla by se zobrazit mobilní POS stránka. Projdi flow: kategorie → čaj → balení → množství → pytlík → košík → zaúčtovat → success.

- [ ] **Krok 4: Commit**

```
git add frontend/src/pages/MobilePOS.tsx frontend/src/hooks/useMobilePOS.ts
git commit -m "feat(mobile-pos): MobilePOS orchestrátor — kompletní wire-up všech views"
```

---

## Task 11: E2E test

**Files:**
- Create: `e2e/mobile-pos-flow.spec.ts`

- [ ] **Krok 1: Napsat E2E test**

```typescript
// e2e/mobile-pos-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Mobilní POS flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[autocomplete="username"]', 'prodavacka')
    await page.fill('input[autocomplete="current-password"]', 'prodavacka123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/pos')
  })

  test('zobrazí prázdný košík po přihlášení', async ({ page }) => {
    await expect(page.getByText('Košík je prázdný')).toBeVisible()
    await expect(page.getByText('Čajovna POS')).toBeVisible()
  })

  test('kompletní flow přidání čaje do košíku', async ({ page }) => {
    // Přidat položku
    await page.getByText('+ Přidat položku').click()
    await expect(page.getByText('Kategorie')).toBeVisible()

    // Vybrat první kategorii
    const firstCat = page.locator('button').first()
    const catName = await firstCat.textContent()
    await firstCat.click()
    await expect(page.getByText('Vyberte čaj')).toBeVisible()

    // Vybrat první čaj
    await page.locator('button').first().click()
    await expect(page.getByText('Typ balení')).toBeVisible()

    // Vybrat balení
    await page.locator('button').first().click()
    await expect(page.getByText('Množství')).toBeVisible()

    // Vybrat množství (1 ks)
    await page.locator('button').first().click()
    await expect(page.getByText('Typ pytlíku')).toBeVisible()

    // Vybrat žádný pytlík
    await page.getByText('Žádný').click()

    // Zpět v košíku — položka přidána
    await expect(page.getByText('Zaúčtovat prodej')).toBeVisible()
    await expect(page.locator('[class*="item"]')).toHaveCount(1)
  })

  test('zaúčtování prodeje → success screen', async ({ page }) => {
    // Přidat položku (zkráceno — vybere první dostupnou)
    await page.getByText('+ Přidat položku').click()
    await page.locator('button').first().click()  // kategorie
    await page.locator('button').first().click()  // čaj
    await page.locator('button').first().click()  // balení
    await page.locator('button').first().click()  // množství
    await page.getByText('Žádný').click()          // pytlík

    // Zaúčtovat
    await page.getByText('Zaúčtovat prodej').click()
    await expect(page.getByText('Přehled prodeje')).toBeVisible()
    await page.getByText('Zákazník zaplatil').click()
    await expect(page.getByText('Prodej zaúčtován')).toBeVisible()
    await page.getByText('Nový prodej').click()
    await expect(page.getByText('Košík je prázdný')).toBeVisible()
  })
})
```

- [ ] **Krok 2: Spustit E2E testy**

Ujisti se, že běží Docker i frontend (`docker compose up -d` + `npm run dev`).

```
cd frontend && npx playwright test e2e/mobile-pos-flow.spec.ts --headed
```

Očekávaný výsledek: 3/3 pass.

- [ ] **Krok 3: Spustit i starý E2E test**

```
cd frontend && npx playwright test e2e/pos-flow.spec.ts --headed
```

Očekávaný výsledek: všechny pass (URL `/pos-desktop` byla upravena v Task 2).

- [ ] **Krok 4: Commit**

```
git add e2e/mobile-pos-flow.spec.ts
git commit -m "test(e2e): mobilní POS flow — přidání čaje, zaúčtování, success screen"
```

---

## Shrnutí tasků

| Task | Popis | Výstup |
|---|---|---|
| 1 | posHelpers.ts | Sdílené utility, bez regresi |
| 2 | Routing + Login | `/pos` → MobilePOS, `/pos-desktop` → POS |
| 3 | useMobilePOS hook | 11 unit testů pass |
| 4 | CSS tokeny | Béžová paleta, slide animace |
| 5 | Sub-komponenty | Header, ProgressBar, ActionBar |
| 6 | Home + Success | Košík + success screen |
| 7 | Categories + Teas | Výběr kategorie a čaje |
| 8 | Packaging + Quantity + Bags | Konfigurace položky |
| 9 | Checkout | Přehled + zaúčtování |
| 10 | Orchestrátor | Kompletní wire-up |
| 11 | E2E test | 3 testy pass |
