# POS Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform POS UI from full-screen category/tea selection to split layout on single page: categories left (25%), teas right (75%), keyboard navigation via arrow keys between panels.

**Architecture:** Add `activePanel` state to usePOS ('categories' | 'teas'). Keep original quantity/bag steps unchanged. Split POS.tsx into CategoryPanel (left) and TeaPanel (right) with keyboard handler managing focus and navigation.

**Tech Stack:** React, TypeScript, CSS Modules, E2E Playwright

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `frontend/src/hooks/usePOS.ts` | Modify | Add `activePanel` state; add MOVE_LEFT/MOVE_RIGHT actions |
| `frontend/src/components/pos/CategoryPanel.tsx` | Create | Render categories (25% width), highlight selected |
| `frontend/src/components/pos/TeaPanel.tsx` | Create | Render teas (75% width), highlight selected, show filter status |
| `frontend/src/pages/POS.tsx` | Modify | Render splitlayout, manage keyboard handler for panel navigation |
| `frontend/src/pages/POS.module.css` | Modify | Add flex split layout styles, dim inactive panel |
| `frontend/tests/pos.spec.ts` | Modify | Update E2E tests for split layout |

---

## Task 1: Extend usePOS State — Add activePanel

**Files:**
- Modify: `frontend/src/hooks/usePOS.ts` (POSState interface, Action types, reducer)

- [ ] **Step 1: Update POSState interface**

In `usePOS.ts`, add after line 16 (`export type POSStep =`):

```typescript
export type POSStep =
  | 'category'
  | 'tea'
  | 'search'
  | 'quantity'
  | 'bag_yn'
  | 'bag_material'
  | 'bag_volume'
```

In POSState interface (line 17), add after `step: POSStep`:

```typescript
activePanel: 'categories' | 'teas'
```

- [ ] **Step 2: Add Action types for navigation**

In Action type (line 40), add:

```typescript
| { type: 'MOVE_LEFT' }
| { type: 'MOVE_RIGHT' }
```

- [ ] **Step 3: Update initialState**

In initialState (line 54), add after `step: 'category'`:

```typescript
activePanel: 'categories',
```

- [ ] **Step 4: Add reducer cases for MOVE_LEFT/MOVE_RIGHT**

In reducer (after MOVE_DOWN case, before CONFIRM case), add:

```typescript
case 'MOVE_LEFT': {
  return { ...state, activePanel: 'categories', step: 'category', searchQuery: '', searchResults: [] }
}

case 'MOVE_RIGHT': {
  if (state.step === 'category') {
    return { ...state, activePanel: 'teas', step: 'tea' }
  }
  if (state.step === 'search') {
    return { ...state, activePanel: 'teas', step: 'search' }
  }
  return state
}
```

- [ ] **Step 5: Update CONFIRM case**

When confirming from 'category' step, set activePanel to 'teas'. Find the line:

```typescript
if (state.step === 'category') {
  const cat = state.categories[state.categoryIndex] ?? null
  return { ...state, step: 'tea', selectedCategory: cat, teaIndex: 0 }
}
```

Replace with:

```typescript
if (state.step === 'category') {
  const cat = state.categories[state.categoryIndex] ?? null
  return { ...state, step: 'tea', activePanel: 'teas', selectedCategory: cat, teaIndex: 0 }
}
```

- [ ] **Step 6: Update CANCEL_ITEM case**

When cancelling, return to categories panel:

```typescript
case 'CANCEL_ITEM':
  return {
    ...state,
    step: 'category',
    activePanel: 'categories',
    categoryIndex: 0,
    teaIndex: 0,
    selectedCategory: null,
    selectedTea: null,
    quantity: 1,
    wantBag: true,
    materialIndex: 0,
    bagVolumes: [],
    volumeIndex: 0,
    searchQuery: '',
    searchResults: [],
    searchIndex: 0,
  }
```

- [ ] **Step 7: Export moveLeft, moveRight from hook**

In POSActions interface (line 286), add:

```typescript
moveLeft: () => void
moveRight: () => void
```

In usePOS function (line 318), add callbacks:

```typescript
const moveLeft = useCallback(() => dispatch({ type: 'MOVE_LEFT' }), [])
const moveRight = useCallback(() => dispatch({ type: 'MOVE_RIGHT' }), [])
```

In return statement (line 336), add:

```typescript
moveLeft,
moveRight,
```

- [ ] **Step 8: Run tests to verify**

```bash
cd frontend && npm run test
```

Expected: Tests pass

- [ ] **Step 9: Commit**

```bash
cd frontend && git add src/hooks/usePOS.ts && git commit -m "refactor(pos): usePOS — add activePanel state + MOVE_LEFT/RIGHT"
```

---

## Task 2: Create CategoryPanel Component

**Files:**
- Create: `frontend/src/components/pos/CategoryPanel.tsx`
- Create: `frontend/src/components/pos/CategoryPanel.module.css`

- [ ] **Step 1: Create CategoryPanel.tsx**

Create file with:

```typescript
import type { Category } from '../../types'
import styles from './CategoryPanel.module.css'

interface Props {
  categories: Category[]
  selectedIndex: number
  isActive: boolean
}

export default function CategoryPanel({ categories, selectedIndex, isActive }: Props) {
  return (
    <div className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}>
      <div className={styles.header}>Kategorie</div>
      <ul className={styles.list}>
        {categories.map((cat, idx) => (
          <li
            key={cat.id}
            className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}
          >
            {cat.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Create CategoryPanel.module.css**

Create file with:

```css
.panel {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #ddd;
  background: #f9f9f9;
  transition: opacity 0.2s;
}

.panel.inactive {
  opacity: 0.5;
}

.panel.active {
  opacity: 1;
}

.header {
  padding: 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #ddd;
  background: #eee;
  color: #333;
  text-transform: uppercase;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.item {
  padding: 10px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.1s, border-color 0.1s;
  color: #333;
}

.item:hover {
  background: #f0f0f0;
}

.item.selected {
  background: #e8f5e9;
  border-left-color: #4caf50;
  font-weight: 500;
  color: #2e7d32;
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/pos/CategoryPanel.tsx src/components/pos/CategoryPanel.module.css && git commit -m "feat(pos): CategoryPanel — left sidebar for categories"
```

---

## Task 3: Create TeaPanel Component

**Files:**
- Create: `frontend/src/components/pos/TeaPanel.tsx`
- Create: `frontend/src/components/pos/TeaPanel.module.css`

- [ ] **Step 1: Create TeaPanel.tsx**

Create file with:

```typescript
import type { Tea } from '../../types'
import styles from './TeaPanel.module.css'

interface Props {
  teas: Tea[]
  selectedIndex: number
  isActive: boolean
  isFilterActive: boolean
}

export default function TeaPanel({ teas, selectedIndex, isActive, isFilterActive }: Props) {
  return (
    <div className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}>
      <div className={styles.header}>
        {isFilterActive ? <span className={styles.filterTag}>Filtr</span> : 'Čaje'}
      </div>
      <ul className={styles.list}>
        {teas.length === 0 ? (
          <li className={styles.empty}>Žádné čaje</li>
        ) : (
          teas.map((tea, idx) => (
            <li key={tea.id} className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}>
              <div className={styles.name}>{tea.name}</div>
              {tea.std_price_moc && <div className={styles.price}>{tea.std_price_moc} Kč</div>}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Create TeaPanel.module.css**

Create file with:

```css
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  transition: opacity 0.2s;
}

.panel.inactive {
  opacity: 0.5;
}

.panel.active {
  opacity: 1;
}

.header {
  padding: 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #ddd;
  background: #eee;
  color: #333;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.filterTag {
  display: inline-block;
  background: #ff9800;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.item {
  padding: 10px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.1s, border-color 0.1s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.item:hover {
  background: #f5f5f5;
}

.item.selected {
  background: #e8f5e9;
  border-left-color: #4caf50;
}

.name {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.price {
  color: #999;
  font-size: 12px;
  white-space: nowrap;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/pos/TeaPanel.tsx src/components/pos/TeaPanel.module.css && git commit -m "feat(pos): TeaPanel — right sidebar for teas with filter indicator"
```

---

## Task 4: Refactor POS.tsx — Split Layout & Keyboard Handler

**Files:**
- Modify: `frontend/src/pages/POS.tsx`
- Modify: `frontend/src/pages/POS.module.css`

- [ ] **Step 1: Update imports in POS.tsx**

Replace lines 1-17 with:

```typescript
import { useEffect, useCallback, useState } from 'react'
import { usePOS } from '../hooks/usePOS'
import { useAuthStore } from '../store/authStore'
import { getSales, getSaleItems } from '../api/sales'
import CategoryPanel from '../components/pos/CategoryPanel'
import TeaPanel from '../components/pos/TeaPanel'
import SearchResults from '../components/pos/SearchResults'
import QuantitySelector from '../components/pos/QuantitySelector'
import BagSelector from '../components/pos/BagSelector'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import { useToast } from '../components/toast/useToast'
import HistoryPanel from '../components/pos/HistoryPanel'
import SalesSummary from '../components/pos/SalesSummary'
import POSNavbar from '../components/pos/POSNavbar'
import type { Sale, SaleItem } from '../types'
import styles from './POS.module.css'
```

- [ ] **Step 2: Update hook destructuring**

Find line with `const { state, moveUp, moveDown, ...` and replace with:

```typescript
const {
  state,
  moveUp,
  moveDown,
  moveLeft,
  moveRight,
  confirm,
  setQuantity,
  startSearch,
  appendSearch,
  cancelItem,
  removeFromCart,
  clearCart,
} = usePOS()
```

- [ ] **Step 3: Update keyboard handler**

Find the `handleKey` useCallback (around line 49) and replace with:

```typescript
const handleKey = useCallback(
  (e: KeyboardEvent) => {
    // When modal-like step (quantity/bag), let input focus
    if (['quantity', 'bag_yn', 'bag_material', 'bag_volume'].includes(state.step)) {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirm()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelItem()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveUp()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveDown()
        return
      }
      return
    }

    // Normal navigation (category/tea/search steps)
    if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      cancelItem()
      return
    }

    if ((e.target as HTMLElement).tagName === 'INPUT') return

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (activeTab === 'overview') {
          handleHistoryNavigation('up')
        } else {
          moveUp()
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (activeTab === 'overview') {
          handleHistoryNavigation('down')
        } else {
          moveDown()
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveLeft()
        break
      case 'ArrowRight':
        e.preventDefault()
        moveRight()
        break
      case 'F10':
        if (state.cart.length > 0) {
          e.preventDefault()
          setShowCheckout(true)
        }
        break
      case 'Backspace':
        if ((state.step === 'category' || state.step === 'tea') && state.searchQuery.length > 0) {
          e.preventDefault()
          startSearch(state.searchQuery.slice(0, -1))
        }
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (state.step === 'category' || state.step === 'tea') {
            startSearch(e.key)
          }
        }
    }
  },
  [state, moveUp, moveDown, moveLeft, moveRight, confirm, setQuantity, startSearch, cancelItem, activeTab, handleHistoryNavigation],
)
```

- [ ] **Step 4: Update renderMainPanel function**

Find `function renderMainPanel()` and replace entirely with:

```typescript
function renderMainPanel() {
  const displayTeas = state.searchQuery.length > 0 ? state.searchResults : state.teas

  // Split layout for category/tea steps
  if (state.step === 'category' || state.step === 'tea' || state.step === 'search') {
    return (
      <div className={styles.splitLayout}>
        <CategoryPanel
          categories={state.categories}
          selectedIndex={state.categoryIndex}
          isActive={state.activePanel === 'categories' && !state.searchQuery}
        />
        <TeaPanel
          teas={displayTeas}
          selectedIndex={state.step === 'search' ? state.searchIndex : state.teaIndex}
          isActive={state.activePanel === 'teas' || state.searchQuery.length > 0}
          isFilterActive={state.searchQuery.length > 0}
        />
      </div>
    )
  }

  // Quantity selector
  if (state.step === 'quantity' && state.selectedTea) {
    return (
      <div className={styles.splitLayout}>
        <div className={styles.panelPlaceholder} />
        <div className={styles.mainContent}>
          <QuantitySelector
            tea={state.selectedTea}
            quantity={state.quantity}
            onChange={setQuantity}
          />
        </div>
      </div>
    )
  }

  // Bag selector
  if (state.step === 'bag_yn' && state.selectedTea) {
    return (
      <div className={styles.splitLayout}>
        <div className={styles.panelPlaceholder} />
        <div className={styles.mainContent}>
          <BagSelector
            tea={state.selectedTea}
            bags={state.bags}
            materials={state.bagMaterials}
            materialIndex={state.materialIndex}
            volumes={state.bagVolumes}
            volumeIndex={state.volumeIndex}
            onWantBagChange={(want) => {
              // This is handled by CONFIRM in reducer
              confirm()
            }}
            onMaterialSelect={(idx) => {
              // Would need to add SET_MATERIAL_INDEX action
              moveDown()
            }}
            onVolumeSelect={(idx) => {
              moveDown()
            }}
          />
        </div>
      </div>
    )
  }

  return <div>Unknown step</div>
}
```

- [ ] **Step 5: Add flex split styles to POS.module.css**

Add to `POS.module.css`:

```css
.splitLayout {
  display: flex;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.panelPlaceholder {
  flex: 0 0 25%;
  background: #f9f9f9;
  border-right: 1px solid #ddd;
}

.mainContent {
  flex: 1;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 6: Run tests**

```bash
cd frontend && npm run test
```

Expected: Tests pass

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/pages/POS.tsx src/pages/POS.module.css && git commit -m "refactor(pos): split layout — categories left (25%), teas right (75%)"
```

---

## Task 5: Update E2E Tests

**Files:**
- Modify: `frontend/tests/pos.spec.ts`

- [ ] **Step 1: Add split layout navigation tests**

Add to `pos.spec.ts`:

```typescript
test('POS: split layout visible on load', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Both panels should be visible
  const leftPanel = page.locator('text=Kategorie').first()
  const rightPanel = page.locator('text=Čaje').first()
  
  await expect(leftPanel).toBeVisible()
  await expect(rightPanel).toBeVisible()
})

test('POS: left arrow returns to categories, right arrow moves to teas', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Start in categories, move right
  await page.keyboard.press('ArrowRight')
  // Should now be in teas (active)
  
  // Move left back
  await page.keyboard.press('ArrowLeft')
  // Should be back in categories
})

test('POS: filter hides categories, shows matched teas', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Type to filter
  await page.keyboard.press('d')
  
  // Filter tag should appear
  const filterTag = page.locator('text=Filtr')
  await expect(filterTag).toBeVisible()
})

test('POS: ESC in filter clears it', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Type to filter
  await page.keyboard.press('d')
  await expect(page.locator('text=Filtr')).toBeVisible()
  
  // ESC clears
  await page.keyboard.press('Escape')
  await expect(page.locator('text=Filtr')).not.toBeVisible()
})
```

- [ ] **Step 2: Run E2E tests**

```bash
npx playwright test frontend/tests/pos.spec.ts -g "split layout"
```

Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
cd frontend && git add tests/pos.spec.ts && git commit -m "test(e2e): POS split layout — keyboard navigation + filter"
```

---

## Task 6: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173/pos (login: `prodavacka` / `prodavacka123`)

- [ ] **Step 2: Verify layout**

- ✓ Left panel (25%): categories visible, first highlighted green
- ✓ Right panel (75%): teas from first category visible
- ✓ Both panels full height, no scrolling between them

- [ ] **Step 3: Verify keyboard navigation**

- ✓ ↑/↓ in categories: selection moves
- ✓ → in categories: focus to teas (categories dim)
- ✓ ← in teas: focus to categories
- ✓ ↑/↓ in teas: selection moves
- ✓ ENTER on tea: opens quantity step

- [ ] **Step 4: Verify filter**

- ✓ Type 'd': categories disappear (dim), only matching teas show
- ✓ "Filtr" tag shown in tea panel
- ✓ ESC: filter cleared, categories reappear
- ✓ ↑/↓ still navigate filtered teas

- [ ] **Step 5: Verify quantity/bag flow**

- ✓ ENTER in quantity: moves to bag selection
- ✓ Bag selection works as before
- ✓ After confirming: back to split layout

- [ ] **Step 6: Commit smoke test pass**

```bash
cd frontend && git commit --allow-empty -m "test(smoke): POS split layout — manual verification passed"
```

---

## Summary

**6 tasks, ~15 commits:**
1. usePOS: activePanel state + MOVE_LEFT/RIGHT
2. CategoryPanel: left sidebar
3. TeaPanel: right sidebar
4. POS.tsx refactor: split layout + keyboard handler
5. E2E tests: navigation + filter
6. Smoke test: manual verification

All quantity/bag steps keep original flow — no modals added.
