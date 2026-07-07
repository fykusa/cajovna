# POS Čajovna — search box na obrazovce kategorií — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat na obrazovku výběru kategorie (`CajeCategories`) v Čajovna POS search box — psaní jména čaje filtruje napříč všemi aktivními čaji a klik na výsledek jde rovnou na balení (přeskočí kategorii i zemi).

**Architecture:** Vyhledávací stav (`searchQuery`, odvozený `searchResults`) žije v `useCajovnaPOS` hooku vedle zbytku navigačního stavu. `CajeCategories` je čistě prezentační — dostane `searchQuery`/`searchResults` jako props a při neprázdném query nahradí mřížku kategorií recyklovanou komponentou `CajeTeas` (rozšířenou o volitelnou `emptyMessage`). Žádná změna backendu/API.

**Tech Stack:** React 19 + TypeScript, Vitest + @testing-library/react (existující vzor v projektu).

## Global Constraints

- Vyhledává se pouze v poli `NAZEV`, case-insensitive a **bez diakritiky** (normalizace přes `NFD` + odstranění kombinujících diakritických znamének).
- Filtrují se jen čaje s `AKTIV === 'x'`.
- Search box je natrvalo viditelný nahoře na obrazovce kategorií (ne skrytý za ikonou).
- Klik na výsledek vyhledávání = `selectTea(tea)` → rovnou `packaging` view, žádná nová cesta.
- `searchQuery` se vyprázdní po `selectTea` a po `newSale`.
- Beze změny: backend, DB, `selectCategory`/`selectZeme`/checkout flow, desktop/mobilní POS mimo Čajovnu.
- Spec: `docs/superpowers/specs/2026-07-07-pos-search-caju-design.md`

---

### Task 1: `normalizeSearch` + vyhledávací stav v `useCajovnaPOS`

**Files:**
- Modify: `frontend/src/hooks/useCajovnaPOS.ts`
- Test: `frontend/src/hooks/useCajovnaPOS.test.ts`

**Interfaces:**
- Produces: `normalizeSearch(s: string): string` (exportovaná čistá funkce). Hook vrací navíc `searchQuery: string`, `setSearchQuery: (q: string) => void`, `searchResults: TeaRow[]`.
- Consumes: existující `TeaRow` typ z `../types`, existující `allRows` stav v hooku.

- [ ] **Step 1: Napsat padající testy pro `normalizeSearch`**

Do `frontend/src/hooks/useCajovnaPOS.test.ts` uprav import na řádku 3:

```ts
import { useCajovnaPOS, buildBaleni, deriveCategories, deriveZeme, normalizeSearch } from './useCajovnaPOS'
```

Za blok `describe('deriveZeme', ...)` (za řádkem 84, před `// --- useCajovnaPOS ---`) přidej:

```ts
// --- normalizeSearch ---
describe('normalizeSearch', () => {
  test('odstraní diakritiku a převede na malá písmena', () => {
    expect(normalizeSearch('Černý')).toBe('cerny')
    expect(normalizeSearch('ŠÍPKOVÝ ČAJ')).toBe('sipkovy caj')
  })
  test('prázdný řetězec zůstane prázdný', () => {
    expect(normalizeSearch('')).toBe('')
  })
})
```

- [ ] **Step 2: Spustit testy a ověřit pád na neexistujícím exportu**

Run: `cd frontend && npx vitest run src/hooks/useCajovnaPOS.test.ts`
Expected: FAIL — `normalizeSearch` není exportováno z `./useCajovnaPOS` (TS/import chyba nebo `undefined is not a function`).

- [ ] **Step 3: Implementovat `normalizeSearch`**

V `frontend/src/hooks/useCajovnaPOS.ts` přidej import `useMemo` na řádek 1 (uprav stávající import):

```ts
import { useState, useEffect, useMemo } from 'react'
```

Za `deriveZeme` (za řádek 41, před `export function useCajovnaPOS()`) přidej:

```ts
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
```

- [ ] **Step 4: Spustit testy znovu — `normalizeSearch` by měl projít**

Run: `cd frontend && npx vitest run src/hooks/useCajovnaPOS.test.ts`
Expected: `normalizeSearch` testy PASS (ostatní testy zatím beze změny procházejí).

- [ ] **Step 5: Napsat padající testy pro vyhledávací stav hooku**

Do `describe('useCajovnaPOS', ...)` bloku přidej (za poslední test `newSale resetuje košík...`, před uzavírací `})` bloku):

```ts
  test('setSearchQuery naplní searchResults podle názvu, bez diakritiky, jen aktivní čaje', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('bily'))
    expect(result.current.searchResults.map((t) => t.NAZEV)).toEqual(['Bílý Taiwan'])
  })

  test('prázdný searchQuery → prázdné searchResults', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.searchResults).toHaveLength(0)
  })

  test('searchResults vynechá neaktivní čaje', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('neaktivni'))
    expect(result.current.searchResults).toHaveLength(0)
  })

  test('selectTea z vyhledávání vyprázdní searchQuery', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('bily'))
    act(() => result.current.selectTea(row4))
    expect(result.current.view).toBe('packaging')
    expect(result.current.searchQuery).toBe('')
  })

  test('newSale vyprázdní searchQuery', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('bily'))
    act(() => result.current.newSale())
    expect(result.current.searchQuery).toBe('')
  })
```

- [ ] **Step 6: Spustit testy a ověřit pád**

Run: `cd frontend && npx vitest run src/hooks/useCajovnaPOS.test.ts`
Expected: FAIL — `setSearchQuery`/`searchResults` nejsou v návratovém objektu hooku (`undefined is not a function` / `Cannot read properties of undefined`).

- [ ] **Step 7: Implementovat vyhledávací stav v hooku**

V `frontend/src/hooks/useCajovnaPOS.ts`, uvnitř `export function useCajovnaPOS()`, za řádek s `const [checkoutError, setCheckoutError]   = useState<string | null>(null)` přidej nový stav:

```ts
  const [searchQuery, setSearchQuery]       = useState('')
```

Za `useEffect` blok (za řádek 71, před `function filterTeas(...)`) přidej odvozenou hodnotu:

```ts
  const searchResults = useMemo(() => {
    if (searchQuery.trim().length === 0) return []
    const q = normalizeSearch(searchQuery)
    return allRows.filter((r) => r.AKTIV === 'x' && r.NAZEV != null && normalizeSearch(r.NAZEV).includes(q))
  }, [allRows, searchQuery])
```

Uprav `selectTea`, ať vyprázdní `searchQuery`:

```ts
  function selectTea(tea: TeaRow) {
    setSelectedTea(tea)
    const opts = buildBaleni(tea)
    setBaleniOptions(opts)
    setSelectedBaleni(opts[0] ?? null)
    setSearchQuery('')
    setView('packaging')
  }
```

Uprav `newSale`, ať vyprázdní `searchQuery`:

```ts
  function newSale() {
    setCart([])
    setSelectedCategory(null)
    setSelectedZeme(null)
    setZemeOptions([])
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setSearchQuery('')
    setView('home')
  }
```

V `return { ... }` na konci hooku přidej `searchQuery, searchResults, setSearchQuery,` do vraceného objektu (za `zemeOptions,` na řádku se seznamem hodnot):

```ts
  return {
    view, categories, teas, baleniOptions, zemeOptions,
    selectedCategory, selectedZeme, selectedTea, selectedBaleni,
    cart, lastTotal, loading, error, checkoutError,
    searchQuery, searchResults, setSearchQuery,
    selectCategory, selectZeme, selectTea, selectBaleni, selectKusu,
    removeFromCart, goBack, goToCategories,
    startCheckout, confirmCheckout, newSale,
  }
```

- [ ] **Step 8: Spustit testy znovu — vše by mělo projít**

Run: `cd frontend && npx vitest run src/hooks/useCajovnaPOS.test.ts`
Expected: PASS (všechny testy v souboru, včetně nových).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/useCajovnaPOS.ts frontend/src/hooks/useCajovnaPOS.test.ts
git commit -m "feat(pos): search caju podle nazvu bez diakritiky v useCajovnaPOS"
```

---

### Task 2: `CajeTeas` — volitelná `emptyMessage`

**Files:**
- Modify: `frontend/src/components/pos-cajovna/CajeTeas.tsx`

**Interfaces:**
- Produces: nový volitelný prop `emptyMessage?: string` na `CajeTeas`. Beze změny existující chování, když prop chybí.
- Consumes: žádné nové závislosti.

Poznámka: `CajeTeas` nemá vlastní testovací soubor (stávající vzor v projektu — viz spec). Pokrytí nové `emptyMessage` větve zajišťuje `CajeCategories.test.tsx` v Task 3, který `CajeTeas` používá s vlastní hláškou "Nic nenalezeno".

- [ ] **Step 1: Přidat prop a použít ho v podmínce prázdného seznamu**

V `frontend/src/components/pos-cajovna/CajeTeas.tsx` uprav interface a komponentu:

```tsx
import type { TeaRow } from '../../types'
import styles from './CajeTeas.module.css'

interface Props {
  teas: TeaRow[]
  categoryName: string
  onSelect: (tea: TeaRow) => void
  emptyMessage?: string
}

export default function CajeTeas({ teas, categoryName, onSelect, emptyMessage }: Props) {
  return (
    <div className={styles.scroll}>
      {teas.length === 0 && (
        <p className={styles.empty}>{emptyMessage ?? `Žádné čaje v kategorii ${categoryName}.`}</p>
      )}
      <ul className={styles.list}>
        {teas.map((tea) => (
          <li key={tea.id}>
            <button className={styles.row} onClick={() => onSelect(tea)}>
              <div className={styles.info}>
                <span className={styles.name}>{tea.NAZEV}</span>
                {tea.POZNAMKA && <span className={styles.note}>{tea.POZNAMKA}</span>}
              </div>
              {tea.CENA1 != null && (
                <span className={styles.price}>{tea.CENA1} Kč</span>
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

- [ ] **Step 2: Ověřit, že existující volání `CajeTeas` (bez `emptyMessage`) stále typují a testují správně**

Run: `cd frontend && npx tsc -b`
Expected: bez chyb (prop je volitelný, `CajovnaPOS.tsx` volá `<CajeTeas teas=... categoryName=... onSelect=... />` beze změny).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pos-cajovna/CajeTeas.tsx
git commit -m "feat(pos): CajeTeas prijima volitelnou emptyMessage"
```

---

### Task 3: Search box v `CajeCategories`

**Files:**
- Modify: `frontend/src/components/pos-cajovna/CajeCategories.tsx`
- Modify: `frontend/src/components/pos-cajovna/CajeCategories.module.css`
- Create: `frontend/src/components/pos-cajovna/CajeCategories.test.tsx`

**Interfaces:**
- Consumes: `CajeTeas` z Task 2 (props `teas`, `categoryName`, `onSelect`, `emptyMessage`), typ `TeaRow` z `../../types`.
- Produces: `CajeCategories` nově vyžaduje props `searchQuery: string`, `onSearchChange: (q: string) => void`, `searchResults: TeaRow[]`, `onSelectTea: (tea: TeaRow) => void` navíc k existujícím `categories: string[]`, `onSelect: (kategorie: string) => void`.

- [ ] **Step 1: Napsat padající testy pro `CajeCategories`**

Vytvoř `frontend/src/components/pos-cajovna/CajeCategories.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CajeCategories from './CajeCategories'
import type { TeaRow } from '../../types'

const tea: TeaRow = {
  id: 4, KOD: '2606-C-BILY-TAWN-03', KATEGORIE: 'BÍLÝ', ZEME: 'Taiwan', AKTIV: 'x', NAZEV: 'Bílý Taiwan',
  POZNAMKA: null, MN1: 30, CENA1: 180, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

describe('CajeCategories', () => {
  it('zobrazí mřížku kategorií, když je searchQuery prázdný', () => {
    render(
      <CajeCategories
        categories={['BÍLÝ', 'PUERH']}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        searchResults={[]}
        onSelectTea={vi.fn()}
      />,
    )
    expect(screen.getByText('BÍLÝ')).toBeInTheDocument()
    expect(screen.getByText('PUERH')).toBeInTheDocument()
  })

  it('psaní do inputu volá onSearchChange', () => {
    const onSearchChange = vi.fn()
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={onSearchChange}
        searchResults={[]}
        onSelectTea={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Hledat čaj podle názvu…'), { target: { value: 'bily' } })
    expect(onSearchChange).toHaveBeenCalledWith('bily')
  })

  it('neprázdný searchQuery skryje mřížku a zobrazí výsledky', () => {
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery="bily"
        onSearchChange={vi.fn()}
        searchResults={[tea]}
        onSelectTea={vi.fn()}
      />,
    )
    expect(screen.queryByText('BÍLÝ')).not.toBeInTheDocument()
    expect(screen.getByText('Bílý Taiwan')).toBeInTheDocument()
  })

  it('prázdné výsledky zobrazí hlášku "Nic nenalezeno"', () => {
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery="xyz"
        onSearchChange={vi.fn()}
        searchResults={[]}
        onSelectTea={vi.fn()}
      />,
    )
    expect(screen.getByText('Nic nenalezeno')).toBeInTheDocument()
  })

  it('klik na výsledek zavolá onSelectTea', () => {
    const onSelectTea = vi.fn()
    render(
      <CajeCategories
        categories={['BÍLÝ']}
        onSelect={vi.fn()}
        searchQuery="bily"
        onSearchChange={vi.fn()}
        searchResults={[tea]}
        onSelectTea={onSelectTea}
      />,
    )
    fireEvent.click(screen.getByText('Bílý Taiwan'))
    expect(onSelectTea).toHaveBeenCalledWith(tea)
  })
})
```

- [ ] **Step 2: Spustit testy a ověřit pád**

Run: `cd frontend && npx vitest run src/components/pos-cajovna/CajeCategories.test.tsx`
Expected: FAIL — TypeScript chyba na chybějící props (`searchQuery`, `onSearchChange`, `searchResults`, `onSelectTea` nejsou v `Props` rozhraní `CajeCategories`), případně runtime chyba `Hledat čaj podle názvu…` placeholder nenalezen.

- [ ] **Step 3: Implementovat search box v `CajeCategories`**

Nahraď celý obsah `frontend/src/components/pos-cajovna/CajeCategories.tsx`:

```tsx
import type { TeaRow } from '../../types'
import CajeTeas from './CajeTeas'
import styles from './CajeCategories.module.css'

interface Props {
  categories: string[]
  onSelect: (kategorie: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  searchResults: TeaRow[]
  onSelectTea: (tea: TeaRow) => void
}

export default function CajeCategories({
  categories, onSelect, searchQuery, onSearchChange, searchResults, onSelectTea,
}: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.searchBar}>
        <input
          className={styles.search}
          type="text"
          placeholder="Hledat čaj podle názvu…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {searchQuery.length === 0 ? (
        <div className={styles.scroll}>
          <div className={styles.grid}>
            {categories.map((kategorie) => (
              <button
                key={kategorie}
                className={styles.card}
                onClick={() => onSelect(kategorie)}
              >
                <span className={styles.name}>{kategorie}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CajeTeas teas={searchResults} categoryName="" onSelect={onSelectTea} emptyMessage="Nic nenalezeno" />
      )}
    </div>
  )
}
```

Do `frontend/src/components/pos-cajovna/CajeCategories.module.css` přidej na začátek souboru (před stávající `.scroll` pravidlo):

```css
.root { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.searchBar { padding: 12px 16px 0; }
.search {
  width: 100%; box-sizing: border-box; padding: 10px 14px;
  border-radius: var(--mob-r-sm); border: 1px solid var(--mob-border);
  background: var(--mob-surface); color: var(--mob-fg); font-size: 14px;
}
.search:focus { outline: none; border-color: var(--mob-accent); }
```

- [ ] **Step 4: Spustit testy znovu — vše by mělo projít**

Run: `cd frontend && npx vitest run src/components/pos-cajovna/CajeCategories.test.tsx`
Expected: PASS (všech 5 testů).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pos-cajovna/CajeCategories.tsx frontend/src/components/pos-cajovna/CajeCategories.module.css frontend/src/components/pos-cajovna/CajeCategories.test.tsx
git commit -m "feat(pos): search box v CajeCategories nahrazuje mrizku vysledky hledani"
```

---

### Task 4: Propojení v `CajovnaPOS.tsx` + celková verifikace

**Files:**
- Modify: `frontend/src/pages/CajovnaPOS.tsx`

**Interfaces:**
- Consumes: `pos.searchQuery`, `pos.setSearchQuery`, `pos.searchResults`, `pos.selectTea` z `useCajovnaPOS` (Task 1); `CajeCategories` props z Task 3.

Poznámka: `CajovnaPOS.tsx` nemá vlastní testovací soubor (žádný `CajovnaPOS.test.tsx` v projektu) — ověření této poslední, čistě propojovací změny proběhne přes typecheck + spuštění celé test sady + manuální průchod v běžícím devu.

- [ ] **Step 1: Propojit nové props do `<CajeCategories>`**

V `frontend/src/pages/CajovnaPOS.tsx` najdi blok (aktuálně řádky 99–101):

```tsx
            {pos.view === 'categories' && (
              <CajeCategories categories={pos.categories} onSelect={pos.selectCategory} />
            )}
```

Nahraď ho:

```tsx
            {pos.view === 'categories' && (
              <CajeCategories
                categories={pos.categories}
                onSelect={pos.selectCategory}
                searchQuery={pos.searchQuery}
                onSearchChange={pos.setSearchQuery}
                searchResults={pos.searchResults}
                onSelectTea={pos.selectTea}
              />
            )}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: bez chyb.

- [ ] **Step 3: Spustit celou frontend test sadu**

Run: `cd frontend && npm run test`
Expected: PASS, všechny testy včetně nových z Task 1 a Task 3 (žádná regrese ve zbytku sady).

- [ ] **Step 4: Manuální ověření v běžící aplikaci**

Run: `docker compose up -d` (pokud backend neběží) a `cd frontend && npm run dev`, otevřít `/pos` (Čajovna POS, přihlášení `prodavacka`/`prodavacka123`), na obrazovce kategorií:
1. Ověřit, že search box je vidět nahoře nad mřížkou kategorií.
2. Napsat část názvu čaje bez diakritiky (např. `bily` pro "Bílý Taiwan") → mřížka zmizí, zobrazí se odpovídající čaje.
3. Kliknout na výsledek → skok rovnou na obrazovku balení (přeskočí kategorii i zemi).
4. Vrátit se zpět (back), smazat text v search boxu → mřížka kategorií se vrátí.
5. Zadat text bez shody → zobrazí se "Nic nenalezeno".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CajovnaPOS.tsx
git commit -m "feat(pos): propojit search caju s CajovnaPOS strankou"
```

---

## Self-Review Checklist (pro implementátora, po dokončení všech tasků)

- Spec `docs/superpowers/specs/2026-07-07-pos-search-caju-design.md` — všechny body pokryty: matching bez diakritiky (Task 1), jen `NAZEV` (Task 1), jen aktivní čaje (Task 1), vyprázdnění po `selectTea`/`newSale` (Task 1), UI nahrazení mřížky (Task 3), `emptyMessage` (Task 2+3), propojení (Task 4).
- Žádné `TODO`/placeholdery v žádném z upravených souborů.
- `CajeTeas` volání ve `CajeCategories` (Task 3) a v `CajovnaPOS.tsx` (nezměněno, `teas` view) používají shodné jméno propů (`teas`, `categoryName`, `onSelect`, volitelně `emptyMessage`).
