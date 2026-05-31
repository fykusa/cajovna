# Cajovna Frontend — POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementovat klávesnicově ovládané POS rozhraní pro prodej čajů — výběr kategorie → čaj → množství → pytlík → košík → zaplacení.

**Architecture:** POS state machine řízená `usePOS` hookem (useReducer). Každý krok je diskrétní stav (category/tea/search/quantity/bag_yn/bag_material/bag_volume). Globální keydown handler na `document` řídí navigaci. Komponenty dostávají props ze storu — žádný vlastní stav. Testy ověřují hook i komponenty izolovaně.

**Tech Stack:** React 18, TypeScript, Vitest + RTL, CSS Modules, Playwright (E2E)

**Předpoklady:** Foundation plán (`cajovna-foundation.md`) musí být hotový — typy, API moduly, auth store.

---

## Souborová mapa

```
frontend/src/
  hooks/
    usePOS.ts                     ← POS state machine (useReducer)
    usePOS.test.ts
  components/pos/
    CategoryList.tsx + .module.css
    CategoryList.test.tsx
    TeaList.tsx + .module.css
    TeaList.test.tsx
    SearchResults.tsx + .module.css
    SearchResults.test.tsx
    QuantitySelector.tsx + .module.css
    QuantitySelector.test.tsx
    BagSelector.tsx + .module.css
    BagSelector.test.tsx
    Cart.tsx + .module.css
    Cart.test.tsx
    CheckoutDialog.tsx + .module.css
    CheckoutDialog.test.tsx
  pages/
    POS.tsx + POS.module.css      ← přepíše placeholder
    POS.test.tsx
e2e/
  pos-flow.spec.ts
```

---

## Task 6: usePOS hook — POS state machine

**Soubory:**
- Create: `frontend/src/hooks/usePOS.ts`
- Create: `frontend/src/hooks/usePOS.test.ts`

### Typy pro hook

```typescript
// Tyto typy jsou součástí usePOS.ts (export)
export type POSStep =
  | 'category'
  | 'tea'
  | 'search'
  | 'quantity'
  | 'bag_yn'
  | 'bag_material'
  | 'bag_volume'

export interface POSState {
  step: POSStep
  categories: Category[]
  teas: Tea[]         // čaje pro aktuální kategorii
  allTeas: Tea[]      // všechny čaje pro search
  bags: Bag[]
  categoryIndex: number
  teaIndex: number
  searchQuery: string
  searchResults: Tea[]
  searchIndex: number
  selectedCategory: Category | null
  selectedTea: Tea | null
  quantity: number
  wantBag: boolean      // krok bag_yn: true = Ano, false = Ne
  bagMaterials: string[]  // unikátní surface_type z bags
  materialIndex: number
  bagVolumes: number[]    // volume_ml pro vybraný material
  volumeIndex: number
  cart: CartItem[]
  loading: boolean
  error: string | null
}
```

- [ ] **Step 1: Napsat failing testy pro usePOS**

```typescript
// frontend/src/hooks/usePOS.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePOS } from './usePOS'

// Mock API volání
vi.mock('../api/products', () => ({
  getCategories: vi.fn(),
  getProducts: vi.fn(),
}))
vi.mock('../api/bags', () => ({
  getBags: vi.fn(),
}))

const mockGetCategories = vi.mocked((await import('../api/products')).getCategories)
const mockGetProducts = vi.mocked((await import('../api/products')).getProducts)
const mockGetBags = vi.mocked((await import('../api/bags')).getBags)

const CATEGORIES = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  { id: 2, name: 'Zelené', parent_id: null, sort_order: 2 },
  { id: 3, name: 'Japonské', parent_id: 2, sort_order: 1 },
]

const TEAS = [
  { id: 10, category_id: 1, name: 'Show Mee', note: null, flag: 'active' as const,
    origin: null, std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null,
    pkg1_price_moc: null, pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0.5 },
  { id: 11, category_id: 1, name: 'Bai Mu Dan', note: null, flag: 'active' as const,
    origin: null, std_weight_g: 30, std_price_moc: 220, pkg1_weight_g: null,
    pkg1_price_moc: null, pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 3, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 1.0 },
]

const BAGS = [
  { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 },
  { id: 2, surface_type: 'papír', volume_ml: 250, dimensions: null, price_per_piece: 3.63 },
  { id: 3, surface_type: 'bílý matný', volume_ml: 250, dimensions: null, price_per_piece: 3.88 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCategories.mockResolvedValue(CATEGORIES)
  mockGetProducts.mockResolvedValue(TEAS)
  mockGetBags.mockResolvedValue(BAGS)
})

describe('usePOS – inicializace', () => {
  it('načte kategorie, čaje a pytlíky při mount', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {}) // wait for effects
    expect(result.current.state.categories).toHaveLength(3)
    expect(result.current.state.allTeas).toHaveLength(2)
    expect(result.current.state.bags).toHaveLength(3)
    expect(result.current.state.step).toBe('category')
  })
})

describe('usePOS – navigace kategorií', () => {
  it('moveDown posune index dolů (circular)', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    expect(result.current.state.categoryIndex).toBe(0)
    act(() => result.current.moveDown())
    expect(result.current.state.categoryIndex).toBe(1)
    act(() => result.current.moveDown())
    act(() => result.current.moveDown())
    // circular: 3 kategorie, po 3x down zpět na 0
    expect(result.current.state.categoryIndex).toBe(0)
  })

  it('moveUp na začátku skočí na konec', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.moveUp())
    expect(result.current.state.categoryIndex).toBe(2) // 3 kategorie → index 2
  })

  it('confirm na kategorii přejde na krok tea', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('tea')
    expect(result.current.state.selectedCategory).toEqual(CATEGORIES[0])
  })
})

describe('usePOS – výběr čaje', () => {
  async function atTeaStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.confirm()) // přejde na tea
    await act(async () => {}) // načtení čajů
    return hook
  }

  it('confirm na čaji přejde na krok quantity', async () => {
    const { result } = await atTeaStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('quantity')
    expect(result.current.state.selectedTea).toEqual(TEAS[0])
    expect(result.current.state.quantity).toBe(1)
  })
})

describe('usePOS – množství', () => {
  async function atQuantityStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.confirm()) // category
    await act(async () => {})
    act(() => hook.result.current.confirm()) // tea
    return hook
  }

  it('moveUp zvýší množství o 1', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.moveUp())
    expect(result.current.state.quantity).toBe(2)
  })

  it('moveDown sníží množství (minimum 1)', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.moveDown())
    expect(result.current.state.quantity).toBe(1) // nezjde pod 1
  })

  it('setQuantity nastaví přesné množství', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.setQuantity(5))
    expect(result.current.state.quantity).toBe(5)
  })

  it('confirm na quantity přejde na bag_yn', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('bag_yn')
    expect(result.current.state.wantBag).toBe(true) // výchozí: Ano
  })
})

describe('usePOS – pytlík', () => {
  async function atBagYnStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.confirm()) // category
    await act(async () => {})
    act(() => hook.result.current.confirm()) // tea
    act(() => hook.result.current.confirm()) // quantity
    return hook
  }

  it('bez pytlíku (wantBag=false) přidá položku do košíku a vrátí na category', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.moveDown()) // wantBag = false
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.cart).toHaveLength(1)
    expect(result.current.state.cart[0].bag).toBeNull()
  })

  it('s pytlíkem (wantBag=true) přejde na bag_material', async () => {
    const { result } = await atBagYnStep()
    // wantBag je defaultně true
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('bag_material')
  })

  it('po výběru materiálu přejde na bag_volume', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.confirm()) // → bag_material
    act(() => result.current.confirm()) // vybere první materiál → bag_volume
    expect(result.current.state.step).toBe('bag_volume')
  })

  it('po výběru objemu přidá položku+pytlík do košíku a vrátí na category', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.confirm()) // → bag_material
    act(() => result.current.confirm()) // → bag_volume
    act(() => result.current.confirm()) // → přidá do košíku, → category
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.cart).toHaveLength(1)
    expect(result.current.state.cart[0].bag).not.toBeNull()
  })
})

describe('usePOS – search', () => {
  it('startSearch přejde na krok search a nastaví query', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('ban'))
    expect(result.current.state.step).toBe('search')
    expect(result.current.state.searchQuery).toBe('ban')
  })

  it('search filtruje čaje case-insensitive', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('show'))
    expect(result.current.state.searchResults).toHaveLength(1)
    expect(result.current.state.searchResults[0].name).toBe('Show Mee')
  })

  it('confirm ve search vybere čaj a přejde na quantity', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('show'))
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('quantity')
    expect(result.current.state.selectedTea?.name).toBe('Show Mee')
  })
})

describe('usePOS – košík', () => {
  it('removeFromCart smaže položku z košíku', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    // Přidáme položku bez pytlíku
    act(() => result.current.confirm()) // category
    await act(async () => {})
    act(() => result.current.confirm()) // tea
    act(() => result.current.confirm()) // quantity
    act(() => result.current.moveDown()) // wantBag = false
    act(() => result.current.confirm()) // přidá do košíku
    expect(result.current.state.cart).toHaveLength(1)
    const id = result.current.state.cart[0].localId
    act(() => result.current.removeFromCart(id))
    expect(result.current.state.cart).toHaveLength(0)
  })

  it('clearCart vyprázdní celý košík', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.confirm())
    await act(async () => {})
    act(() => result.current.confirm())
    act(() => result.current.confirm())
    act(() => result.current.moveDown())
    act(() => result.current.confirm())
    expect(result.current.state.cart).toHaveLength(1)
    act(() => result.current.clearCart())
    expect(result.current.state.cart).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Ověřit že testy padají**

```powershell
cd frontend && npm test -- usePOS.test.ts
```

Očekávaný výstup: `FAIL` — `Cannot find module './usePOS'`

- [ ] **Step 3: Implementovat usePOS.ts**

```typescript
// frontend/src/hooks/usePOS.ts
import { useReducer, useEffect, useCallback } from 'react'
import { Category, Tea, Bag, CartItem, ItemType } from '../types'
import { getCategories, getProducts } from '../api/products'
import { getBags } from '../api/bags'

export type POSStep =
  | 'category'
  | 'tea'
  | 'search'
  | 'quantity'
  | 'bag_yn'
  | 'bag_material'
  | 'bag_volume'

export interface POSState {
  step: POSStep
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

type Action =
  | { type: 'LOAD_DATA'; categories: Category[]; allTeas: Tea[]; bags: Bag[] }
  | { type: 'LOAD_TEAS'; teas: Tea[] }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'CONFIRM' }
  | { type: 'SET_QUANTITY'; value: number }
  | { type: 'START_SEARCH'; query: string }
  | { type: 'APPEND_SEARCH'; char: string }
  | { type: 'REMOVE_FROM_CART'; localId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_ERROR'; message: string }

const initialState: POSState = {
  step: 'category',
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

function searchFilter(teas: Tea[], query: string): Tea[] {
  const q = query.toLowerCase()
  return teas.filter((t) => t.name.toLowerCase().includes(q))
}

function uniqueMaterials(bags: Bag[]): string[] {
  return [...new Set(bags.map((b) => b.surface_type))]
}

function volumesForMaterial(bags: Bag[], material: string): number[] {
  return bags.filter((b) => b.surface_type === material).map((b) => b.volume_ml).sort((a, b) => a - b)
}

function makeBagItem(bags: Bag[], material: string, volume: number): Bag | null {
  return bags.find((b) => b.surface_type === material && b.volume_ml === volume) ?? null
}

function buildCartItem(
  tea: Tea,
  itemType: ItemType,
  quantity: number,
  bag: Bag | null
): CartItem {
  const unitPrice =
    itemType === 'std' ? (tea.std_price_moc ?? 0)
    : itemType === 'pkg1' ? (tea.pkg1_price_moc ?? 0)
    : itemType === 'pkg2' ? (tea.pkg2_price_moc ?? 0)
    : 0 // custom – cena se nastaví jinak; zatím 0

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

// Určí itemType podle dostupných balení
function resolveItemType(tea: Tea): ItemType {
  if (tea.std_price_moc != null) return 'std'
  if (tea.pkg1_price_moc != null) return 'pkg1'
  if (tea.pkg2_price_moc != null) return 'pkg2'
  return 'custom'
}

function reducer(state: POSState, action: Action): POSState {
  switch (action.type) {
    case 'LOAD_DATA': {
      const materials = uniqueMaterials(action.bags)
      return {
        ...state,
        categories: action.categories,
        allTeas: action.allTeas,
        bags: action.bags,
        bagMaterials: materials,
        loading: false,
      }
    }

    case 'LOAD_TEAS':
      return { ...state, teas: action.teas, teaIndex: 0 }

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
      if (state.step === 'quantity') {
        return { ...state, quantity: state.quantity + 1 }
      }
      if (state.step === 'bag_yn') {
        return { ...state, wantBag: !state.wantBag }
      }
      if (state.step === 'bag_material') {
        const len = state.bagMaterials.length
        return { ...state, materialIndex: (state.materialIndex - 1 + len) % len }
      }
      if (state.step === 'bag_volume') {
        const len = state.bagVolumes.length
        return { ...state, volumeIndex: (state.volumeIndex - 1 + len) % len }
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
      if (state.step === 'quantity') {
        return { ...state, quantity: Math.max(1, state.quantity - 1) }
      }
      if (state.step === 'bag_yn') {
        return { ...state, wantBag: !state.wantBag }
      }
      if (state.step === 'bag_material') {
        const len = state.bagMaterials.length
        return { ...state, materialIndex: (state.materialIndex + 1) % len }
      }
      if (state.step === 'bag_volume') {
        const len = state.bagVolumes.length
        return { ...state, volumeIndex: (state.volumeIndex + 1) % len }
      }
      return state
    }

    case 'SET_QUANTITY':
      return { ...state, quantity: Math.max(1, action.value) }

    case 'CONFIRM': {
      if (state.step === 'category') {
        const cat = state.categories[state.categoryIndex] ?? null
        return { ...state, step: 'tea', selectedCategory: cat, teaIndex: 0 }
      }

      if (state.step === 'tea') {
        const tea = state.teas[state.teaIndex] ?? null
        return { ...state, step: 'quantity', selectedTea: tea, quantity: 1 }
      }

      if (state.step === 'search') {
        const tea = state.searchResults[state.searchIndex] ?? null
        return {
          ...state,
          step: 'quantity',
          selectedTea: tea,
          quantity: 1,
          searchQuery: '',
          searchResults: [],
        }
      }

      if (state.step === 'quantity') {
        return { ...state, step: 'bag_yn', wantBag: true }
      }

      if (state.step === 'bag_yn') {
        if (!state.wantBag) {
          // Přidat do košíku bez pytlíku
          const item = buildCartItem(
            state.selectedTea!,
            resolveItemType(state.selectedTea!),
            state.quantity,
            null
          )
          return {
            ...state,
            step: 'category',
            cart: [...state.cart, item],
            selectedTea: null,
            quantity: 1,
            categoryIndex: 0,
          }
        }
        // Chce pytlík → bag_material
        const volumes = volumesForMaterial(state.bags, state.bagMaterials[state.materialIndex])
        return { ...state, step: 'bag_material', materialIndex: 0, bagVolumes: volumes }
      }

      if (state.step === 'bag_material') {
        const material = state.bagMaterials[state.materialIndex]
        const volumes = volumesForMaterial(state.bags, material)
        return { ...state, step: 'bag_volume', bagVolumes: volumes, volumeIndex: 0 }
      }

      if (state.step === 'bag_volume') {
        const material = state.bagMaterials[state.materialIndex]
        const volume = state.bagVolumes[state.volumeIndex]
        const bag = makeBagItem(state.bags, material, volume)
        const item = buildCartItem(
          state.selectedTea!,
          resolveItemType(state.selectedTea!),
          state.quantity,
          bag
        )
        return {
          ...state,
          step: 'category',
          cart: [...state.cart, item],
          selectedTea: null,
          quantity: 1,
          categoryIndex: 0,
        }
      }

      return state
    }

    case 'START_SEARCH': {
      const results = searchFilter(state.allTeas, action.query)
      return {
        ...state,
        step: 'search',
        searchQuery: action.query,
        searchResults: results,
        searchIndex: 0,
      }
    }

    case 'APPEND_SEARCH': {
      const query = state.searchQuery + action.char
      const results = searchFilter(state.allTeas, query)
      return { ...state, searchQuery: query, searchResults: results, searchIndex: 0 }
    }

    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter((i) => i.localId !== action.localId) }

    case 'CLEAR_CART':
      return { ...state, cart: [] }

    case 'SET_ERROR':
      return { ...state, error: action.message }

    default:
      return state
  }
}

export interface POSActions {
  moveUp: () => void
  moveDown: () => void
  confirm: () => void
  setQuantity: (v: number) => void
  startSearch: (query: string) => void
  appendSearch: (char: string) => void
  removeFromCart: (localId: string) => void
  clearCart: () => void
  loadTeasForCategory: (categoryId: number) => Promise<void>
}

export function usePOS(): { state: POSState } & POSActions {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Initial data load
  useEffect(() => {
    Promise.all([getCategories(), getProducts(), getBags()])
      .then(([categories, allTeas, bags]) => {
        dispatch({ type: 'LOAD_DATA', categories, allTeas, bags })
      })
      .catch((e) => dispatch({ type: 'SET_ERROR', message: e.message }))
  }, [])

  // Načítání čajů při změně kategorie
  useEffect(() => {
    if (state.step === 'tea' && state.selectedCategory) {
      getProducts({ category_id: state.selectedCategory.id })
        .then((teas) => dispatch({ type: 'LOAD_TEAS', teas }))
        .catch((e) => dispatch({ type: 'SET_ERROR', message: e.message }))
    }
  }, [state.step, state.selectedCategory])

  const moveUp = useCallback(() => dispatch({ type: 'MOVE_UP' }), [])
  const moveDown = useCallback(() => dispatch({ type: 'MOVE_DOWN' }), [])
  const confirm = useCallback(() => dispatch({ type: 'CONFIRM' }), [])
  const setQuantity = useCallback((v: number) => dispatch({ type: 'SET_QUANTITY', value: v }), [])
  const startSearch = useCallback((query: string) => dispatch({ type: 'START_SEARCH', query }), [])
  const appendSearch = useCallback((char: string) => dispatch({ type: 'APPEND_SEARCH', char }), [])
  const removeFromCart = useCallback((localId: string) => dispatch({ type: 'REMOVE_FROM_CART', localId }), [])
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), [])
  const loadTeasForCategory = useCallback(async (categoryId: number) => {
    const teas = await getProducts({ category_id: categoryId })
    dispatch({ type: 'LOAD_TEAS', teas })
  }, [])

  return { state, moveUp, moveDown, confirm, setQuantity, startSearch, appendSearch, removeFromCart, clearCart, loadTeasForCategory }
}
```

- [ ] **Step 4: Ověřit že testy prochází**

```powershell
npm test -- usePOS.test.ts
```

Očekávaný výstup: `PASS  ~18 passed`

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/src/hooks/
git commit -m "feat: usePOS state machine (category/tea/search/quantity/bag/cart)"
```

---

## Task 7: CategoryList komponenta

**Soubory:**
- Create: `frontend/src/components/pos/CategoryList.tsx`
- Create: `frontend/src/components/pos/CategoryList.module.css`
- Create: `frontend/src/components/pos/CategoryList.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/CategoryList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryList from './CategoryList'
import { Category } from '../../types'

const CATS: Category[] = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  { id: 2, name: 'Zelené', parent_id: null, sort_order: 2 },
  { id: 3, name: 'Oolong', parent_id: null, sort_order: 3 },
]

describe('CategoryList', () => {
  it('zobrazí všechny kategorie', () => {
    render(<CategoryList categories={CATS} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Bílé')).toBeInTheDocument()
    expect(screen.getByText('Zelené')).toBeInTheDocument()
    expect(screen.getByText('Oolong')).toBeInTheDocument()
  })

  it('označí aktivní položku třídou "active"', () => {
    render(<CategoryList categories={CATS} activeIndex={1} onSelect={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[1].className).toMatch(/active/)
    expect(items[0].className).not.toMatch(/active/)
  })

  it('zavolá onSelect s indexem při kliku', async () => {
    const onSelect = vi.fn()
    render(<CategoryList categories={CATS} activeIndex={0} onSelect={onSelect} />)
    screen.getByText('Zelené').click()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Ověřit že test padá**

```powershell
cd frontend && npm test -- CategoryList.test.tsx
```

Očekávaný výstup: `FAIL` — `Cannot find module './CategoryList'`

- [ ] **Step 3: Implementovat CategoryList.tsx**

```typescript
// frontend/src/components/pos/CategoryList.tsx
import { Category } from '../../types'
import styles from './CategoryList.module.css'

interface Props {
  categories: Category[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function CategoryList({ categories, activeIndex, onSelect }: Props) {
  return (
    <ul className={styles.list} role="list">
      {categories.map((cat, i) => (
        <li
          key={cat.id}
          className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
          onClick={() => onSelect(i)}
          role="listitem"
        >
          {cat.name}
        </li>
      ))}
    </ul>
  )
}
```

```css
/* frontend/src/components/pos/CategoryList.module.css */
.list { list-style: none; overflow-y: auto; height: 100%; }
.item { padding: 10px 16px; cursor: pointer; border-left: 3px solid transparent; }
.item:hover { background: #333; }
.active { background: #2a3a2a; border-left-color: #6abf69; color: #6abf69; font-weight: 600; }
```

- [ ] **Step 4: Ověřit že testy prochází**

```powershell
npm test -- CategoryList.test.tsx
```

Očekávaný výstup: `PASS  3 passed`

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/src/components/pos/CategoryList*
git commit -m "feat: CategoryList komponenta"
```

---

## Task 8: TeaList komponenta

**Soubory:**
- Create: `frontend/src/components/pos/TeaList.tsx`
- Create: `frontend/src/components/pos/TeaList.module.css`
- Create: `frontend/src/components/pos/TeaList.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/TeaList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeaList from './TeaList'
import { Tea } from '../../types'

const TEAS: Tea[] = [
  { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
    std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
    pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0.5 },
  { id: 2, category_id: 1, name: 'Bai Mu Dan', note: 'poznámka', flag: 'active', origin: null,
    std_weight_g: 30, std_price_moc: 220, pkg1_weight_g: 200, pkg1_price_moc: 700,
    pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 0, stock_pkg1_pcs: 2, stock_pkg2_pcs: 0, stock_kg: 1.0 },
]

describe('TeaList', () => {
  it('zobrazí název čaje a cenu', () => {
    render(<TeaList teas={TEAS} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText('Show Mee')).toBeInTheDocument()
    expect(screen.getByText(/130/)).toBeInTheDocument()
  })

  it('zobrazí poznámku pokud existuje', () => {
    render(<TeaList teas={TEAS} activeIndex={1} onSelect={vi.fn()} />)
    expect(screen.getByText('poznámka')).toBeInTheDocument()
  })

  it('označí aktivní položku', () => {
    render(<TeaList teas={TEAS} activeIndex={0} onSelect={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toMatch(/active/)
  })

  it('zavolá onSelect s indexem při kliku', () => {
    const onSelect = vi.fn()
    render(<TeaList teas={TEAS} activeIndex={0} onSelect={onSelect} />)
    screen.getByText('Bai Mu Dan').click()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Ověřit že test padá**

```powershell
cd frontend && npm test -- TeaList.test.tsx
```

Očekávaný výstup: `FAIL` — `Cannot find module './TeaList'`

- [ ] **Step 3: Implementovat TeaList.tsx**

```typescript
// frontend/src/components/pos/TeaList.tsx
import { Tea } from '../../types'
import styles from './TeaList.module.css'

interface Props {
  teas: Tea[]
  activeIndex: number
  onSelect: (index: number) => void
}

function primaryPrice(tea: Tea): number | null {
  return tea.std_price_moc ?? tea.pkg1_price_moc ?? tea.pkg2_price_moc
}

export default function TeaList({ teas, activeIndex, onSelect }: Props) {
  return (
    <ul className={styles.list} role="list">
      {teas.map((tea, i) => (
        <li
          key={tea.id}
          className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
          onClick={() => onSelect(i)}
          role="listitem"
        >
          <span className={styles.name}>{tea.name}</span>
          {tea.note && <span className={styles.note}>{tea.note}</span>}
          <span className={styles.price}>
            {primaryPrice(tea) != null ? `${primaryPrice(tea)} Kč` : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

```css
/* frontend/src/components/pos/TeaList.module.css */
.list { list-style: none; overflow-y: auto; height: 100%; }
.item { display: flex; align-items: baseline; gap: 8px; padding: 10px 16px;
        cursor: pointer; border-left: 3px solid transparent; }
.item:hover { background: #333; }
.active { background: #2a2a3a; border-left-color: #d4a84b; }
.name { flex: 1; }
.note { font-size: 0.8rem; color: #aaa; font-style: italic; }
.price { font-weight: 600; color: #d4a84b; white-space: nowrap; }
```

- [ ] **Step 4: Ověřit testy a commit**

```powershell
npm test -- TeaList.test.tsx
cd ..
git add frontend/src/components/pos/TeaList*
git commit -m "feat: TeaList komponenta"
```

---

## Task 9: SearchResults komponenta

**Soubory:**
- Create: `frontend/src/components/pos/SearchResults.tsx`
- Create: `frontend/src/components/pos/SearchResults.module.css`
- Create: `frontend/src/components/pos/SearchResults.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/SearchResults.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SearchResults from './SearchResults'
import { Tea } from '../../types'

const TEA: Tea = { id: 1, category_id: 1, name: 'Bancha', note: null, flag: 'active', origin: null,
  std_weight_g: 50, std_price_moc: 160, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 3, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0 }

describe('SearchResults', () => {
  it('zobrazí search query a počet výsledků', () => {
    render(<SearchResults query="ban" results={[TEA]} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText(/ban/i)).toBeInTheDocument()
    expect(screen.getByText('Bancha')).toBeInTheDocument()
  })

  it('zobrazí zprávu pokud nejsou výsledky', () => {
    render(<SearchResults query="xyz" results={[]} activeIndex={0} onSelect={vi.fn()} />)
    expect(screen.getByText(/nic nenalezeno/i)).toBeInTheDocument()
  })

  it('označí aktivní výsledek', () => {
    render(<SearchResults query="b" results={[TEA]} activeIndex={0} onSelect={vi.fn()} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toMatch(/active/)
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat**

```typescript
// frontend/src/components/pos/SearchResults.tsx
import { Tea } from '../../types'
import styles from './SearchResults.module.css'

interface Props {
  query: string
  results: Tea[]
  activeIndex: number
  onSelect: (index: number) => void
}

export default function SearchResults({ query, results, activeIndex, onSelect }: Props) {
  return (
    <div className={styles.container}>
      <p className={styles.query}>Hledám: <strong>{query}</strong></p>
      {results.length === 0 ? (
        <p className={styles.empty}>Nic nenalezeno</p>
      ) : (
        <ul className={styles.list} role="list">
          {results.map((tea, i) => (
            <li
              key={tea.id}
              className={`${styles.item} ${i === activeIndex ? styles.active : ''}`}
              onClick={() => onSelect(i)}
              role="listitem"
            >
              <span>{tea.name}</span>
              <span className={styles.price}>
                {tea.std_price_moc ?? tea.pkg1_price_moc ?? '—'} Kč
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

```css
/* frontend/src/components/pos/SearchResults.module.css */
.container { padding: 12px; }
.query { color: #aaa; font-size: 0.9rem; margin-bottom: 8px; }
.empty { color: #888; font-style: italic; }
.list { list-style: none; }
.item { display: flex; justify-content: space-between; padding: 10px 12px;
        cursor: pointer; border-radius: 4px; }
.item:hover { background: #333; }
.active { background: #2a2a3a; color: #d4a84b; }
.price { font-weight: 600; color: #d4a84b; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
npm test -- SearchResults.test.tsx
cd ..
git add frontend/src/components/pos/SearchResults*
git commit -m "feat: SearchResults komponenta"
```

---

## Task 10: QuantitySelector komponenta

**Soubory:**
- Create: `frontend/src/components/pos/QuantitySelector.tsx`
- Create: `frontend/src/components/pos/QuantitySelector.module.css`
- Create: `frontend/src/components/pos/QuantitySelector.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/QuantitySelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuantitySelector from './QuantitySelector'
import { Tea } from '../../types'

const TEA: Tea = { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
  std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: 200, pkg1_price_moc: 700,
  pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 5, stock_pkg1_pcs: 2, stock_pkg2_pcs: 0, stock_kg: 0.5 }

describe('QuantitySelector', () => {
  it('zobrazí název čaje a aktuální množství', () => {
    render(<QuantitySelector tea={TEA} quantity={2} onChange={vi.fn()} />)
    expect(screen.getByText('Show Mee')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('zavolá onChange při zadání čísla do inputu', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<QuantitySelector tea={TEA} quantity={1} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '5')
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('zobrazí dostupná balení s cenami', () => {
    render(<QuantitySelector tea={TEA} quantity={1} onChange={vi.fn()} />)
    expect(screen.getByText(/30 g/)).toBeInTheDocument()
    expect(screen.getByText(/130 Kč/)).toBeInTheDocument()
    expect(screen.getByText(/200 g/)).toBeInTheDocument()
    expect(screen.getByText(/700 Kč/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat**

```typescript
// frontend/src/components/pos/QuantitySelector.tsx
import { ChangeEvent } from 'react'
import { Tea } from '../../types'
import styles from './QuantitySelector.module.css'

interface Props {
  tea: Tea
  quantity: number
  onChange: (value: number) => void
}

export default function QuantitySelector({ tea, quantity, onChange }: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v) && v >= 1) onChange(v)
  }

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

  return (
    <div className={styles.container}>
      <h2 className={styles.teaName}>{tea.name}</h2>
      <div className={styles.row}>
        <label className={styles.label}>Množství:</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={handleChange}
          className={styles.input}
          autoFocus
        />
      </div>
      {baleni.length > 0 && (
        <ul className={styles.variants}>
          {baleni.map((b) => (
            <li key={b.label} className={styles.variant}>
              {b.label}: {b.weight} g — {b.price} Kč
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

```css
/* frontend/src/components/pos/QuantitySelector.module.css */
.container { padding: 24px; }
.teaName { font-size: 1.4rem; color: #d4a84b; margin-bottom: 20px; }
.row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.label { font-size: 1.1rem; }
.input { width: 80px; padding: 8px; font-size: 1.3rem; background: #333;
         border: 2px solid #d4a84b; border-radius: 4px; color: #eee; text-align: center; }
.variants { list-style: none; margin-top: 8px; }
.variant { color: #aaa; font-size: 0.9rem; padding: 2px 0; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
npm test -- QuantitySelector.test.tsx
cd ..
git add frontend/src/components/pos/QuantitySelector*
git commit -m "feat: QuantitySelector komponenta"
```

---

## Task 11: BagSelector komponenta

**Soubory:**
- Create: `frontend/src/components/pos/BagSelector.tsx`
- Create: `frontend/src/components/pos/BagSelector.module.css`
- Create: `frontend/src/components/pos/BagSelector.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/BagSelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BagSelector from './BagSelector'

describe('BagSelector – bag_yn krok', () => {
  it('zobrazí Ano/Ne a označí aktivní', () => {
    render(
      <BagSelector
        step="bag_yn"
        wantBag={true}
        materials={[]}
        materialIndex={0}
        volumes={[]}
        volumeIndex={0}
        onToggleWantBag={vi.fn()}
      />
    )
    expect(screen.getByText('Ano')).toBeInTheDocument()
    expect(screen.getByText('Ne')).toBeInTheDocument()
    const ano = screen.getByText('Ano').closest('li')!
    expect(ano.className).toMatch(/active/)
  })
})

describe('BagSelector – bag_material krok', () => {
  it('zobrazí dostupné materiály', () => {
    render(
      <BagSelector
        step="bag_material"
        wantBag={true}
        materials={['papír', 'bílý matný']}
        materialIndex={0}
        volumes={[]}
        volumeIndex={0}
        onToggleWantBag={vi.fn()}
      />
    )
    expect(screen.getByText('papír')).toBeInTheDocument()
    expect(screen.getByText('bílý matný')).toBeInTheDocument()
    const papir = screen.getByText('papír').closest('li')!
    expect(papir.className).toMatch(/active/)
  })
})

describe('BagSelector – bag_volume krok', () => {
  it('zobrazí dostupné objemy', () => {
    render(
      <BagSelector
        step="bag_volume"
        wantBag={true}
        materials={['papír']}
        materialIndex={0}
        volumes={[100, 250, 500]}
        volumeIndex={1}
        onToggleWantBag={vi.fn()}
      />
    )
    expect(screen.getByText('100 ml')).toBeInTheDocument()
    expect(screen.getByText('250 ml')).toBeInTheDocument()
    const ml250 = screen.getByText('250 ml').closest('li')!
    expect(ml250.className).toMatch(/active/)
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat**

```typescript
// frontend/src/components/pos/BagSelector.tsx
import { POSStep } from '../../hooks/usePOS'
import styles from './BagSelector.module.css'

interface Props {
  step: POSStep
  wantBag: boolean
  materials: string[]
  materialIndex: number
  volumes: number[]
  volumeIndex: number
  onToggleWantBag: () => void
}

export default function BagSelector({
  step, wantBag, materials, materialIndex, volumes, volumeIndex
}: Props) {
  if (step === 'bag_yn') {
    return (
      <div className={styles.container}>
        <p className={styles.title}>Chce pytlík?</p>
        <ul className={styles.list}>
          <li className={`${styles.item} ${wantBag ? styles.active : ''}`}>Ano</li>
          <li className={`${styles.item} ${!wantBag ? styles.active : ''}`}>Ne</li>
        </ul>
      </div>
    )
  }

  if (step === 'bag_material') {
    return (
      <div className={styles.container}>
        <p className={styles.title}>Materiál pytlíku</p>
        <ul className={styles.list}>
          {materials.map((m, i) => (
            <li key={m} className={`${styles.item} ${i === materialIndex ? styles.active : ''}`}>
              {m}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (step === 'bag_volume') {
    return (
      <div className={styles.container}>
        <p className={styles.title}>Objem pytlíku</p>
        <ul className={styles.list}>
          {volumes.map((v, i) => (
            <li key={v} className={`${styles.item} ${i === volumeIndex ? styles.active : ''}`}>
              {v} ml
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
}
```

```css
/* frontend/src/components/pos/BagSelector.module.css */
.container { padding: 24px; }
.title { font-size: 1.1rem; color: #aaa; margin-bottom: 12px; }
.list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.item { padding: 10px 16px; border-radius: 4px; cursor: default;
        border-left: 3px solid transparent; }
.active { background: #2a2a3a; border-left-color: #d4a84b; color: #d4a84b; font-weight: 600; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
npm test -- BagSelector.test.tsx
cd ..
git add frontend/src/components/pos/BagSelector*
git commit -m "feat: BagSelector komponenta (bag_yn / material / volume)"
```

---

## Task 12: Cart komponenta

**Soubory:**
- Create: `frontend/src/components/pos/Cart.tsx`
- Create: `frontend/src/components/pos/Cart.module.css`
- Create: `frontend/src/components/pos/Cart.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/Cart.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Cart from './Cart'
import { CartItem, Tea, Bag } from '../../types'

const TEA: Tea = { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active',
  origin: null, std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null, stock_std_pcs: 5, stock_pkg1_pcs: 0,
  stock_pkg2_pcs: 0, stock_kg: 0 }

const BAG: Bag = { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 }

const ITEM: CartItem = {
  localId: 'abc', tea: TEA, itemType: 'std', weightG: null,
  quantity: 1, unitPrice: 130, totalPrice: 130, bag: null,
}

const ITEM_WITH_BAG: CartItem = {
  localId: 'def', tea: TEA, itemType: 'std', weightG: null,
  quantity: 2, unitPrice: 130, totalPrice: 260, bag: BAG,
}

describe('Cart', () => {
  it('zobrazí položky košíku s cenami', () => {
    render(<Cart items={[ITEM, ITEM_WITH_BAG]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getAllByText('Show Mee')).toHaveLength(2)
    expect(screen.getByText('130 Kč')).toBeInTheDocument()
    expect(screen.getByText('260 Kč')).toBeInTheDocument()
  })

  it('zobrazí pytlík u položky pokud existuje', () => {
    render(<Cart items={[ITEM_WITH_BAG]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText(/papír.*100 ml/)).toBeInTheDocument()
  })

  it('zobrazí celkovou cenu košíku', () => {
    render(<Cart items={[ITEM, ITEM_WITH_BAG]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText('390 Kč')).toBeInTheDocument()
  })

  it('zavolá onRemove s localId při Delete kliku', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(<Cart items={[ITEM]} onRemove={onRemove} onCheckout={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /smazat|delete|×/i }))
    expect(onRemove).toHaveBeenCalledWith('abc')
  })

  it('zobrazí zprávu pro prázdný košík', () => {
    render(<Cart items={[]} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText(/košík je prázdný/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat**

```typescript
// frontend/src/components/pos/Cart.tsx
import { CartItem } from '../../types'
import styles from './Cart.module.css'

interface Props {
  items: CartItem[]
  onRemove: (localId: string) => void
  onCheckout: () => void
}

export default function Cart({ items, onRemove, onCheckout }: Props) {
  const total = items.reduce((sum, i) => sum + i.totalPrice + (i.bag?.price_per_piece ?? 0), 0)

  return (
    <div className={styles.cart}>
      <h2 className={styles.title}>Košík</h2>
      {items.length === 0 ? (
        <p className={styles.empty}>Košík je prázdný</p>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.localId} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.name}>{item.tea.name}</span>
                  <span className={styles.qty}>×{item.quantity}</span>
                  <span className={styles.price}>{item.totalPrice} Kč</span>
                  <button
                    className={styles.remove}
                    onClick={() => onRemove(item.localId)}
                    aria-label="smazat"
                  >
                    ×
                  </button>
                </div>
                {item.bag && (
                  <div className={styles.bag}>
                    {item.bag.surface_type} {item.bag.volume_ml} ml
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.footer}>
            <strong className={styles.total}>{Math.round(total)} Kč</strong>
            <button className={styles.checkoutBtn} onClick={onCheckout}>
              Zaplatit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

```css
/* frontend/src/components/pos/Cart.module.css */
.cart { display: flex; flex-direction: column; height: 100%; background: #222; }
.title { padding: 12px 16px; border-bottom: 1px solid #333; font-size: 1rem; color: #aaa; }
.empty { padding: 16px; color: #555; font-style: italic; }
.list { flex: 1; overflow-y: auto; list-style: none; }
.item { border-bottom: 1px solid #2a2a2a; padding: 8px 12px; }
.itemMain { display: flex; align-items: center; gap: 8px; }
.name { flex: 1; font-size: 0.95rem; }
.qty { color: #aaa; font-size: 0.85rem; }
.price { font-weight: 600; color: #d4a84b; white-space: nowrap; }
.remove { background: none; border: none; color: #888; cursor: pointer;
          font-size: 1.2rem; padding: 0 4px; }
.remove:hover { color: #f87171; }
.bag { font-size: 0.8rem; color: #888; margin-top: 2px; }
.footer { padding: 12px 16px; border-top: 1px solid #333;
          display: flex; justify-content: space-between; align-items: center; }
.total { font-size: 1.3rem; color: #6abf69; }
.checkoutBtn { padding: 8px 16px; background: #6abf69; color: #111;
               border: none; border-radius: 4px; font-weight: 700; cursor: pointer; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
npm test -- Cart.test.tsx
cd ..
git add frontend/src/components/pos/Cart*
git commit -m "feat: Cart komponenta s celkovou cenou"
```

---

## Task 13: CheckoutDialog komponenta

**Soubory:**
- Create: `frontend/src/components/pos/CheckoutDialog.tsx`
- Create: `frontend/src/components/pos/CheckoutDialog.module.css`
- Create: `frontend/src/components/pos/CheckoutDialog.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/components/pos/CheckoutDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutDialog from './CheckoutDialog'
import { CartItem, Tea } from '../../types'

vi.mock('../../api/sales', () => ({
  createSale: vi.fn(),
}))

const mockCreateSale = vi.mocked((await import('../../api/sales')).createSale)

const TEA: Tea = { id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active',
  origin: null, std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
  pkg2_weight_g: null, pkg2_price_moc: null, stock_std_pcs: 5, stock_pkg1_pcs: 0,
  stock_pkg2_pcs: 0, stock_kg: 0 }

const ITEMS: CartItem[] = [
  { localId: 'a', tea: TEA, itemType: 'std', weightG: null,
    quantity: 2, unitPrice: 130, totalPrice: 260, bag: null },
]

describe('CheckoutDialog', () => {
  it('zobrazí sumarizaci košíku a celkovou cenu', () => {
    render(<CheckoutDialog items={ITEMS} onSuccess={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Show Mee')).toBeInTheDocument()
    expect(screen.getByText(/260/)).toBeInTheDocument()
    expect(screen.getByText(/celkem/i)).toBeInTheDocument()
  })

  it('zavolá createSale a onSuccess po potvrzení', async () => {
    mockCreateSale.mockResolvedValueOnce({ sale_id: 42, total: 260 })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<CheckoutDialog items={ITEMS} onSuccess={onSuccess} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /zaplatit|potvrdit/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(mockCreateSale).toHaveBeenCalledTimes(1)
  })

  it('zavolá onCancel při stisknutí Zrušit', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<CheckoutDialog items={ITEMS} onSuccess={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: /zrušit|storno/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('zobrazí chybu při selhání API', async () => {
    mockCreateSale.mockRejectedValueOnce(new Error('Server error'))
    const user = userEvent.setup()
    render(<CheckoutDialog items={ITEMS} onSuccess={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /zaplatit|potvrdit/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat**

```typescript
// frontend/src/components/pos/CheckoutDialog.tsx
import { useState } from 'react'
import { CartItem, SalePayload } from '../../types'
import { createSale } from '../../api/sales'
import styles from './CheckoutDialog.module.css'

interface Props {
  items: CartItem[]
  onSuccess: () => void
  onCancel: () => void
}

export default function CheckoutDialog({ items, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((s, i) => s + i.totalPrice + (i.bag?.price_per_piece ?? 0), 0)

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const payload: SalePayload = {
        items: items.flatMap((item) => {
          const rows = [{
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
      onSuccess()
    } catch (e: any) {
      setError(e.message ?? 'Chyba při zápisu prodeje')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>Souhrn prodeje</h2>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.localId} className={styles.row}>
              <span>{item.tea.name} ×{item.quantity}</span>
              <span>{item.totalPrice} Kč</span>
            </li>
          ))}
        </ul>
        <p className={styles.total}>Celkem: <strong>{Math.round(total)} Kč</strong></p>
        <div className={styles.actions}>
          <button onClick={onCancel} className={styles.cancelBtn} disabled={loading}>
            Zrušit
          </button>
          <button onClick={handlePay} className={styles.payBtn} disabled={loading}>
            {loading ? 'Odesílám…' : 'Zaplatit'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* frontend/src/components/pos/CheckoutDialog.module.css */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7);
           display: flex; align-items: center; justify-content: center; z-index: 100; }
.dialog { background: #2a2a2a; border-radius: 8px; padding: 32px;
          min-width: 380px; max-width: 480px; width: 100%; }
.title { font-size: 1.4rem; color: #d4a84b; margin-bottom: 20px; }
.error { color: #f87171; background: #3f1515; padding: 8px; border-radius: 4px; margin-bottom: 12px; }
.list { list-style: none; margin-bottom: 16px; }
.row { display: flex; justify-content: space-between; padding: 6px 0;
       border-bottom: 1px solid #333; }
.total { font-size: 1.2rem; text-align: right; margin-bottom: 24px; color: #6abf69; }
.actions { display: flex; gap: 12px; justify-content: flex-end; }
.cancelBtn { padding: 10px 20px; background: #444; border: none; border-radius: 4px;
             color: #eee; cursor: pointer; }
.payBtn { padding: 10px 24px; background: #6abf69; border: none; border-radius: 4px;
          color: #111; font-weight: 700; cursor: pointer; }
.payBtn:disabled, .cancelBtn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3: Ověřit testy a commit**

```powershell
npm test -- CheckoutDialog.test.tsx
cd ..
git add frontend/src/components/pos/CheckoutDialog*
git commit -m "feat: CheckoutDialog s createSale API volanim"
```

---

## Task 14: POS stránka — sestavení a keyboard handler

**Soubory:**
- Modify: `frontend/src/pages/POS.tsx` (přepíše placeholder)
- Create: `frontend/src/pages/POS.module.css`
- Create: `frontend/src/pages/POS.test.tsx`

- [ ] **Step 1: Napsat failing test**

```typescript
// frontend/src/pages/POS.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import POS from './POS'

vi.mock('../api/products', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  ]),
  getProducts: vi.fn().mockResolvedValue([
    { id: 10, category_id: 1, name: 'Show Mee', note: null, flag: 'active', origin: null,
      std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null, pkg1_price_moc: null,
      pkg2_weight_g: null, pkg2_price_moc: null,
      stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0 },
  ]),
}))
vi.mock('../api/bags', () => ({
  getBags: vi.fn().mockResolvedValue([
    { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 },
  ]),
}))
vi.mock('../store/authStore', () => ({
  useAuthStore: (s: any) => s({ user: { id: 1, username: 'terka', role: 'prodavacka' }, token: 'tok', logout: vi.fn() }),
}))

describe('POS', () => {
  it('zobrazí kategorie po načtení', async () => {
    render(<POS />)
    expect(await screen.findByText('Bílé')).toBeInTheDocument()
  })

  it('Enter na kategorii přejde na výběr čaje', async () => {
    render(<POS />)
    await screen.findByText('Bílé')
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(await screen.findByText('Show Mee')).toBeInTheDocument()
  })

  it('psaní písmene otevře search mód', async () => {
    render(<POS />)
    await screen.findByText('Bílé')
    const user = userEvent.setup()
    await user.keyboard('s')
    expect(screen.getByText(/hledám/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ověřit fail → implementovat POS.tsx**

```typescript
// frontend/src/pages/POS.tsx
import { useEffect, useCallback } from 'react'
import { usePOS } from '../hooks/usePOS'
import { useAuthStore } from '../store/authStore'
import CategoryList from '../components/pos/CategoryList'
import TeaList from '../components/pos/TeaList'
import SearchResults from '../components/pos/SearchResults'
import QuantitySelector from '../components/pos/QuantitySelector'
import BagSelector from '../components/pos/BagSelector'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import { useState } from 'react'
import styles from './POS.module.css'

export default function POS() {
  const { state, moveUp, moveDown, confirm, setQuantity,
          startSearch, appendSearch, removeFromCart, clearCart } = usePOS()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [showCheckout, setShowCheckout] = useState(false)

  const handleKey = useCallback((e: KeyboardEvent) => {
    // Ignore pokud je focus na inputu (QuantitySelector input)
    if ((e.target as HTMLElement).tagName === 'INPUT') return

    switch (e.key) {
      case 'ArrowUp':   e.preventDefault(); moveUp(); break
      case 'ArrowDown': e.preventDefault(); moveDown(); break
      case 'Enter':
        if (state.step === 'category' || state.step === 'tea' || state.step === 'search'
            || state.step === 'bag_yn' || state.step === 'bag_material' || state.step === 'bag_volume') {
          confirm()
        } else if (state.step === 'quantity') {
          confirm()
        } else if (state.cart.length > 0 && state.step === 'category') {
          setShowCheckout(true)
        }
        break
      case 'Escape':
        if (state.step === 'search') startSearch('')
        break
      case 'Backspace':
        if (state.step === 'search' && state.searchQuery.length > 0) {
          startSearch(state.searchQuery.slice(0, -1))
        }
        break
      default:
        // Jakékoli tisknutelné písmeno → search mód
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (state.step === 'category' || state.step === 'tea') {
            startSearch(e.key)
          } else if (state.step === 'search') {
            appendSearch(e.key)
          }
        }
    }
  }, [state, moveUp, moveDown, confirm, startSearch, appendSearch])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function renderMainPanel() {
    if (state.step === 'search') {
      return (
        <SearchResults
          query={state.searchQuery}
          results={state.searchResults}
          activeIndex={state.searchIndex}
          onSelect={(i) => { /* index se nastavuje přes moveUp/Down, klik = confirm */ confirm() }}
        />
      )
    }
    if (state.step === 'tea') {
      return (
        <TeaList
          teas={state.teas}
          activeIndex={state.teaIndex}
          onSelect={(i) => { /* navigace přes klávesy */ }}
        />
      )
    }
    if (state.step === 'quantity' && state.selectedTea) {
      return (
        <QuantitySelector
          tea={state.selectedTea}
          quantity={state.quantity}
          onChange={setQuantity}
        />
      )
    }
    if (state.step === 'bag_yn' || state.step === 'bag_material' || state.step === 'bag_volume') {
      return (
        <BagSelector
          step={state.step}
          wantBag={state.wantBag}
          materials={state.bagMaterials}
          materialIndex={state.materialIndex}
          volumes={state.bagVolumes}
          volumeIndex={state.volumeIndex}
          onToggleWantBag={() => {}}
        />
      )
    }
    // Default: category
    return (
      <CategoryList
        categories={state.categories}
        activeIndex={state.categoryIndex}
        onSelect={() => {}}
      />
    )
  }

  if (state.loading) return <div className={styles.loading}>Načítám data…</div>
  if (state.error) return <div className={styles.error}>Chyba: {state.error}</div>

  return (
    <div className={styles.layout}>
      {/* Hlavička */}
      <header className={styles.header}>
        <span className={styles.username}>{user?.username}</span>
        <span className={styles.step}>Krok: {state.step}</span>
        <button onClick={logout} className={styles.logoutBtn}>Odhlásit</button>
      </header>

      {/* Hlavní obsah */}
      <main className={styles.main}>
        <section className={styles.panel}>
          {renderMainPanel()}
        </section>

        {/* Košík */}
        <aside className={styles.cartPanel}>
          <Cart
            items={state.cart}
            onRemove={removeFromCart}
            onCheckout={() => setShowCheckout(true)}
          />
        </aside>
      </main>

      {/* Checkout dialog */}
      {showCheckout && (
        <CheckoutDialog
          items={state.cart}
          onSuccess={() => {
            clearCart()
            setShowCheckout(false)
          }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </div>
  )
}
```

```css
/* frontend/src/pages/POS.module.css */
.layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.header { display: flex; align-items: center; gap: 16px; padding: 8px 16px;
          background: #222; border-bottom: 1px solid #333; }
.username { font-weight: 600; color: #d4a84b; }
.step { flex: 1; text-align: center; color: #666; font-size: 0.85rem; }
.logoutBtn { padding: 4px 12px; background: none; border: 1px solid #555;
             border-radius: 4px; color: #aaa; cursor: pointer; }
.main { display: flex; flex: 1; overflow: hidden; }
.panel { flex: 1; overflow-y: auto; border-right: 1px solid #333; }
.cartPanel { width: 320px; overflow: hidden; display: flex; flex-direction: column; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: #aaa; }
.error { display: flex; align-items: center; justify-content: center; height: 100vh; color: #f87171; }
```

- [ ] **Step 3: Ověřit testy, TypeScript a dev server**

```powershell
cd frontend
npm test -- POS.test.tsx
npx tsc --noEmit
npm run dev
```

Otevři `http://localhost:5173/pos` (po přihlášení). Ověř:
- Šipky nahoru/dolů navigují kategorie
- Enter potvrdí výběr kategorie → zobrazí se čaje
- Psaní písmene → search mód
- Enter ve search vybere čaj → přejde na množství
- Košík se zobrazuje napravo vždy
- Klik na Zaplatit → CheckoutDialog

- [ ] **Step 4: Commit**

```powershell
cd ..
git add frontend/src/pages/POS.tsx frontend/src/pages/POS.module.css frontend/src/pages/POS.test.tsx
git commit -m "feat: POS stranka s klavesnicovym ovladanim a checkout"
```

---

## Task 15: E2E test — kompletní prodejní flow

**Soubory:**
- Create: `frontend/e2e/pos-flow.spec.ts`
- Create: `frontend/playwright.config.ts`

> Předpoklad: Docker stack běží (`docker compose up -d`). V DB existuje uživatel admin/admin nebo prodavacka/heslo (dle setup_admin.php).

- [ ] **Step 1: Instalovat Playwright**

```powershell
cd frontend
npm init playwright@latest -- --quiet
```

Při dotazech zvolte: TypeScript, `e2e/` složka, ne pro GitHub Actions.

- [ ] **Step 2: Nahradit playwright.config.ts**

```typescript
// frontend/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 3: Napsat E2E test**

```typescript
// frontend/e2e/pos-flow.spec.ts
import { test, expect } from '@playwright/test'

// Přihlašovací údaje musejí existovat v DB
const CREDENTIALS = { username: 'admin', password: 'admin' }

test.describe('POS — kompletní prodejní flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Uživatelské jméno').fill(CREDENTIALS.username)
    await page.getByPlaceholder('Heslo').fill(CREDENTIALS.password)
    await page.getByRole('button', { name: 'Přihlásit' }).click()
    // Admin je přesměrován na /admin — naviguj manuálně na /pos
    await page.waitForURL(/\/(pos|admin)/)
    if (page.url().includes('/admin')) {
      await page.goto('/pos')
    }
    await page.waitForSelector('ul[role="list"]')
  })

  test('zobrazí seznam kategorií po přihlášení', async ({ page }) => {
    const items = page.getByRole('listitem')
    await expect(items.first()).toBeVisible()
  })

  test('šipka dolů posune zvýraznění na druhou kategorii', async ({ page }) => {
    const items = page.getByRole('listitem')
    const first = items.nth(0)
    const second = items.nth(1)
    await expect(first).toHaveClass(/active/)
    await page.keyboard.press('ArrowDown')
    await expect(second).toHaveClass(/active/)
    await expect(first).not.toHaveClass(/active/)
  })

  test('Enter vybere kategorii a zobrazí čaje', async ({ page }) => {
    await page.keyboard.press('Enter')
    // Počkáme na načtení čajů (nová ul s čaji)
    await page.waitForTimeout(500)
    const items = page.getByRole('listitem')
    await expect(items.first()).toBeVisible()
  })

  test('psaní písmene otevře search a filtruje výsledky', async ({ page }) => {
    await page.keyboard.type('ban')
    await expect(page.getByText(/hledám/i)).toBeVisible()
    await expect(page.getByText(/ban/i)).toBeVisible()
  })

  test('kompletní prodej bez pytlíku', async ({ page }) => {
    // 1. Vybrat první kategorii
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // 2. Vybrat první čaj
    await page.keyboard.press('Enter')

    // 3. Potvrdit množství (výchozí 1)
    await page.keyboard.press('Enter')

    // 4. Bez pytlíku (šipka dolů = Ne, Enter)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    // 5. Košík by měl mít 1 položku
    await expect(page.getByText(/košík je prázdný/i)).not.toBeVisible()

    // 6. Klik na Zaplatit
    await page.getByRole('button', { name: /zaplatit/i }).click()

    // 7. Checkout dialog
    await expect(page.getByText(/souhrn prodeje/i)).toBeVisible()

    // 8. Potvrdit platbu
    await page.getByRole('button', { name: /zaplatit/i }).last().click()

    // 9. Košík se vyprázdní
    await expect(page.getByText(/košík je prázdný/i)).toBeVisible()
  })
})
```

- [ ] **Step 4: Spustit E2E testy**

Docker musí běžet. Vite dev server musí běžet (`npm run dev` v jiném terminálu).

```powershell
cd frontend
npx playwright test
```

Očekávaný výstup: `5 passed` (nebo informace o selhaních s konkrétními kroky).

> Pokud selže přihlášení: ověř že v DB existuje uživatel. Spusť `http://localhost:8080/setup_admin.php` pro vytvoření admin/admin.

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/e2e/ frontend/playwright.config.ts
git commit -m "test: playwright e2e pos prodejni flow"
```

---

## Hotovo — POS je kompletní

Po dokončení všech tasků (6–15):
- ✅ usePOS state machine s plným testováním
- ✅ CategoryList, TeaList, SearchResults, QuantitySelector, BagSelector, Cart, CheckoutDialog
- ✅ POS stránka s globálním keyboard handlerem
- ✅ Playwright E2E test kompletního prodeje

**Pokračovat s:** `2026-05-28-cajovna-admin.md` — Admin stránky.
