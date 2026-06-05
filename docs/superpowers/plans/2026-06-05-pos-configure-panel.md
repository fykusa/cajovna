# POS Configure Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nahradit sekvenční flow `quantity → bag_yn → bag_material → bag_volume` jedním krokem `configure` se třemi vertikálními panely (Balení | Množství | Pytlík), navigovatelnými šipkami.

**Architecture:** Reducer v `usePOS.ts` dostane nový krok `configure` a dvě nová pole (`configPanel`, `packagingIndex`, `bagIndex`). Stará pole `wantBag/materialIndex/volumeIndex/bagVolumes` se odstraní. Nová komponenta `ConfigurePanel.tsx` zobrazí 3 panely najednou. Stávající `QuantityModal`, `QuantitySelector`, `BagSelector` se smažou.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, CSS Modules, Playwright E2E

---

## Přehled souborů

| Soubor | Akce |
|--------|------|
| `frontend/src/hooks/usePOS.ts` | Modify — nový krok, nová pole, nové reducer větve |
| `frontend/src/hooks/usePOS.test.ts` | Modify — aktualizovat/nahradit testy pro configure |
| `frontend/src/components/pos/ConfigurePanel.tsx` | Create |
| `frontend/src/components/pos/ConfigurePanel.module.css` | Create |
| `frontend/src/components/pos/ConfigurePanel.test.tsx` | Create |
| `frontend/src/pages/POS.tsx` | Modify — nová větev v renderMainPanel + kbd handler |
| `frontend/src/components/pos/QuantityModal.tsx` | Delete |
| `frontend/src/components/pos/QuantityModal.module.css` | Delete |
| `frontend/src/components/pos/QuantitySelector.tsx` | Delete |
| `frontend/src/components/pos/QuantitySelector.module.css` | Delete |
| `frontend/src/components/pos/BagSelector.tsx` | Delete |
| `frontend/src/components/pos/BagSelector.module.css` | Delete |
| `frontend/e2e/pos-flow.spec.ts` | Modify — aktualizovat E2E testy |

---

## Task 1: Reducer — nový krok `configure` v `usePOS.ts`

**Files:**
- Modify: `frontend/src/hooks/usePOS.ts`
- Modify: `frontend/src/hooks/usePOS.test.ts`

### 1.1 Napiš failing testy pro nový krok

- [ ] Otevři `frontend/src/hooks/usePOS.test.ts`

Nahraď celý `describe('usePOS – výběr čaje', ...)` blok (řádky ~98–105) a celé sekce `usePOS – množství` a `usePOS – pytlík` tímto:

```ts
describe('usePOS – výběr čaje → configure', () => {
  async function atTeaStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.moveRight())
    await act(async () => {})
    return hook
  }

  it('confirm na čaji přejde na krok configure s packagingIndex=0 a bagIndex=0', async () => {
    const { result } = await atTeaStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('configure')
    expect(result.current.state.selectedTea).toEqual(TEAS[0])
    expect(result.current.state.quantity).toBe(1)
    expect(result.current.state.configPanel).toBe('packaging')
    expect(result.current.state.packagingIndex).toBe(0)
    expect(result.current.state.bagIndex).toBe(0)
  })
})

describe('usePOS – configure navigace', () => {
  async function atConfigureStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.moveRight())
    await act(async () => {})
    act(() => hook.result.current.confirm())
    return hook
  }

  it('moveRight z packaging přejde na quantity', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    expect(result.current.state.configPanel).toBe('quantity')
  })

  it('moveRight z quantity přejde na bag', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    act(() => result.current.moveRight())
    expect(result.current.state.configPanel).toBe('bag')
  })

  it('moveRight z bag nic neudělá', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    act(() => result.current.moveRight())
    act(() => result.current.moveRight())
    expect(result.current.state.configPanel).toBe('bag')
  })

  it('moveLeft z bag přejde na quantity', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    act(() => result.current.moveRight())
    act(() => result.current.moveLeft())
    expect(result.current.state.configPanel).toBe('quantity')
  })

  it('moveLeft z packaging nic neudělá', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveLeft())
    expect(result.current.state.configPanel).toBe('packaging')
  })

  it('moveUp/Down v packaging mění packagingIndex (wrap)', async () => {
    // TEAS[0] má jen std → packagingOptions.length = 1, index se nezmění (wrap na sebe)
    const { result } = await atConfigureStep()
    act(() => result.current.moveDown())
    expect(result.current.state.packagingIndex).toBe(0)
    act(() => result.current.moveUp())
    expect(result.current.state.packagingIndex).toBe(0)
  })

  it('moveUp v quantity zvýší quantity', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight()) // přejdi na quantity panel
    act(() => result.current.moveUp())
    expect(result.current.state.quantity).toBe(2)
  })

  it('moveDown v quantity sníží quantity (min 1)', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    act(() => result.current.moveDown())
    expect(result.current.state.quantity).toBe(1) // nemůže jít pod 1
  })

  it('moveUp/Down v bag mění bagIndex (wrap)', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    act(() => result.current.moveRight()) // přejdi na bag panel
    // bagList = [Žádný, papír 100ml, papír 250ml, bílý matný 250ml] → 4 položky
    act(() => result.current.moveDown())
    expect(result.current.state.bagIndex).toBe(1)
    act(() => result.current.moveDown())
    act(() => result.current.moveDown())
    act(() => result.current.moveDown()) // wrap
    expect(result.current.state.bagIndex).toBe(0)
  })
})

describe('usePOS – configure confirm → košík', () => {
  async function atConfigureStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.moveRight())
    await act(async () => {})
    act(() => hook.result.current.confirm())
    return hook
  }

  it('confirm s bagIndex=0 přidá položku bez pytlíku', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.cart).toHaveLength(1)
    expect(result.current.state.cart[0].bag).toBeNull()
    expect(result.current.state.cart[0].itemType).toBe('std')
    expect(result.current.state.cart[0].quantity).toBe(1)
  })

  it('confirm s bagIndex>0 přidá položku s pytlíkem', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.moveRight())
    act(() => result.current.moveRight()) // bag panel
    act(() => result.current.moveDown())  // bagIndex=1 (papír 100ml)
    act(() => result.current.confirm())
    expect(result.current.state.cart).toHaveLength(1)
    expect(result.current.state.cart[0].bag).toEqual(BAGS[0])
  })

  it('confirm resetuje state a vrátí na category', async () => {
    const { result } = await atConfigureStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.selectedTea).toBeNull()
    expect(result.current.state.quantity).toBe(1)
    expect(result.current.state.bagIndex).toBe(0)
    expect(result.current.state.packagingIndex).toBe(0)
  })
})
```

- [ ] Spusť testy: `cd frontend && npm run test -- src/hooks/usePOS.test.ts`
- [ ] Ověř, že nové testy FAILUJÍ (staré testy pro quantity/bag_yn/bag_material/bag_volume budou stále procházet — to je v pořádku)

### 1.2 Aktualizuj `usePOS.ts` — typy a state

- [ ] V `usePOS.ts` uprav `POSStep`:

```ts
export type POSStep =
  | 'category'
  | 'tea'
  | 'search'
  | 'configure'
```

- [ ] Uprav `POSState` — přidej nová pole, odstraň stará:

```ts
export interface POSState {
  step: POSStep
  activePanel: 'categories' | 'teas'
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
  configPanel: 'packaging' | 'quantity' | 'bag'
  packagingIndex: number
  bagIndex: number
  cart: CartItem[]
  loading: boolean
  error: string | null
}
```

- [ ] Uprav `initialState`:

```ts
const initialState: POSState = {
  step: 'category',
  activePanel: 'categories',
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
  configPanel: 'packaging',
  packagingIndex: 0,
  bagIndex: 0,
  cart: [],
  loading: true,
  error: null,
}
```

### 1.3 Přidej helper funkce pro configure

- [ ] Přidej nad `reducer()` tyto helper funkce:

```ts
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
```

### 1.4 Aktualizuj reducer

- [ ] V `reducer()` — nahraď `case 'CONFIRM'` větev pro `tea`:

```ts
if (state.step === 'tea') {
  const tea = state.teas[state.teaIndex] ?? null
  return { ...state, step: 'configure', configPanel: 'packaging', packagingIndex: 0, bagIndex: 0, quantity: 1, selectedTea: tea }
}
if (state.step === 'search') {
  const tea = state.searchResults[state.searchIndex] ?? null
  return { ...state, step: 'configure', configPanel: 'packaging', packagingIndex: 0, bagIndex: 0, quantity: 1, selectedTea: tea, searchQuery: '', searchResults: [] }
}
```

- [ ] Nahraď větve `quantity`, `bag_yn`, `bag_material`, `bag_volume` v CONFIRM novou větví `configure`:

```ts
if (state.step === 'configure') {
  if (!state.selectedTea) return state
  const opts = getPackagingOptions(state.selectedTea)
  const opt = opts[state.packagingIndex] ?? opts[0]
  const bagList = getBagList(state.bags)
  const selectedBag = state.bagIndex === 0 ? null : (bagList[state.bagIndex]?.bag ?? null)
  const item = buildCartItem(state.selectedTea, opt?.type ?? 'std', state.quantity, selectedBag)
  return {
    ...state,
    step: 'category',
    activePanel: 'categories',
    cart: [...state.cart, item],
    selectedTea: null,
    quantity: 1,
    configPanel: 'packaging',
    packagingIndex: 0,
    bagIndex: 0,
  }
}
```

- [ ] Nahraď `case 'MOVE_LEFT'` a `case 'MOVE_RIGHT'` — přidej větve pro `configure`:

```ts
case 'MOVE_LEFT': {
  if (state.step === 'configure') {
    const next =
      state.configPanel === 'quantity' ? 'packaging' :
      state.configPanel === 'bag' ? 'quantity' :
      'packaging'
    return { ...state, configPanel: next }
  }
  return { ...state, activePanel: 'categories', step: 'category', searchQuery: '', searchResults: [] }
}

case 'MOVE_RIGHT': {
  if (state.step === 'configure') {
    const next =
      state.configPanel === 'packaging' ? 'quantity' :
      state.configPanel === 'quantity' ? 'bag' :
      'bag'
    return { ...state, configPanel: next }
  }
  if (state.step === 'category') {
    return { ...state, activePanel: 'teas', step: 'tea' }
  }
  if (state.step === 'search') {
    return { ...state, activePanel: 'teas', step: 'search' }
  }
  return state
}
```

- [ ] Nahraď `case 'MOVE_UP'` a `case 'MOVE_DOWN'` — odstraň větve `quantity/bag_yn/bag_material/bag_volume`, přidej `configure`:

V `MOVE_UP`, za existující větve pro `category/tea/search`, přidej:
```ts
if (state.step === 'configure') {
  if (state.configPanel === 'packaging') {
    const len = getPackagingOptions(state.selectedTea!).length
    if (len === 0) return state
    return { ...state, packagingIndex: (state.packagingIndex - 1 + len) % len }
  }
  if (state.configPanel === 'quantity') {
    return { ...state, quantity: state.quantity + 1 }
  }
  if (state.configPanel === 'bag') {
    const len = getBagList(state.bags).length
    return { ...state, bagIndex: (state.bagIndex - 1 + len) % len }
  }
}
```

V `MOVE_DOWN`, za existující větve pro `category/tea/search`, přidej:
```ts
if (state.step === 'configure') {
  if (state.configPanel === 'packaging') {
    const len = getPackagingOptions(state.selectedTea!).length
    if (len === 0) return state
    return { ...state, packagingIndex: (state.packagingIndex + 1) % len }
  }
  if (state.configPanel === 'quantity') {
    return { ...state, quantity: Math.max(1, state.quantity - 1) }
  }
  if (state.configPanel === 'bag') {
    const len = getBagList(state.bags).length
    return { ...state, bagIndex: (state.bagIndex + 1) % len }
  }
}
```

- [ ] Odstraň `resolveItemType` funkci (nahrazena `getPackagingOptions`)

- [ ] V `CANCEL_ITEM` odstraň pole `wantBag`, `materialIndex`, `volumeIndex`, `bagVolumes` — přidej resetování nových polí:

```ts
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
    configPanel: 'packaging',
    packagingIndex: 0,
    bagIndex: 0,
    searchQuery: '',
    searchResults: [],
    searchIndex: 0,
  }
```

### 1.5 Ověř a commitni

- [ ] Spusť testy: `cd frontend && npm run test -- src/hooks/usePOS.test.ts`
- [ ] Ověř PASS (nové configure testy + staré testy co nerozbijeme — testy bag_yn/bag_material/bag_volume budou FAIL, to je v pořádku, smažeme je v dalším kroku)
- [ ] Odstraň ze souboru `usePOS.test.ts` tyto zastaralé `describe` bloky:
  - `usePOS – množství` (celý blok)
  - `usePOS – pytlík` (celý blok)
- [ ] Spusť testy znovu a ověř všechny PASS
- [ ] `git add frontend/src/hooks/usePOS.ts frontend/src/hooks/usePOS.test.ts`
- [ ] `git commit -m "feat(pos): nový krok configure v usePOS — packaging/quantity/bag"`

---

## Task 2: Komponenta `ConfigurePanel`

**Files:**
- Create: `frontend/src/components/pos/ConfigurePanel.tsx`
- Create: `frontend/src/components/pos/ConfigurePanel.module.css`
- Create: `frontend/src/components/pos/ConfigurePanel.test.tsx`

### 2.1 Napiš failing testy

- [ ] Vytvoř `frontend/src/components/pos/ConfigurePanel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfigurePanel from './ConfigurePanel'
import type { Tea, Bag } from '../../types'

const TEA: Tea = {
  id: 1, category_id: 1, name: 'Show Mee', note: null, flag: 'active',
  origin: null,
  std_weight_g: 50, std_price_moc: 240,
  pkg1_weight_g: 200, pkg1_price_moc: 830,
  pkg2_weight_g: 500, pkg2_price_moc: 1990,
  stock_std_pcs: 5, stock_pkg1_pcs: 2, stock_pkg2_pcs: 1, stock_kg: 2,
}

const BAGS: Bag[] = [
  { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 },
  { id: 2, surface_type: 'papír', volume_ml: 250, dimensions: null, price_per_piece: 3.63 },
]

const bagList = [
  { bag: null, label: 'Žádný' },
  { bag: BAGS[0], label: 'papír 100 ml' },
  { bag: BAGS[1], label: 'papír 250 ml' },
]

const packagingOptions = [
  { type: 'std' as const, label: 'Std 50g', weightG: 50, price: 240 },
  { type: 'pkg1' as const, label: 'Bal 1 200g', weightG: 200, price: 830 },
  { type: 'pkg2' as const, label: 'Bal 2 500g', weightG: 500, price: 1990 },
]

const defaultProps = {
  tea: TEA,
  packagingOptions,
  packagingIndex: 0,
  quantity: 1,
  bagList,
  bagIndex: 0,
  activePanel: 'packaging' as const,
}

describe('ConfigurePanel', () => {
  it('zobrazí nadpisy 3 sekcí', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('Balení')).toBeInTheDocument()
    expect(screen.getByText('Množství')).toBeInTheDocument()
    expect(screen.getByText('Pytlík')).toBeInTheDocument()
  })

  it('zobrazí dostupná balení', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('Std 50g')).toBeInTheDocument()
    expect(screen.getByText('Bal 1 200g')).toBeInTheDocument()
    expect(screen.getByText('Bal 2 500g')).toBeInTheDocument()
  })

  it('zobrazí cenu aktivního balení', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('240 Kč')).toBeInTheDocument()
  })

  it('zobrazí aktuální množství', () => {
    render(<ConfigurePanel {...defaultProps} quantity={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('zobrazí seznam pytlíků', () => {
    render(<ConfigurePanel {...defaultProps} />)
    expect(screen.getByText('Žádný')).toBeInTheDocument()
    expect(screen.getByText('papír 100 ml')).toBeInTheDocument()
    expect(screen.getByText('papír 250 ml')).toBeInTheDocument()
  })

  it('aktivní panel má CSS třídu active', () => {
    const { container } = render(<ConfigurePanel {...defaultProps} activePanel="quantity" />)
    const sections = container.querySelectorAll('[data-panel]')
    const quantitySection = Array.from(sections).find(s => s.getAttribute('data-panel') === 'quantity')
    expect(quantitySection?.className).toMatch(/active/)
  })

  it('aktivní položka v balení má CSS třídu selected', () => {
    const { container } = render(<ConfigurePanel {...defaultProps} packagingIndex={1} />)
    const items = container.querySelectorAll('[data-panel="packaging"] li')
    expect(items[1]?.className).toMatch(/selected/)
  })

  it('aktivní položka v pytlíku má CSS třídu selected', () => {
    const { container } = render(<ConfigurePanel {...defaultProps} bagIndex={2} />)
    const items = container.querySelectorAll('[data-panel="bag"] li')
    expect(items[2]?.className).toMatch(/selected/)
  })
})
```

- [ ] Spusť: `cd frontend && npm run test -- src/components/pos/ConfigurePanel.test.tsx`
- [ ] Ověř FAIL (komponenta neexistuje)

### 2.2 Vytvoř CSS

- [ ] Vytvoř `frontend/src/components/pos/ConfigurePanel.module.css`:

```css
.container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
}

.section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
  background: #1a1a1a;
  transition: background 0.15s, border-color 0.15s;
  min-width: 0;
}

.section:last-child {
  border-right: none;
}

.section.active {
  background: #1e2a1e;
  border-top: 2px solid #4caf50;
}

.header {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  background: #222;
  border-bottom: 1px solid #333;
}

.section.active .header {
  color: #4caf50;
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
  cursor: default;
  border-left: 3px solid transparent;
  color: #aaa;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
}

.item.selected {
  background: #2a5a2a;
  border-left-color: #4caf50;
  color: #4caf50;
  font-weight: 500;
}

.quantityDisplay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
}

.quantityValue {
  font-size: 2.5rem;
  font-weight: 700;
  color: #eee;
  line-height: 1;
}

.quantityHint {
  font-size: 11px;
  color: #555;
}
```

### 2.3 Vytvoř komponentu

- [ ] Vytvoř `frontend/src/components/pos/ConfigurePanel.tsx`:

```tsx
import type { Tea, Bag } from '../../types'
import type { PackagingOption, BagListItem } from '../../hooks/usePOS'
import styles from './ConfigurePanel.module.css'

interface Props {
  tea: Tea
  packagingOptions: PackagingOption[]
  packagingIndex: number
  quantity: number
  bagList: BagListItem[]
  bagIndex: number
  activePanel: 'packaging' | 'quantity' | 'bag'
}

export default function ConfigurePanel({
  packagingOptions,
  packagingIndex,
  quantity,
  bagList,
  bagIndex,
  activePanel,
}: Props) {
  return (
    <div className={styles.container}>
      {/* Balení */}
      <div
        className={`${styles.section} ${activePanel === 'packaging' ? styles.active : ''}`}
        data-panel="packaging"
      >
        <div className={styles.header}>Balení</div>
        <ul className={styles.list}>
          {packagingOptions.map((opt, i) => (
            <li
              key={opt.type}
              className={`${styles.item} ${i === packagingIndex ? styles.selected : ''}`}
            >
              <span>{opt.label}</span>
              <span>{opt.price} Kč</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Množství */}
      <div
        className={`${styles.section} ${activePanel === 'quantity' ? styles.active : ''}`}
        data-panel="quantity"
      >
        <div className={styles.header}>Množství</div>
        <div className={styles.quantityDisplay}>
          <div className={styles.quantityValue}>{quantity}</div>
          <div className={styles.quantityHint}>↑↓ šipky</div>
        </div>
      </div>

      {/* Pytlík */}
      <div
        className={`${styles.section} ${activePanel === 'bag' ? styles.active : ''}`}
        data-panel="bag"
      >
        <div className={styles.header}>Pytlík</div>
        <ul className={styles.list}>
          {bagList.map((item, i) => (
            <li
              key={i}
              className={`${styles.item} ${i === bagIndex ? styles.selected : ''}`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] Spusť: `cd frontend && npm run test -- src/components/pos/ConfigurePanel.test.tsx`
- [ ] Ověř PASS
- [ ] `git add frontend/src/components/pos/ConfigurePanel.tsx frontend/src/components/pos/ConfigurePanel.module.css frontend/src/components/pos/ConfigurePanel.test.tsx`
- [ ] `git commit -m "feat(pos): ConfigurePanel — 3-panel balení/množství/pytlík"`

---

## Task 3: Integrace do `POS.tsx` + smazání starých komponent

**Files:**
- Modify: `frontend/src/pages/POS.tsx`
- Delete: `frontend/src/components/pos/QuantityModal.tsx` + `.module.css`
- Delete: `frontend/src/components/pos/QuantitySelector.tsx` + `.module.css`
- Delete: `frontend/src/components/pos/BagSelector.tsx` + `.module.css`

### 3.1 Aktualizuj `POS.tsx`

- [ ] V `POS.tsx` nahraď import `QuantityModal` importem `ConfigurePanel` a odstraň import `BagSelector`:

```ts
// Odstraň:
import QuantityModal from '../components/pos/QuantityModal'
import BagSelector from '../components/pos/BagSelector'

// Přidej:
import ConfigurePanel from '../components/pos/ConfigurePanel'
import { getPackagingOptions, getBagList } from '../hooks/usePOS'
```

- [ ] V `handleKey` nahraď blok pro `quantity/bag_*` kroky blokem pro `configure`:

Najdi tento blok (začíná přibližně na řádku 63):
```ts
if (['quantity', 'bag_yn', 'bag_material', 'bag_volume'].includes(state.step)) {
```

Nahraď celý tento blok:
```ts
if (state.step === 'configure') {
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
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    moveLeft()
    return
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    moveRight()
    return
  }
  return
}
```

- [ ] V `renderMainPanel()` nahraď větve `quantity` a `bag_*` novou větví:

Najdi a odstraň:
```ts
// Quantity modal — just show empty split layout, modal is rendered separately
if (state.step === 'quantity') { ... }

// Bag selector
if (state.step === 'bag_yn' || state.step === 'bag_material' || state.step === 'bag_volume') { ... }
```

Přidej:
```ts
if (state.step === 'configure' && state.selectedTea) {
  const packagingOptions = getPackagingOptions(state.selectedTea)
  const bagList = getBagList(state.bags)
  return (
    <div className={styles.splitLayout}>
      <ConfigurePanel
        tea={state.selectedTea}
        packagingOptions={packagingOptions}
        packagingIndex={state.packagingIndex}
        quantity={state.quantity}
        bagList={bagList}
        bagIndex={state.bagIndex}
        activePanel={state.configPanel}
      />
    </div>
  )
}
```

- [ ] Odstraň podmíněný render `<QuantityModal />` (blok přibližně na řádku 359):

```tsx
// Odstraň celý tento blok:
{state.step === 'quantity' && state.selectedTea && (
  <QuantityModal ... />
)}
```

- [ ] V `useCallback` dependencies array v `handleKey` odstraň `setQuantity` (už se nepoužívá)

### 3.2 Smaž zastaralé soubory

- [ ] Smaž soubory:

```powershell
Remove-Item frontend/src/components/pos/QuantityModal.tsx
Remove-Item frontend/src/components/pos/QuantityModal.module.css
Remove-Item frontend/src/components/pos/QuantitySelector.tsx
Remove-Item frontend/src/components/pos/QuantitySelector.module.css
Remove-Item frontend/src/components/pos/BagSelector.tsx
Remove-Item frontend/src/components/pos/BagSelector.module.css
Remove-Item frontend/e2e/quantity-modal.spec.ts
```

### 3.3 Ověř build a testy

- [ ] Spusť TypeScript check: `cd frontend && npx tsc --noEmit`
- [ ] Oprav případné TS chyby (pravděpodobně `setQuantity` v dependencies array)
- [ ] Spusť unit testy: `npm run test`
- [ ] Ověř všechny PASS (146+ testů)
- [ ] `git add -A`
- [ ] `git commit -m "feat(pos): integrace ConfigurePanel do POS.tsx — smazány QuantityModal/BagSelector"`

---

## Task 4: Aktualizace E2E testů

**Files:**
- Modify: `frontend/e2e/pos-flow.spec.ts`

### 4.1 Aktualizuj E2E test pro kompletní prodej

- [ ] V `frontend/e2e/pos-flow.spec.ts` najdi test `kompletní prodej bez pytlíku` (řádek ~68)

Nahraď kroky po výběru čaje (od řádku `// Step 3: quantity` dál):

```ts
test('kompletní prodej bez pytlíku', async ({ page }) => {
  await login(page)

  // Step 1: category — press Enter to confirm first category
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: tea')).toBeVisible({ timeout: 10_000 })

  // Step 2: tea — wait for teas to load, then confirm first tea
  const teaList = page.getByRole('list').first()
  await expect(teaList.getByRole('listitem').first()).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: configure')).toBeVisible({ timeout: 5_000 })

  // Step 3: configure — balení je aktivní, ArrowRight → množství, ArrowRight → pytlík
  // Zůstaňme na výchozí konfiguraci (Std, množství 1, žádný pytlík)
  // Enter potvrdí prodej
  await page.keyboard.press('Enter')

  // Vrátíme se na category
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 5_000 })

  // Cart must have exactly 1 item
  const cartHeading = page.getByRole('heading', { name: 'Košík' })
  await expect(cartHeading).toBeVisible()
  const payBtn = page.getByRole('button', { name: 'Zaplatit' })
  await expect(payBtn).toBeVisible()
})
```

- [ ] Spusť E2E testy: `npx playwright test e2e/pos-flow.spec.ts --grep "kompletní prodej"`
- [ ] Ověř PASS

### 4.2 Ověř zbývající E2E testy

- [ ] Spusť celý pos-flow: `npx playwright test e2e/pos-flow.spec.ts`
- [ ] Oprav případné failing testy (pravděpodobně testy co testovaly bag_yn kroky)
- [ ] `git add frontend/e2e/pos-flow.spec.ts`
- [ ] `git commit -m "test(e2e): aktualizace pos-flow testů pro configure krok"`

---

## Závěrečná kontrola

- [ ] `cd frontend && npm run test` — všechny unit testy PASS
- [ ] `npx playwright test` — E2E testy PASS
- [ ] Ručně otestuj v prohlížeči (http://localhost:5173, přihlásit jako `prodavacka/prodavacka123`):
  - Vyber kategorii → Enter
  - Vyber čaj → Enter
  - Ověř 3 panely: Balení | Množství | Pytlík
  - ArrowRight přepne na Množství, ArrowUp/Down mění číslo
  - ArrowRight přepne na Pytlík, ArrowUp/Down listuje
  - ArrowLeft se vrátí zpět
  - Enter přidá do košíku
  - Escape zruší a vrátí na kategorii
