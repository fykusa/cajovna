# POS Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform POS UI from sequential screens (category → tea → quantity → bags) to a single page with vertical split: categories left (25%), teas right (75%), keyboard navigation via arrows.

**Architecture:** Split usePOS state machine — introduce `activePanel` ('categories' | 'teas') instead of sequential steps. Quantity and bag selection become modal dialogs over the main layout. Filter (when text entered) hides categories and shows only matching teas.

**Tech Stack:** React, TypeScript, CSS Modules, E2E Playwright

---

## File Structure

| File | Type | Purpose |
|------|------|---------|
| `frontend/src/hooks/usePOS.ts` | Modify | Add `activePanel`, `activeModal` state; remove quantity/bag steps |
| `frontend/src/components/pos/CategoryPanel.tsx` | Create | Render categories (25% width), keyboard navigate |
| `frontend/src/components/pos/TeaPanel.tsx` | Create | Render teas (75% width), keyboard navigate, handle filter |
| `frontend/src/components/pos/QuantityModal.tsx` | Create | Modal dialog for quantity input |
| `frontend/src/components/pos/BagModal.tsx` | Create | Modal dialog for bag (material + volume) selection |
| `frontend/src/pages/POS.tsx` | Modify | Render splitlayout, manage keyboard handler for panels + modals |
| `frontend/src/pages/POS.module.css` | Modify | Add flex split layout styles |
| `frontend/tests/pos.spec.ts` | Modify | Update E2E tests for new flow |

---

## Task 1: Extend usePOS State — Add activePanel & activeModal

**Files:**
- Modify: `frontend/src/hooks/usePOS.ts:16-38` (POSState interface)
- Modify: `frontend/src/hooks/usePOS.ts:40-52` (Action types)
- Modify: `frontend/src/hooks/usePOS.ts:54-76` (initialState)
- Modify: `frontend/src/hooks/usePOS.ts:121-284` (reducer)

**Why:** Current state machine uses `step: 'quantity' | 'bag_yn' | 'bag_material' | 'bag_volume'` to control flow. We're replacing with modals, so these steps disappear. Instead, `activePanel` controls left/right focus, and `activeModal` controls which modal (if any) is open.

- [ ] **Step 1: Extend POSState interface**

Replace lines 7-38 with:

```typescript
export type POSStep = 'category' | 'tea' | 'search'

export type ModalType = null | 'quantity' | 'bag'

export interface POSState {
  step: POSStep
  activePanel: 'categories' | 'teas'  // which panel has keyboard focus
  activeModal: ModalType             // which modal is open (if any)
  categories: Category[]
  teas: Tea[]
  allTeas: Tea[]
  bags: Bag[]
  categoryIndex: number
  teaIndex: number
  searchQuery: string
  searchResults: Tea[]
  searchIndex: number
  selectedCategory: Category | null
  selectedTea: Tea | null
  quantity: number
  wantBag: boolean
  bagMaterials: string[]
  materialIndex: number
  bagVolumes: number[]
  volumeIndex: number
  cart: CartItem[]
  loading: boolean
  error: string | null
}
```

- [ ] **Step 2: Extend Action types**

Replace lines 40-52 with:

```typescript
type Action =
  | { type: 'LOAD_DATA'; categories: Category[]; allTeas: Tea[]; bags: Bag[] }
  | { type: 'LOAD_TEAS'; teas: Tea[] }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'MOVE_LEFT' }  // new: focus to categories
  | { type: 'MOVE_RIGHT' } // new: focus to teas
  | { type: 'CONFIRM' }
  | { type: 'OPEN_MODAL'; modal: ModalType }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_QUANTITY'; value: number }
  | { type: 'SET_WANT_BAG'; value: boolean }
  | { type: 'START_SEARCH'; query: string }
  | { type: 'APPEND_SEARCH'; char: string }
  | { type: 'REMOVE_FROM_CART'; localId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'CANCEL_ITEM' }
```

- [ ] **Step 3: Update initialState**

Replace lines 54-76:

```typescript
const initialState: POSState = {
  step: 'category',
  activePanel: 'categories',
  activeModal: null,
  categories: [],
  teas: [],
  allTeas: [],
  bags: [],
  categoryIndex: 0,
  teaIndex: 0,
  searchQuery: '',
  searchResults: [],
  searchIndex: 0,
  selectedCategory: null,
  selectedTea: null,
  quantity: 1,
  wantBag: true,
  bagMaterials: [],
  materialIndex: 0,
  bagVolumes: [],
  volumeIndex: 0,
  cart: [],
  loading: true,
  error: null,
}
```

- [ ] **Step 4: Update reducer — LOAD_DATA case**

Replace case 'LOAD_DATA' (lines 123-133):

```typescript
case 'LOAD_DATA': {
  const materials = uniqueMaterials(action.bags)
  return {
    ...state,
    categories: action.categories,
    allTeas: action.allTeas,
    bags: action.bags,
    bagMaterials: materials,
    step: 'category',
    activePanel: 'categories',
    activeModal: null,
    loading: false,
  }
}
```

- [ ] **Step 5: Update reducer — MOVE_UP/MOVE_DOWN cases**

Replace lines 138-196 (MOVE_UP, MOVE_DOWN):

```typescript
case 'MOVE_UP': {
  if (state.step === 'category') {
    const len = state.categories.length
    return { ...state, categoryIndex: (state.categoryIndex - 1 + len) % len }
  }
  if (state.step === 'tea') {
    const len = state.teas.length
    return { ...state, teaIndex: (state.teaIndex - 1 + len) % len }
  }
  if (state.step === 'search') {
    const len = state.searchResults.length
    return { ...state, searchIndex: (state.searchIndex - 1 + len) % len }
  }
  return state
}

case 'MOVE_DOWN': {
  if (state.step === 'category') {
    const len = state.categories.length
    return { ...state, categoryIndex: (state.categoryIndex + 1) % len }
  }
  if (state.step === 'tea') {
    const len = state.teas.length
    return { ...state, teaIndex: (state.teaIndex + 1) % len }
  }
  if (state.step === 'search') {
    const len = state.searchResults.length
    return { ...state, searchIndex: (state.searchIndex + 1) % len }
  }
  return state
}

case 'MOVE_LEFT': {
  return { ...state, activePanel: 'categories', step: 'category', searchQuery: '', searchResults: [] }
}

case 'MOVE_RIGHT': {
  if (state.step === 'category' || state.step === 'search') {
    return { ...state, activePanel: 'teas', step: 'tea' }
  }
  return state
}
```

- [ ] **Step 6: Update reducer — CONFIRM case**

Replace lines 201-240:

```typescript
case 'CONFIRM': {
  // V kategoriích: načti čaje a přejdi do panelu čajů
  if (state.step === 'category') {
    const cat = state.categories[state.categoryIndex] ?? null
    return {
      ...state,
      activePanel: 'teas',
      step: 'tea',
      selectedCategory: cat,
      teaIndex: 0,
    }
  }
  // V čajích: otevři modal množství
  if (state.step === 'tea' && state.selectedTea) {
    const tea = state.teas[state.teaIndex] ?? null
    return { ...state, step: 'tea', selectedTea: tea, quantity: 1, activeModal: 'quantity' }
  }
  // V hledání: otevři modal množství
  if (state.step === 'search' && state.searchResults.length > 0) {
    const tea = state.searchResults[state.searchIndex] ?? null
    return { ...state, step: 'search', selectedTea: tea, quantity: 1, activeModal: 'quantity' }
  }
  return state
}
```

- [ ] **Step 7: Add OPEN_MODAL, CLOSE_MODAL, SET_QUANTITY, SET_WANT_BAG cases**

Add before default case (before line 281):

```typescript
case 'OPEN_MODAL':
  return { ...state, activeModal: action.modal }

case 'CLOSE_MODAL':
  return { ...state, activeModal: null }

case 'SET_QUANTITY':
  return { ...state, quantity: Math.max(1, action.value) }

case 'SET_WANT_BAG': {
  if (!action.value && state.selectedTea) {
    // User clicked "No bag" — finalize cart item
    const item = buildCartItem(
      state.selectedTea,
      resolveItemType(state.selectedTea),
      state.quantity,
      null
    )
    return {
      ...state,
      cart: [...state.cart, item],
      activeModal: null,
      step: 'category',
      activePanel: 'categories',
      selectedTea: null,
      quantity: 1,
      categoryIndex: 0,
    }
  }
  // User clicked "Yes bag" — open bag modal
  if (action.value) {
    const volumes = volumesForMaterial(state.bags, state.bagMaterials[state.materialIndex])
    return {
      ...state,
      wantBag: true,
      activeModal: 'bag',
      materialIndex: 0,
      bagVolumes: volumes,
      volumeIndex: 0,
    }
  }
  return state
}
```

- [ ] **Step 8: Update CANCEL_ITEM case**

Replace lines 259-276:

```typescript
case 'CANCEL_ITEM':
  return {
    ...state,
    step: 'category',
    activePanel: 'categories',
    activeModal: null,
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

- [ ] **Step 9: Update hook exports — POSActions**

Replace lines 286-297 with:

```typescript
export interface POSActions {
  moveUp: () => void
  moveDown: () => void
  moveLeft: () => void
  moveRight: () => void
  confirm: () => void
  setQuantity: (v: number) => void
  setWantBag: (value: boolean) => void
  startSearch: (query: string) => void
  appendSearch: (char: string) => void
  cancelItem: () => void
  openModal: (modal: ModalType) => void
  closeModal: () => void
  removeFromCart: (localId: string) => void
  clearCart: () => void
  loadTeasForCategory: (categoryId: number) => Promise<void>
}
```

- [ ] **Step 10: Update usePOS hook return**

Replace return statement (line 336) and add new action callbacks:

```typescript
export function usePOS(): { state: POSState } & POSActions {
  const [state, dispatch] = useReducer(reducer, initialState)

  // ... useEffect hooks stay the same ...

  const moveUp = useCallback(() => dispatch({ type: 'MOVE_UP' }), [])
  const moveDown = useCallback(() => dispatch({ type: 'MOVE_DOWN' }), [])
  const moveLeft = useCallback(() => dispatch({ type: 'MOVE_LEFT' }), [])
  const moveRight = useCallback(() => dispatch({ type: 'MOVE_RIGHT' }), [])
  const confirm = useCallback(() => dispatch({ type: 'CONFIRM' }), [])
  const setQuantity = useCallback((v: number) => dispatch({ type: 'SET_QUANTITY', value: v }), [])
  const setWantBag = useCallback((value: boolean) => dispatch({ type: 'SET_WANT_BAG', value }), [])
  const startSearch = useCallback((query: string) => dispatch({ type: 'START_SEARCH', query }), [])
  const appendSearch = useCallback((char: string) => dispatch({ type: 'APPEND_SEARCH', char }), [])
  const cancelItem = useCallback(() => dispatch({ type: 'CANCEL_ITEM' }), [])
  const openModal = useCallback((modal: ModalType) => dispatch({ type: 'OPEN_MODAL', modal }), [])
  const closeModal = useCallback(() => dispatch({ type: 'CLOSE_MODAL' }), [])
  const removeFromCart = useCallback((localId: string) => dispatch({ type: 'REMOVE_FROM_CART', localId }), [])
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), [])
  const loadTeasForCategory = useCallback(async (categoryId: number) => {
    try {
      const teas = await getProducts({ category_id: categoryId })
      dispatch({ type: 'LOAD_TEAS', teas })
    } catch (e) {
      dispatch({ type: 'SET_ERROR', message: (e as Error).message })
    }
  }, [])

  return {
    state,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    confirm,
    setQuantity,
    setWantBag,
    startSearch,
    appendSearch,
    cancelItem,
    openModal,
    closeModal,
    removeFromCart,
    clearCart,
    loadTeasForCategory,
  }
}
```

- [ ] **Step 11: Run tests to verify hook changes**

```bash
cd frontend && npm run test
```

Expected: Tests pass (no breaking changes yet, just state structure).

- [ ] **Step 12: Commit**

```bash
cd frontend && git add src/hooks/usePOS.ts && git commit -m "refactor(pos): usePOS — activePanel + activeModal state, remove quantity/bag steps"
```

---

## Task 2: Create CategoryPanel Component

**Files:**
- Create: `frontend/src/components/pos/CategoryPanel.tsx`
- Create: `frontend/src/components/pos/CategoryPanel.module.css`

- [ ] **Step 1: Write unit test for CategoryPanel**

Create `frontend/tests/CategoryPanel.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import CategoryPanel from '../src/components/pos/CategoryPanel'
import type { Category } from '../src/types'

describe('CategoryPanel', () => {
  const mockCategories: Category[] = [
    { id: 1, name: 'Černé čaje', description: 'Černé čaje' },
    { id: 2, name: 'Zelené čaje', description: 'Zelené čaje' },
  ]

  it('renders categories list', () => {
    render(
      <CategoryPanel
        categories={mockCategories}
        selectedIndex={0}
        isActive={true}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Černé čaje')).toBeInTheDocument()
    expect(screen.getByText('Zelené čaje')).toBeInTheDocument()
  })

  it('highlights selected category', () => {
    const { container } = render(
      <CategoryPanel
        categories={mockCategories}
        selectedIndex={0}
        isActive={true}
        onSelect={() => {}}
      />
    )
    const items = container.querySelectorAll('[data-testid="category-item"]')
    expect(items[0]).toHaveClass('selected')
    expect(items[1]).not.toHaveClass('selected')
  })

  it('dims panel when not active', () => {
    const { container } = render(
      <CategoryPanel
        categories={mockCategories}
        selectedIndex={0}
        isActive={false}
        onSelect={() => {}}
      />
    )
    expect(container.querySelector('[data-testid="panel"]')).toHaveClass('inactive')
  })
})
```

Run: `npm run test -- CategoryPanel.test.tsx`

Expected: FAIL (component doesn't exist)

- [ ] **Step 2: Create CategoryPanel.tsx**

```typescript
import type { Category } from '../../types'
import styles from './CategoryPanel.module.css'

interface Props {
  categories: Category[]
  selectedIndex: number
  isActive: boolean
  onSelect: (index: number) => void
}

export default function CategoryPanel({
  categories,
  selectedIndex,
  isActive,
  onSelect,
}: Props) {
  return (
    <div
      className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}
      data-testid="panel"
    >
      <div className={styles.header}>Kategorie</div>
      <ul className={styles.list}>
        {categories.map((cat, idx) => (
          <li
            key={cat.id}
            data-testid="category-item"
            className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}
            onClick={() => onSelect(idx)}
          >
            {cat.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Create CategoryPanel.module.css**

```css
.panel {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid #ddd;
  background: #f9f9f9;
  transition: opacity 0.2s;
}

.panel.inactive {
  opacity: 0.5;
  pointer-events: none;
}

.panel.active {
  opacity: 1;
}

.header {
  padding: 12px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid #ddd;
  color: #333;
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
  transition: background 0.15s, border-color 0.15s;
}

.item:hover {
  background: #eee;
}

.item.selected {
  background: #e8f5e9;
  border-left-color: #4caf50;
  font-weight: 500;
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- CategoryPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/pos/CategoryPanel.tsx src/components/pos/CategoryPanel.module.css tests/CategoryPanel.test.tsx
git commit -m "feat(pos): CategoryPanel — left sidebar with categories, keyboard focus styling"
```

---

## Task 3: Create TeaPanel Component

**Files:**
- Create: `frontend/src/components/pos/TeaPanel.tsx`
- Create: `frontend/src/components/pos/TeaPanel.module.css`

- [ ] **Step 1: Write unit test for TeaPanel**

Create `frontend/tests/TeaPanel.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import TeaPanel from '../src/components/pos/TeaPanel'
import type { Tea } from '../src/types'

describe('TeaPanel', () => {
  const mockTeas: Tea[] = [
    {
      id: 1,
      name: 'Darjeeling',
      category_id: 1,
      std_price_moc: 150,
      std_weight_g: 50,
      pkg1_price_moc: null,
      pkg1_weight_g: null,
      pkg2_price_moc: null,
      pkg2_weight_g: null,
      description: 'Jemný černý čaj',
    },
    {
      id: 2,
      name: 'Assam',
      category_id: 1,
      std_price_moc: 130,
      std_weight_g: 50,
      pkg1_price_moc: null,
      pkg1_weight_g: null,
      pkg2_price_moc: null,
      pkg2_weight_g: null,
      description: 'Silný černý čaj',
    },
  ]

  it('renders teas list', () => {
    render(
      <TeaPanel
        teas={mockTeas}
        selectedIndex={0}
        isActive={true}
        isFilterActive={false}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Darjeeling')).toBeInTheDocument()
    expect(screen.getByText('Assam')).toBeInTheDocument()
  })

  it('highlights selected tea', () => {
    const { container } = render(
      <TeaPanel
        teas={mockTeas}
        selectedIndex={0}
        isActive={true}
        isFilterActive={false}
        onSelect={() => {}}
      />
    )
    const items = container.querySelectorAll('[data-testid="tea-item"]')
    expect(items[0]).toHaveClass('selected')
    expect(items[1]).not.toHaveClass('selected')
  })

  it('shows filter notice when filter is active', () => {
    render(
      <TeaPanel
        teas={mockTeas}
        selectedIndex={0}
        isActive={true}
        isFilterActive={true}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText(/Filtr/i)).toBeInTheDocument()
  })
})
```

Run: `npm run test -- TeaPanel.test.tsx`

Expected: FAIL

- [ ] **Step 2: Create TeaPanel.tsx**

```typescript
import type { Tea } from '../../types'
import styles from './TeaPanel.module.css'

interface Props {
  teas: Tea[]
  selectedIndex: number
  isActive: boolean
  isFilterActive: boolean
  onSelect: (index: number) => void
}

export default function TeaPanel({
  teas,
  selectedIndex,
  isActive,
  isFilterActive,
  onSelect,
}: Props) {
  return (
    <div
      className={`${styles.panel} ${isActive ? styles.active : styles.inactive}`}
      data-testid="panel"
    >
      <div className={styles.header}>
        {isFilterActive ? (
          <span className={styles.filterLabel}>Filtr aktivní</span>
        ) : (
          <span>Čaje</span>
        )}
      </div>
      <ul className={styles.list}>
        {teas.length === 0 ? (
          <li className={styles.empty}>Žádné čaje</li>
        ) : (
          teas.map((tea, idx) => (
            <li
              key={tea.id}
              data-testid="tea-item"
              className={`${styles.item} ${idx === selectedIndex ? styles.selected : ''}`}
              onClick={() => onSelect(idx)}
            >
              <div className={styles.name}>{tea.name}</div>
              {tea.std_price_moc && (
                <div className={styles.price}>{tea.std_price_moc} Kč</div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Create TeaPanel.module.css**

```css
.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
  transition: opacity 0.2s;
}

.panel.inactive {
  opacity: 0.5;
  pointer-events: none;
}

.panel.active {
  opacity: 1;
}

.header {
  padding: 12px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid #ddd;
  color: #333;
}

.filterLabel {
  color: #ff9800;
  font-style: italic;
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
  transition: background 0.15s, border-color 0.15s;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  color: #666;
  font-size: 12px;
  margin-left: 8px;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
}
```

- [ ] **Step 4: Run test**

```bash
npm run test -- TeaPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/pos/TeaPanel.tsx src/components/pos/TeaPanel.module.css tests/TeaPanel.test.tsx
git commit -m "feat(pos): TeaPanel — right sidebar with teas, filter indicator"
```

---

## Task 4: Create QuantityModal Component

**Files:**
- Create: `frontend/src/components/pos/QuantityModal.tsx`
- Create: `frontend/src/components/pos/QuantityModal.module.css`

- [ ] **Step 1: Create QuantityModal.tsx**

```typescript
import { useState, useEffect } from 'react'
import type { Tea } from '../../types'
import styles from './QuantityModal.module.css'

interface Props {
  tea: Tea | null
  quantity: number
  onQuantityChange: (value: number) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function QuantityModal({
  tea,
  quantity,
  onQuantityChange,
  onConfirm,
  onCancel,
}: Props) {
  const [raw, setRaw] = useState(String(quantity))

  useEffect(() => {
    setRaw(String(quantity))
  }, [quantity])

  if (!tea) return null

  const baleni = [
    tea.std_weight_g && tea.std_price_moc
      ? { label: 'Std', weight: tea.std_weight_g, price: tea.std_price_moc }
      : null,
    tea.pkg1_weight_g && tea.pkg1_price_moc
      ? { label: 'Bal 1', weight: tea.pkg1_weight_g, price: tea.pkg1_price_moc }
      : null,
    tea.pkg2_weight_g && tea.pkg2_price_moc
      ? { label: 'Bal 2', weight: tea.pkg2_weight_g, price: tea.pkg2_price_moc }
      : null,
  ].filter(Boolean) as { label: string; weight: number; price: number }[]

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const str = e.target.value
    setRaw(str)
    const v = parseInt(str, 10)
    if (!isNaN(v) && v >= 1) onQuantityChange(v)
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{tea.name}</h2>
        <div className={styles.content}>
          <label className={styles.label}>Množství:</label>
          <input
            type="number"
            min={1}
            value={raw}
            onChange={handleChange}
            onBlur={() => {
              if (parseInt(raw, 10) < 1 || isNaN(parseInt(raw, 10))) setRaw(String(quantity))
            }}
            className={styles.input}
            autoFocus
          />
        </div>

        {baleni.length > 0 && (
          <div className={styles.variants}>
            <div className={styles.variantLabel}>Dostupné balení:</div>
            <ul>
              {baleni.map((b) => (
                <li key={b.label}>
                  {b.label}: {b.weight}g — {b.price} Kč
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.confirm} onClick={onConfirm}>
            Pokračovat (ENTER)
          </button>
          <button className={styles.cancel} onClick={onCancel}>
            Zrušit (ESC)
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create QuantityModal.module.css**

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
}

.content {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-weight: 500;
  color: #666;
}

.input {
  width: 80px;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.variants {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.variantLabel {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.variants ul {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: #555;
}

.variants li {
  padding: 4px 0;
}

.buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.confirm,
.cancel {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.confirm {
  background: #4caf50;
  color: #fff;
}

.confirm:hover {
  background: #45a049;
}

.cancel {
  background: #ddd;
  color: #333;
}

.cancel:hover {
  background: #ccc;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/pos/QuantityModal.tsx src/components/pos/QuantityModal.module.css
git commit -m "feat(pos): QuantityModal — modal dialog for quantity input"
```

---

## Task 5: Create BagModal Component

**Files:**
- Create: `frontend/src/components/pos/BagModal.tsx`
- Create: `frontend/src/components/pos/BagModal.module.css`

- [ ] **Step 1: Create BagModal.tsx**

```typescript
import type { Bag } from '../../types'
import styles from './BagModal.module.css'

interface Props {
  bags: Bag[]
  materials: string[]
  selectedMaterialIndex: number
  volumes: number[]
  selectedVolumeIndex: number
  onMaterialSelect: (index: number) => void
  onVolumeSelect: (index: number) => void
  onNoBag: () => void
  onConfirm: () => void
  onCancel: () => void
}

export default function BagModal({
  bags,
  materials,
  selectedMaterialIndex,
  volumes,
  selectedVolumeIndex,
  onMaterialSelect,
  onVolumeSelect,
  onNoBag,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Výběr pytlíku</h2>

        <div className={styles.section}>
          <label className={styles.sectionLabel}>Materiál:</label>
          <ul className={styles.list}>
            {materials.map((material, idx) => (
              <li
                key={material}
                className={`${styles.item} ${idx === selectedMaterialIndex ? styles.selected : ''}`}
                onClick={() => onMaterialSelect(idx)}
              >
                {material}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.section}>
          <label className={styles.sectionLabel}>Objem:</label>
          <ul className={styles.list}>
            {volumes.map((vol, idx) => (
              <li
                key={vol}
                className={`${styles.item} ${idx === selectedVolumeIndex ? styles.selected : ''}`}
                onClick={() => onVolumeSelect(idx)}
              >
                {vol} ml
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.buttons}>
          <button className={styles.confirm} onClick={onConfirm}>
            Potvrdit pytlík (ENTER)
          </button>
          <button className={styles.noBag} onClick={onNoBag}>
            Bez pytlíku
          </button>
          <button className={styles.cancel} onClick={onCancel}>
            Zrušit (ESC)
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create BagModal.module.css**

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 80vh;
  overflow-y: auto;
}

.title {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
}

.section {
  margin-bottom: 20px;
}

.sectionLabel {
  display: block;
  font-weight: 600;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.item {
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  color: #555;
  background: #f9f9f9;
}

.item:hover {
  border-color: #4caf50;
  background: #f0f0f0;
}

.item.selected {
  border-color: #4caf50;
  background: #e8f5e9;
  font-weight: 600;
  color: #333;
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.confirm,
.noBag,
.cancel {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.confirm {
  background: #4caf50;
  color: #fff;
}

.confirm:hover {
  background: #45a049;
}

.noBag {
  background: #2196f3;
  color: #fff;
}

.noBag:hover {
  background: #0b7dda;
}

.cancel {
  background: #ddd;
  color: #333;
}

.cancel:hover {
  background: #ccc;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/pos/BagModal.tsx src/components/pos/BagModal.module.css
git commit -m "feat(pos): BagModal — modal dialog for bag selection"
```

---

## Task 6: Refactor POS.tsx — Split Layout & Keyboard Handler

**Files:**
- Modify: `frontend/src/pages/POS.tsx` (major rewrite)
- Modify: `frontend/src/pages/POS.module.css` (add flex split)

- [ ] **Step 1: Update POS.tsx imports**

Replace lines 1-17:

```typescript
import { useEffect, useCallback, useState } from 'react'
import { usePOS } from '../hooks/usePOS'
import { useAuthStore } from '../store/authStore'
import { getSales, getSaleItems } from '../api/sales'
import CategoryPanel from '../components/pos/CategoryPanel'
import TeaPanel from '../components/pos/TeaPanel'
import SearchResults from '../components/pos/SearchResults'
import QuantityModal from '../components/pos/QuantityModal'
import BagModal from '../components/pos/BagModal'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import { useToast } from '../components/toast/useToast'
import HistoryPanel from '../components/pos/HistoryPanel'
import SalesSummary from '../components/pos/SalesSummary'
import POSNavbar from '../components/pos/POSNavbar'
import type { Sale, SaleItem } from '../types'
import styles from './POS.module.css'
```

- [ ] **Step 2: Rewrite POS component structure**

Replace function body (lines 19-268) with:

```typescript
export default function POS() {
  const {
    state,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    confirm,
    setQuantity,
    setWantBag,
    startSearch,
    appendSearch,
    cancelItem,
    removeFromCart,
    clearCart,
  } = usePOS()

  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [showCheckout, setShowCheckout] = useState(false)
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'sell' | 'overview'>('sell')
  const [history, setHistory] = useState<Sale[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [saleItemsByIndex, setSaleItemsByIndex] = useState<Record<number, SaleItem[]>>({})
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const handleHistoryNavigation = useCallback(
    (direction: 'up' | 'down') => {
      if (activeTab !== 'overview' || history.length === 0) return
      const newIndex =
        direction === 'up'
          ? (historyIndex - 1 + history.length) % history.length
          : (historyIndex + 1) % history.length
      setHistoryIndex(newIndex)
      setSelectedSale(history[newIndex])
    },
    [activeTab, history, historyIndex],
  )

  // Keyboard handler: manage splitlayout + modals
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // If modal is open, handle modal-specific keys
      if (state.activeModal === 'quantity') {
        if (e.key === 'Enter') {
          e.preventDefault()
          setWantBag(true) // Open bag modal
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          cancelItem()
          return
        }
        // Let input handle arrows for quantity up/down
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setQuantity(state.quantity + 1)
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setQuantity(Math.max(1, state.quantity - 1))
          return
        }
        return
      }

      if (state.activeModal === 'bag') {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirm() // Finalize bag selection
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          cancelItem()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveUp() // Move through materials or volumes
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveDown()
          return
        }
        if (e.key === ' ') {
          e.preventDefault()
          setWantBag(false) // "No bag" button
          return
        }
        return
      }

      // No modal open: handle splitlayout navigation
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
    [state, moveUp, moveDown, moveLeft, moveRight, confirm, setQuantity, setWantBag, startSearch, cancelItem, activeTab, handleHistoryNavigation],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // History loading
  useEffect(() => {
    if (!selectedSale) {
      setSaleItems([])
      return
    }
    getSaleItems(selectedSale.id)
      .then((items) => setSaleItems(items))
      .catch(() => setSaleItems([]))
  }, [selectedSale])

  useEffect(() => {
    if (activeTab === 'sell') {
      setSelectedSale(null)
    }
  }, [activeTab])

  useEffect(() => {
    const today = new Date()
    const dateFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dateTo = new Date(dateFrom.getTime() + 24 * 60 * 60 * 1000 - 1)

    getSales({
      date_from: dateFrom.toISOString().split('T')[0],
      date_to: dateTo.toISOString().split('T')[0],
    })
      .then((sales) => {
        setHistory(sales)
        setHistoryLoading(false)
      })
      .catch((e) => {
        setHistoryError(e instanceof Error ? e.message : 'Chyba při načítání')
        setHistoryLoading(false)
      })
  }, [])

  useEffect(() => {
    if (history.length === 0) {
      setSaleItemsByIndex({})
      return
    }

    const promises = history.map((sale) =>
      getSaleItems(sale.id)
        .then((items) => ({ saleId: sale.id, items }))
        .catch((e) => {
          console.warn(`[History] Error loading items for sale ${sale.id}:`, e)
          return { saleId: sale.id, items: [] }
        }),
    )

    Promise.all(promises)
      .then((results) => {
        const map: Record<number, SaleItem[]> = {}
        for (const { saleId, items } of results) {
          map[saleId] = items
        }
        setSaleItemsByIndex(map)
      })
      .catch(() => setSaleItemsByIndex({}))
  }, [history])

  // Render teas for current category
  const displayTeas = state.searchQuery.length > 0 ? state.searchResults : state.teas

  // Render main content
  if (activeTab === 'overview') {
    return (
      <div className={styles.page}>
        <POSNavbar user={user} logout={logout} activeTab={activeTab} setActiveTab={setActiveTab} />
        <HistoryPanel
          history={history}
          historyIndex={historyIndex}
          selectedSale={selectedSale}
          saleItems={saleItems}
          loading={historyLoading}
          error={historyError}
        />
        <SalesSummary history={history} saleItems={saleItemsByIndex} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <POSNavbar user={user} logout={logout} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className={styles.main}>
        <div className={styles.splitLayout}>
          <CategoryPanel
            categories={state.categories}
            selectedIndex={state.categoryIndex}
            isActive={state.activePanel === 'categories' && !state.searchQuery}
            onSelect={(idx) => {
              // Select category
              const cat = state.categories[idx]
              if (cat) {
                // Manually trigger category select
                state.categoryIndex = idx
                confirm()
              }
            }}
          />

          <TeaPanel
            teas={displayTeas}
            selectedIndex={state.step === 'search' ? state.searchIndex : state.teaIndex}
            isActive={state.activePanel === 'teas' || state.searchQuery.length > 0}
            isFilterActive={state.searchQuery.length > 0}
            onSelect={() => {}}
          />
        </div>

        <Cart
          items={state.cart}
          onRemove={removeFromCart}
          onCheckout={() => setShowCheckout(true)}
          onClear={clearCart}
        />
      </div>

      {/* Modals */}
      {state.activeModal === 'quantity' && (
        <QuantityModal
          tea={state.selectedTea}
          quantity={state.quantity}
          onQuantityChange={setQuantity}
          onConfirm={() => setWantBag(true)}
          onCancel={cancelItem}
        />
      )}

      {state.activeModal === 'bag' && (
        <BagModal
          bags={state.bags}
          materials={state.bagMaterials}
          selectedMaterialIndex={state.materialIndex}
          volumes={state.bagVolumes}
          selectedVolumeIndex={state.volumeIndex}
          onMaterialSelect={(idx) => {
            // Handle material selection + update volumes
            // This is a bit complex, need to update reducer
          }}
          onVolumeSelect={(idx) => {
            // Handle volume selection
          }}
          onNoBag={() => setWantBag(false)}
          onConfirm={() => confirm()}
          onCancel={cancelItem}
        />
      )}

      {showCheckout && (
        <CheckoutDialog
          items={state.cart}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            clearCart()
            setShowCheckout(false)
          }}
        />
      )}
    </div>
  )
}
```

Wait — this is getting complicated with BagModal interacting with reducer. Let me refine the plan to add missing reducer actions for bag modal.

- [ ] **Step 3: Add missing reducer actions to usePOS**

In `usePOS.ts`, add to Action type:

```typescript
| { type: 'SET_MATERIAL_INDEX'; index: number }
| { type: 'SET_VOLUME_INDEX'; index: number }
```

And add cases in reducer:

```typescript
case 'SET_MATERIAL_INDEX': {
  const volumes = volumesForMaterial(state.bags, state.bagMaterials[action.index])
  return { ...state, materialIndex: action.index, bagVolumes: volumes, volumeIndex: 0 }
}

case 'SET_VOLUME_INDEX':
  return { ...state, volumeIndex: action.index }
```

And export in POSActions + callback in hook.

- [ ] **Step 4: Fix POS.tsx BagModal props**

After adding SET_MATERIAL_INDEX and SET_VOLUME_INDEX, update POS.tsx BagModal to:

```typescript
{state.activeModal === 'bag' && (
  <BagModal
    bags={state.bags}
    materials={state.bagMaterials}
    selectedMaterialIndex={state.materialIndex}
    volumes={state.bagVolumes}
    selectedVolumeIndex={state.volumeIndex}
    onMaterialSelect={setMaterialIndex}
    onVolumeSelect={setVolumeIndex}
    onNoBag={() => setWantBag(false)}
    onConfirm={confirm}
    onCancel={cancelItem}
  />
)}
```

- [ ] **Step 5: Add flex layout CSS to POS.module.css**

Add to `POS.module.css`:

```css
.main {
  display: flex;
  height: calc(100vh - 60px); /* navbar height */
  gap: 0;
}

.splitLayout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 6: Run tests**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/pages/POS.tsx src/pages/POS.module.css src/hooks/usePOS.ts
git commit -m "refactor(pos): split layout — categories left (25%), teas right (75%), keyboard navigation"
```

---

## Task 7: Update E2E Tests

**Files:**
- Modify: `frontend/tests/pos.spec.ts`

- [ ] **Step 1: Write new E2E test for split layout navigation**

Replace/add tests in `pos.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('POS: split layout — categories and teas visible on load', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Check that both panels render
  const categoryPanel = page.getByText('Kategorie')
  const teaPanel = page.getByText('Čaje')
  
  await expect(categoryPanel).toBeVisible()
  await expect(teaPanel).toBeVisible()
  
  // Check first category is highlighted
  const firstCategory = page.locator('[data-testid="category-item"]').first()
  await expect(firstCategory).toHaveClass(/selected/)
})

test('POS: keyboard navigation — up/down in categories', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  const firstCategory = page.locator('[data-testid="category-item"]').nth(0)
  const secondCategory = page.locator('[data-testid="category-item"]').nth(1)
  
  // First is selected
  await expect(firstCategory).toHaveClass(/selected/)
  
  // Press down arrow
  await page.keyboard.press('ArrowDown')
  await expect(secondCategory).toHaveClass(/selected/)
  
  // Press up arrow
  await page.keyboard.press('ArrowUp')
  await expect(firstCategory).toHaveClass(/selected/)
})

test('POS: keyboard navigation — right arrow moves to teas', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Press right to focus teas
  await page.keyboard.press('ArrowRight')
  
  // Tea panel should be active (not dimmed)
  const teaPanel = page.locator('[data-testid="panel"]').last()
  await expect(teaPanel).not.toHaveClass(/inactive/)
})

test('POS: keyboard navigation — left arrow returns to categories', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Move right to teas
  await page.keyboard.press('ArrowRight')
  
  // Move left back to categories
  await page.keyboard.press('ArrowLeft')
  
  // Category panel should be active
  const categoryPanel = page.locator('[data-testid="panel"]').first()
  await expect(categoryPanel).not.toHaveClass(/inactive/)
})

test('POS: quantity modal — opens on ENTER in teas', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Navigate to teas
  await page.keyboard.press('ArrowRight')
  
  // Press ENTER on a tea
  await page.keyboard.press('Enter')
  
  // Quantity modal should appear
  const modal = page.locator('[data-testid="quantity-modal"]')
  await expect(modal).toBeVisible()
})

test('POS: quantity modal — keyboard navigation (up/down)', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  
  // Quantity should be 1
  const input = page.locator('input[type="number"]')
  await expect(input).toHaveValue('1')
  
  // Press up arrow
  await page.keyboard.press('ArrowUp')
  await expect(input).toHaveValue('2')
  
  // Press down arrow
  await page.keyboard.press('ArrowDown')
  await expect(input).toHaveValue('1')
})

test('POS: filter — typing activates filter, categories disappear', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Type a search character
  await page.keyboard.press('d')
  
  // Category panel should be invisible
  const categoryPanel = page.locator('[data-testid="panel"]').first()
  await expect(categoryPanel).toHaveClass(/inactive/)
  
  // Tea panel should show filter indicator
  const filterLabel = page.getByText(/Filtr aktivní/)
  await expect(filterLabel).toBeVisible()
})

test('POS: filter — ESC clears filter', async ({ page }) => {
  await page.goto('http://localhost:5173/pos')
  
  // Type a search
  await page.keyboard.press('d')
  
  // Categories hidden
  let categoryPanel = page.locator('[data-testid="panel"]').first()
  await expect(categoryPanel).toHaveClass(/inactive/)
  
  // Press ESC
  await page.keyboard.press('Escape')
  
  // Categories visible again
  categoryPanel = page.locator('[data-testid="panel"]').first()
  await expect(categoryPanel).not.toHaveClass(/inactive/)
})
```

- [ ] **Step 2: Run E2E tests**

```bash
npx playwright test frontend/tests/pos.spec.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/pos.spec.ts
git commit -m "test(e2e): POS split layout — category/tea navigation, filter, modals"
```

---

## Task 8: Smoke Test — Manual Verification

- [ ] **Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

Expected: Server on http://localhost:5173

- [ ] **Step 2: Open POS page**

Navigate to http://localhost:5173/pos (login as `prodavacka` / `prodavacka123`)

- [ ] **Step 3: Verify layout**

- [ ] Left panel: categories visible, first is highlighted green
- [ ] Right panel: teas from first category visible
- [ ] Both panels full height
- [ ] Responsive: categories shrink to 25%, teas expand to 75%

- [ ] **Step 4: Verify keyboard navigation**

- [ ] ↑/↓ in categories: changes selection
- [ ] → in categories: focus moves to teas, categories dim
- [ ] ← in teas: focus moves to categories
- [ ] ↑/↓ in teas: changes selection

- [ ] **Step 5: Verify ENTER flow**

- [ ] ENTER on tea: quantity modal appears
- [ ] ↑/↓ in modal: quantity changes
- [ ] ENTER in modal: bag modal appears
- [ ] Space/↑/↓ in bag modal: material/volume selection
- [ ] ENTER in bag modal: item added to cart, back to layout
- [ ] ESC in any modal: cancels, back to layout

- [ ] **Step 6: Verify filter**

- [ ] Type 'd': categories disappear, only matching teas show
- [ ] Filter label "Filtr aktivní" shown
- [ ] ESC: filter cleared, categories reappear

- [ ] **Step 7: Commit if all OK**

```bash
git commit --allow-empty -m "test(smoke): POS split layout — manual verification passed"
```

---

## Summary

This plan implements the POS split layout refactor in 8 tasks:

1. ✓ Extend usePOS state machine (activePanel, activeModal)
2. ✓ Create CategoryPanel component
3. ✓ Create TeaPanel component
4. ✓ Create QuantityModal component
5. ✓ Create BagModal component
6. ✓ Refactor POS.tsx with split layout + keyboard handler
7. ✓ Update E2E tests
8. ✓ Smoke test + manual verification

**Total commits: ~12** (one per task, plus smoke test)

**Tests: 5 unit + 8 E2E** (all tasks include tests)

---
