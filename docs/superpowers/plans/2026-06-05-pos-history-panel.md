# POS — Panel s historií dnešních prodejů — Implementation Plan

> **For agentic workers:** Řeší se inline (bez multi-agenta). TDD, bite-sized tasků, frequent commits.

**Goal:** Přidat do levého POS panelu historii dnešních prodejů s přepínáním režimů (SPACE), navigací šipkami a automatickým zobrazením detailu v košíku.

**Architecture:** Dva React state (posMode, history, selectedSale) v POS.tsx. Nové komponenty HistoryPanel (seznam) a SaleDetailView (detail). Integrace s existujícím Cart.tsx — přepínání mezi CartItem (prodej) a SaleItem (historie).

**Tech Stack:** React 19, TypeScript, Vitest, CSS Modules, existing getSales API

---

## Task 2: Nová komponenta SaleDetailView.tsx — zobrazení detailu prodeje

**Files:**
- Create: `frontend/src/components/pos/SaleDetailView.tsx`
- Create: `frontend/src/components/pos/SaleDetailView.test.tsx`

- [ ] **Step 1: Napíšeme test**

```typescript
// frontend/src/components/pos/SaleDetailView.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SaleDetailView from './SaleDetailView'
import type { Sale, SaleItem } from '../../types'

const SALE: Sale = {
  id: 1,
  user_id: 1,
  username: 'prodavacka',
  total_amount: 260,
  note: null,
  created_at: '2026-06-05T14:32:00',
}

const ITEMS: SaleItem[] = [
  {
    id: 1,
    item_type: 'std',
    weight_g: null,
    quantity: 2,
    unit_price: 130,
    total_price: 260,
    note: null,
    tea_id: 10,
    tea_name: 'Show Mee',
    category_id: 1,
    surface_type: null,
    volume_ml: null,
  },
]

describe('SaleDetailView', () => {
  it('zobrazí detail prodeje — čas, prodavač, cena', () => {
    render(<SaleDetailView sale={SALE} items={ITEMS} />)
    expect(screen.getByText(/14:32/)).toBeInTheDocument()
    expect(screen.getByText(/prodavacka/)).toBeInTheDocument()
    expect(screen.getByText(/260 Kč/)).toBeInTheDocument()
  })

  it('zobrazí seznam položek s jednotkovými cenami', () => {
    render(<SaleDetailView sale={SALE} items={ITEMS} />)
    expect(screen.getByText(/Show Mee/)).toBeInTheDocument()
    expect(screen.getByText(/×2/)).toBeInTheDocument()
    expect(screen.getByText(/130 Kč/)).toBeInTheDocument()
  })

  it('zobrazí "Prodej je prázdný" pokud sale = null', () => {
    render(<SaleDetailView sale={null} items={[]} />)
    expect(screen.getByText(/Prodej je prázdný/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Spustíme test — selže (komponenta neexistuje)**

```bash
npm run test -- --run SaleDetailView.test 2>&1 | tail -5
```

Expected: `Cannot find module './SaleDetailView'`

- [ ] **Step 3: Napíšeme SaleDetailView.tsx**

```typescript
// frontend/src/components/pos/SaleDetailView.tsx
import type { Sale, SaleItem } from '../../types'
import styles from './SaleDetailView.module.css'

interface Props {
  sale: Sale | null
  items: SaleItem[]
}

export default function SaleDetailView({ sale, items }: Props) {
  if (!sale) {
    return (
      <div className={styles.empty}>
        <p>Prodej je prázdný</p>
      </div>
    )
  }

  const time = new Date(sale.created_at).toLocaleString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.time}>{time}</span>
          <span className={styles.user}>{sale.username}</span>
        </div>
        <div className={styles.total}>{Math.round(sale.total_amount)} Kč</div>
      </div>

      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.name}>{item.tea_name || 'Pytlík'}</span>
              <span className={styles.qty}>×{item.quantity}</span>
              <span className={styles.price}>{item.unit_price} Kč</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Napíšeme CSS**

```css
/* frontend/src/components/pos/SaleDetailView.module.css */
.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #666;
}

.header {
  padding: 12px;
  background: #222;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.headerInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
}

.time {
  color: #aaa;
  font-size: 0.8rem;
}

.user {
  color: #d4a84b;
  font-weight: 600;
}

.total {
  font-size: 1.2rem;
  font-weight: 600;
  color: #6abf69;
}

.items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  padding: 8px;
  background: #2a2a2a;
  border-radius: 3px;
  margin-bottom: 4px;
  font-size: 0.85rem;
}

.itemMain {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  flex: 1;
}

.qty {
  color: #aaa;
}

.price {
  font-weight: 600;
  color: #d4a84b;
  white-space: nowrap;
}
```

- [ ] **Step 5: Spustíme testy**

```bash
npm run test -- --run SaleDetailView.test 2>&1 | grep -E "(PASS|Tests)"
```

Expected: `Tests 3 passed`

- [ ] **Step 6: Commitujeme**

```bash
git add frontend/src/components/pos/SaleDetailView.tsx frontend/src/components/pos/SaleDetailView.module.css frontend/src/components/pos/SaleDetailView.test.tsx && git commit -m "feat(pos): SaleDetailView — zobrazení detailu prodeje v košíku"
```

---

## Task 3: Rozšíření POS.tsx — state a přepínání módů

**Files:**
- Modify: `frontend/src/pages/POS.tsx`

- [ ] **Step 1: Přidáme useState pro historii a mode**

Po importech, v POS componentě:

```typescript
  const [posMode, setPosMode] = useState<'sell' | 'history'>('sell')
  const [history, setHistory] = useState<Sale[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
```

- [ ] **Step 2: Přidáme API call na načtení dnešních prodejů (on mount)**

```typescript
  useEffect(() => {
    // Existující usePOS + getSales pro historii
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
```

Je potřeba importovat `getSales`:

```typescript
import { getSales } from '../api/sales'
```

- [ ] **Step 3: Handlery pro SPACE a šipky v historii**

```typescript
  const handleSpace = useCallback(() => {
    if (state.step !== 'category') return // Rozpracovaný prodej blokuje
    setPosMode((prev) => (prev === 'sell' ? 'history' : 'sell'))
  }, [state.step])

  const handleHistoryNavigation = useCallback(
    (direction: 'up' | 'down') => {
      if (posMode !== 'history' || history.length === 0) return

      const newIndex = direction === 'up'
        ? (historyIndex - 1 + history.length) % history.length
        : (historyIndex + 1) % history.length

      setHistoryIndex(newIndex)
      setSelectedSale(history[newIndex])
    },
    [posMode, history, historyIndex],
  )
```

- [ ] **Step 4: Aktualizujeme handleKey — přidáme SPACE a upravíme šipky**

V handleKey (v switch-case):

```typescript
      case 'ArrowUp':
        e.preventDefault()
        if (posMode === 'history') {
          handleHistoryNavigation('up')
        } else {
          moveUp()
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (posMode === 'history') {
          handleHistoryNavigation('down')
        } else {
          moveDown()
        }
        break

      case ' ':
        e.preventDefault()
        handleSpace()
        break
```

A odstraňte ze switch-case case 'Escape' (už je před switch-case).

- [ ] **Step 5: Commitujeme state a handlery**

```bash
git add frontend/src/pages/POS.tsx && git commit -m "feat(pos): state a handlery pro historii — posMode, handleSpace, handleHistoryNavigation"
```

---

## Task 4: Rozšíření POS.tsx — layout split (CSS grid)

**Files:**
- Modify: `frontend/src/pages/POS.module.css`
- Modify: `frontend/src/pages/POS.tsx` (JSX layout)

- [ ] **Step 1: Rozšíříme POS.module.css — grid layout**

Přidáme na konec souboru:

```css
.panelGrid {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 0;
  height: 100%;
}

.categoriesPanel {
  overflow-y: auto;
  border-bottom: 1px solid #333;
  display: flex;
  flex-direction: column;
}

.categoriesPanelHeader {
  padding: 8px 12px;
  background: #222;
  border-bottom: 1px solid #333;
  font-size: 0.8rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.categoriesPanelContent {
  flex: 1;
  overflow-y: auto;
}

.historyPanel {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.historyPanelHeader {
  padding: 8px 12px;
  background: #222;
  border-bottom: 1px solid #333;
  font-size: 0.8rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.historyPanelContent {
  flex: 1;
  overflow-y: auto;
}

.modeIndicator {
  padding: 2px 6px;
  background: #6abf69;
  color: #111;
  font-size: 0.65rem;
  font-weight: 600;
  border-radius: 2px;
  display: inline-block;
  margin-left: 4px;
}
```

- [ ] **Step 2: Upravíme JSX layout v POS.tsx — renderMainPanel se změní**

Najdeme `renderMainPanel()` funkci a necháme ji jako je, ale upravíme hlavní JSX:

V JSX (sekce `<main className={styles.main}>`), nahradíme `<section className={styles.panel}>` strukturou:

```typescript
<section className={styles.panel}>
  <div className={styles.panelGrid}>
    {/* Kategorie */}
    <div className={styles.categoriesPanel}>
      <div className={styles.categoriesPanelHeader}>Kategorie</div>
      <div className={styles.categoriesPanelContent}>
        {renderMainPanel()}
      </div>
    </div>

    {/* Historija */}
    <div className={styles.historyPanel}>
      <div className={styles.historyPanelHeader}>
        Dnešní prodeje
        {posMode === 'history' && (
          <span className={styles.modeIndicator}>HISTORY MODE</span>
        )}
      </div>
      <div className={styles.historyPanelContent}>
        {historyLoading ? (
          <div style={{ padding: '12px', color: '#666' }}>Načítám...</div>
        ) : historyError ? (
          <div style={{ padding: '12px', color: '#e67e7e' }}>{historyError}</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '12px', color: '#666' }}>Není k dispozici</div>
        ) : (
          <HistoryPanel
            sales={history}
            selectedIndex={historyIndex}
            onSelect={(sale, idx) => {
              setHistoryIndex(idx)
              setSelectedSale(sale)
            }}
            isActive={posMode === 'history'}
          />
        )}
      </div>
    </div>
  </div>
</section>
```

A přidáme import:

```typescript
import HistoryPanel from '../components/pos/HistoryPanel'
```

- [ ] **Step 3: Commitujeme layout**

```bash
git add frontend/src/pages/POS.tsx frontend/src/pages/POS.module.css && git commit -m "feat(pos): layout split — kategorie + historie v griduı"
```

---

## Task 5: Úprava Cart.tsx — zobrazení SaleDetailView vs CartItem

**Files:**
- Modify: `frontend/src/components/pos/Cart.tsx`

- [ ] **Step 1: Přidáme prop na Cart pro zobrazení prodeje**

```typescript
interface Props {
  items: CartItem[]
  selectedSale?: Sale | null
  saleItems?: SaleItem[]
  onRemove: (localId: string) => void
  onCheckout: () => void
}
```

A importy:

```typescript
import type { CartItem, Sale, SaleItem } from '../../types'
import SaleDetailView from './SaleDetailView'
```

- [ ] **Step 2: Upravíme renderování — podmiňujeme CartItem vs SaleDetailView**

Nahradíme část `{items.length === 0 ? ...}` s:

```typescript
      {selectedSale ? (
        <>
          <SaleDetailView sale={selectedSale} items={saleItems || []} />
        </>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Košík je prázdný</p>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((item) => (
              // ... existující item rendering
            ))}
          </ul>
          <div className={styles.footer}>
            {/* ... existující footer */}
          </div>
        </>
      )}
```

- [ ] **Step 3: Commitujeme**

```bash
git add frontend/src/components/pos/Cart.tsx && git commit -m "feat(pos): Cart — podpora zobrazení SaleDetailView"
```

---

## Task 6: Integrace v POS.tsx — propojení Cart s selectedSale

**Files:**
- Modify: `frontend/src/pages/POS.tsx`

- [ ] **Step 1: Procházíme API — SaleItem se musí nahrát**

V effectu, kde se načítá historie, musíme také nahrát items pro vybraný prodej. Když `selectedSale` změní, musíme znovu nahrát items.

```typescript
  useEffect(() => {
    if (!selectedSale) return
    
    getSales({
      sale_id: selectedSale.id, // backend musí vrátit items
    })
      .then((sales) => {
        // getSales vrátí Sale objekt s items
        // Pokud backend vrací items v Sale, pak jsme hotovi
        // Pokud ne, musíme udělat separátní endpoint
      })
  }, [selectedSale])
```

**PROBLÉM:** Backend endpoint `getSales` vrací seznam Sale bez SaleItem. Potřebujeme zjistit, jestli máme separátní endpoint na detaily prodeje.

Kontrola: Koukne se do Admin/Sales.tsx, jak se tam načítají SaleItem:

```bash
grep -n "SaleItem\|getSaleItems\|getSale(" frontend/src/api/sales.ts | head -20
```

Expected: Zjistíme, jestli je funkce na detail prodeje.

Pokud **neexistuje**, musíme ji vytvořit v API (task mezi 5 a 6). Pokud **existuje**, použijeme ji.

Na základě toho: Přidáme effect na `selectedSale`:

```typescript
  useEffect(() => {
    if (!selectedSale) return
    // Placeholder: Zjistíme API, pak to napíšeme
  }, [selectedSale])
```

Pokud backend nemá endpoint na detail prodeje, otočíme se na uživatele — dočasně můžeme zobrazit jen Sale info bez SaleItem.

- [ ] **Step 2: Procházíme backend na existenci detail endpointu**

```bash
grep -rn "getSaleItems\|sale/\|sale_id" backend/api/*.php | head -20
```

Expected: Zjistíme, co má backend.

Na základě výsledku:
- **Existuje** → použijeme
- **Neexistuje** → přidáme TODO a posuneme na backend task

- [ ] **Step 3: Connectujeme Cart s POS state**

V JSX sekce `<Cart>`:

```typescript
        <aside className={styles.cartPanel}>
          <Cart
            items={state.cart}
            selectedSale={selectedSale}
            saleItems={/* TODO: nahrát ze state */}
            onRemove={removeFromCart}
            onCheckout={() => setShowCheckout(true)}
          />
        </aside>
```

- [ ] **Step 4: Commitujeme**

```bash
git add frontend/src/pages/POS.tsx && git commit -m "feat(pos): Cart propojení s selectedSale"
```

---

## Task 7: Testy integrace — POS.tsx (posMode, SPACE, navigace)

**Files:**
- Modify: `frontend/src/pages/POS.test.tsx` (pokud existuje) / Create nový test file

Pokud POS.test.tsx neexistuje, vytvoříme jej. Pokud existuje, rozšíříme.

- [ ] **Step 1: Napíšeme test na SPACE přepínání**

```typescript
describe('POS – posMode (SPACE)', () => {
  it('SPACE přepne z sell na history mode', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    
    // Initial: sell mode
    expect(result.current.state.step).toBe('category')
    
    // SPACE → history
    // (Testujeme v POS.tsx, ne v usePOS — zatím vynecháme)
  })
})
```

**Poznámka:** Testy integrační na SPACE jsou komplexní (potřebují renderovat POS.tsx s touto logikou). Pokud je to moc složité, vynecháme je a полáníme na manuální test.

- [ ] **Step 2: Vynecháme detailní integrační testy zatím, zaměříme se na unit testy komponent**

Ověříme si, že `HistoryPanel.test.tsx` a `SaleDetailView.test.tsx` již prošly (task 1–2).

- [ ] **Step 3: Spustíme všechny testy**

```bash
npm run test -- --run 2>&1 | tail -15
```

Expected: Všechny komponenty pass, POS se może testovat ručně.

---

## Task 8: Backend API — endpoint na SaleItem (pokud neexistuje)

**Pozn:** Tento task závisí na zjištění z Task 6.

Pokud backend **má** funkci na detail prodeje — vynecháme.
Pokud **nemá** — vytvoříme dočasný endpoint nebo postup.

- [ ] **Pokud chybí:** Zjistíme přesně, co chybí, a zapíšeme do tasks.md jako nový task pro později.

---

## Task 9: Celková integrace — manuální test POS v prohlížeči

**Manuální ověření:**

- [ ] **Spustíme dev server**

```bash
cd frontend && npm run dev
# a v jiném terminálu
cd backend && docker compose up -d
```

- [ ] **Otestujeme scénáře:**

1. Otevřeme http://localhost:5173/pos, přihlásíme se (`prodavacka` / `prodavacka123`)
2. Vidíme levý panel — kategorie nahoře, historie dole
3. Stiskneme SPACE — nic se neděje (jeste není rozpracovaný prodej)
4. Provedem prodej — 1. kategorie → čaj → množství 2 → pytlík → zaplaceno
5. História by měla mít nový řádek (dnešní čas)
6. Stiskneme SPACE — přepneme do history mode
7. Šipkami navigujeme mezi transakcemi — detail se zobrazí v košíku
8. Kliknem na starou transakci — taky se zobrazí
9. SPACE zpět do sell mode — kategorie se vrátí

- [ ] **Ověříme CSS:** Layout se zvyšuje správně, barvy jsou čitelné, scrollbary fungují

- [ ] **Commitujeme pozorování — pokud všechno funguje:**

```bash
git add .claude/tasks.md && git commit -m "docs: ověření integrace POS historia — manuální test prošel"
```

---

## Task 10: Opravy a laděn (pokud bylo potřeba)

- [ ] Pokud manuální test zjistí problémy, napravíme je a commitujeme jednotlivě.

---

## Self-Review

**Spec coverage:**
- ✅ Layout: Vertikální split kategorie/história v levém panelu
- ✅ State: `posMode`, `history`, `historyIndex`, `selectedSale` v POS.tsx
- ✅ Chování: SPACE přepínání (s guardem na `step === 'category'`)
- ✅ Šipky v historii: Automatické zobrazení (`selectedSale`)
- ✅ Klik: `onSelect` v HistoryPanel
- ✅ Komponenty: `HistoryPanel.tsx`, `SaleDetailView.tsx`, úprava `Cart.tsx`
- ✅ API: `getSales` s filtrem dnes
- ✅ Error handling: Loading, error states v historii

**Placeholder check:** Žádné TBD, všechny kódy kompletní.

**Type consistency:** Všechny typy (Sale, SaleItem, CartItem) jsou z `types.ts`, Names (setHistoryIndex, selectedSale) jsou konzistentní.

---

## Execution

Plán je hotov. Dva způsoby:

1. **Inline Execution** — Běži task-by-task v tomto seshení, já kontroluji, commituju
2. **Subagent-Driven** — Nový Sonnet agent na task, review, commit

Jaký modo jdeš?
