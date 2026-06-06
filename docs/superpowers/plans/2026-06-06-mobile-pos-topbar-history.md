# Mobilní POS TopBar + History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat permanentní horní lištu s přepínačem Prodej/Přehled, jménem uživatele a logout tlačítkem do mobilního POS.

**Architecture:** Mode state v `MobilePOS.tsx` (page level). Nové komponenty `MobileTopBar` a `MobileHistory`. CSS layout `.frame` přechází z `position: relative` na `flex column` aby TopBar netlačil na `.view`. `MobileHistory` fetches dnešní prodeje samostatně při každém mount.

**Tech Stack:** React 19 + TypeScript, CSS Modules (OKLCH béžová paleta z `MobilePOS.module.css`), Vitest, existující API (`getSales`, `getSaleItems`), Zustand authStore.

---

## Soubory

### Nové
```
frontend/src/components/pos-mobile/MobileTopBar.tsx
frontend/src/components/pos-mobile/MobileTopBar.module.css
frontend/src/components/pos-mobile/MobileHistory.tsx
frontend/src/components/pos-mobile/MobileHistory.module.css
```

### Upravené
```
frontend/src/pages/MobilePOS.tsx          mode state, TopBar, History, useNavigate, useAuthStore
frontend/src/pages/MobilePOS.module.css   .frame → flex column, .view → flex: 1
```

---

## Task 1: MobileTopBar

**Files:**
- Create: `frontend/src/components/pos-mobile/MobileTopBar.tsx`
- Create: `frontend/src/components/pos-mobile/MobileTopBar.module.css`

- [ ] **Krok 1: Vytvořit MobileTopBar.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileTopBar.tsx
import styles from './MobileTopBar.module.css'

interface Props {
  mode: 'pos' | 'history'
  onModeChange: (mode: 'pos' | 'history') => void
  username: string
  onLogout: () => void
}

export default function MobileTopBar({ mode, onModeChange, username, onLogout }: Props) {
  return (
    <nav className={styles.bar}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === 'pos' ? styles.active : ''}`}
          onClick={() => onModeChange('pos')}
        >
          Prodej
        </button>
        <button
          className={`${styles.tab} ${mode === 'history' ? styles.active : ''}`}
          onClick={() => onModeChange('history')}
        >
          Přehled
        </button>
      </div>
      <div className={styles.user}>
        <span className={styles.username}>{username}</span>
        <button className={styles.logoutBtn} onClick={onLogout} aria-label="Odhlásit">
          ↩
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Krok 2: Vytvořit MobileTopBar.module.css**

```css
/* frontend/src/components/pos-mobile/MobileTopBar.module.css */
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 8px) 12px 8px;
  background: var(--mob-surface);
  border-bottom: 1px solid var(--mob-border);
  flex-shrink: 0;
}
.tabs { display: flex; gap: 4px; }
.tab {
  padding: 6px 14px;
  border-radius: var(--mob-r-sm);
  border: 1px solid transparent;
  background: none;
  color: var(--mob-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.active {
  background: var(--mob-accent-bg);
  border-color: var(--mob-accent);
  color: var(--mob-accent);
}
.tab:active { opacity: 0.7; }
.user { display: flex; align-items: center; gap: 8px; }
.username { font-size: 13px; color: var(--mob-fg-2); }
.logoutBtn {
  background: none; border: none; cursor: pointer;
  font-size: 18px; color: var(--mob-muted); padding: 4px;
  line-height: 1;
}
.logoutBtn:active { opacity: 0.6; }
```

- [ ] **Krok 3: Spustit testy**

```
cd frontend && npm run test
```

Očekávaný výsledek: všechny testy pass (žádný nový test — komponenta je čistě renderovací).

- [ ] **Krok 4: Commit**

```
git add frontend/src/components/pos-mobile/MobileTopBar.tsx frontend/src/components/pos-mobile/MobileTopBar.module.css
git commit -m "feat(mobile-pos): MobileTopBar — přepínač Prodej/Přehled + username + logout"
```

---

## Task 2: MobileHistory

**Files:**
- Create: `frontend/src/components/pos-mobile/MobileHistory.tsx`
- Create: `frontend/src/components/pos-mobile/MobileHistory.module.css`

Používá existující API: `getSales` a `getSaleItems` z `frontend/src/api/sales.ts`.
Typy: `Sale.total_amount: number`, `SaleItem.total_price: number` — backend může vracet jako string, proto vždy `Number(...)`.

- [ ] **Krok 1: Vytvořit MobileHistory.tsx**

```typescript
// frontend/src/components/pos-mobile/MobileHistory.tsx
import { useState, useEffect } from 'react'
import { getSales, getSaleItems } from '../../api/sales'
import type { Sale, SaleItem } from '../../types'
import styles from './MobileHistory.module.css'

interface SaleWithItems extends Sale {
  items: SaleItem[]
}

export default function MobileHistory() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    setLoading(true)
    setError(null)
    getSales({ from: today, to: today })
      .then((raw) => {
        const sorted = [...raw].sort((a, b) => b.id - a.id)
        return Promise.all(
          sorted.map((s) => getSaleItems(s.id).then((items) => ({ ...s, items })))
        )
      })
      .then(setSales)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  const totalAmount = sales.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const count = sales.length
  const countLabel = count === 1 ? 'prodej' : count < 5 ? 'prodeje' : 'prodejů'

  if (loading) return <div className={styles.state}>Načítám…</div>
  if (error) return <div className={styles.state}>Chyba: {error}</div>
  if (sales.length === 0) return <div className={styles.state}>Dnes zatím žádné prodeje.</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        {count} {countLabel} · celkem {totalAmount.toLocaleString('cs-CZ')} Kč
      </div>
      <div className={styles.list}>
        {sales.map((sale) => (
          <div key={sale.id} className={styles.sale}>
            <div className={styles.saleHead}>
              <span className={styles.saleTime}>
                {new Date(sale.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={styles.saleUser}>{sale.username}</span>
              <span className={styles.saleTotal}>
                {Number(sale.total_amount).toLocaleString('cs-CZ')} Kč
              </span>
            </div>
            <div className={styles.items}>
              {sale.items.map((item) => (
                <div key={item.id} className={styles.item}>
                  {item.item_type === 'bag'
                    ? `↳ ${item.surface_type} ${item.volume_ml} ml · ${item.quantity} ks · ${Number(item.total_price).toLocaleString('cs-CZ')} Kč`
                    : `${item.tea_name} · ${item.quantity} ks · ${Number(item.total_price).toLocaleString('cs-CZ')} Kč`
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Krok 2: Vytvořit MobileHistory.module.css**

```css
/* frontend/src/components/pos-mobile/MobileHistory.module.css */
.wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.summary {
  padding: 10px 16px;
  background: var(--mob-surface);
  border-bottom: 1px solid var(--mob-border);
  font-size: 13px;
  font-weight: 600;
  color: var(--mob-fg-2);
  flex-shrink: 0;
}
.list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sale {
  background: var(--mob-surface);
  border-radius: var(--mob-r);
  padding: 10px 12px;
}
.saleHead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.saleTime { font-size: 13px; font-weight: 600; color: var(--mob-fg); }
.saleUser { flex: 1; font-size: 12px; color: var(--mob-muted); }
.saleTotal {
  font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
  font-size: 13px;
  font-weight: 600;
}
.items { display: flex; flex-direction: column; gap: 1px; }
.item { font-size: 11px; color: var(--mob-muted); line-height: 1.4; }
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--mob-muted);
  font-size: 14px;
}
```

- [ ] **Krok 3: Spustit testy**

```
cd frontend && npm run test
```

Očekávaný výsledek: všechny testy pass.

- [ ] **Krok 4: Commit**

```
git add frontend/src/components/pos-mobile/MobileHistory.tsx frontend/src/components/pos-mobile/MobileHistory.module.css
git commit -m "feat(mobile-pos): MobileHistory — dnešní prodeje, přehled s položkami"
```

---

## Task 3: CSS layout + wire-up MobilePOS.tsx

**Files:**
- Modify: `frontend/src/pages/MobilePOS.module.css`
- Modify: `frontend/src/pages/MobilePOS.tsx`

### Proč CSS změna

Aktuálně `.view` má `position: absolute; inset: 0` — zakrývá celý `.frame`.
Po přidání TopBar jako sourozence `.view` by TopBar byl překryt. Řešení:
`.frame` → flex column, `.view` → `flex: 1; overflow: hidden` (slide animace funguje dál — animuje `transform` na prvku).

- [ ] **Krok 1: Upravit MobilePOS.module.css**

Nahraď blok `.frame` a `.view`:

```css
.frame {
  width: 100%;
  max-width: 430px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 100dvh;
  background: var(--mob-bg);
}

.view {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--mob-bg);
}
```

(Smazat `position: relative;` z `.frame` a `position: absolute; inset: 0;` z `.view`.)

- [ ] **Krok 2: Upravit MobilePOS.tsx — přidat importy a state**

Přidej na začátek souboru (za existující importy):

```typescript
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import MobileTopBar from '../components/pos-mobile/MobileTopBar'
import MobileHistory from '../components/pos-mobile/MobileHistory'
```

Přidej do těla komponenty (za `const pos = useMobilePOS()`):

```typescript
const [mode, setMode] = useState<'pos' | 'history'>('pos')
const user = useAuthStore((s) => s.user)
const logout = useAuthStore((s) => s.logout)
const navigate = useNavigate()

function handleLogout() {
  logout()
  navigate('/login', { replace: true })
}
```

- [ ] **Krok 3: Upravit return v MobilePOS.tsx — přidat TopBar a History**

Nahraď celý `return` blok:

```tsx
return (
  <div className={styles.root}>
    <div className={styles.frame}>
      <MobileTopBar
        mode={mode}
        onModeChange={setMode}
        username={user?.username ?? ''}
        onLogout={handleLogout}
      />
      {mode === 'pos' && (
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
      )}
      {mode === 'history' && <MobileHistory />}
    </div>
  </div>
)
```

- [ ] **Krok 4: Spustit testy**

```
cd frontend && npm run test
```

Očekávaný výsledek: 165 pass (žádné nové testy — logika beze změny, jen layout + nové renderovací komponenty).

- [ ] **Krok 5: Commit**

```
git add frontend/src/pages/MobilePOS.tsx frontend/src/pages/MobilePOS.module.css
git commit -m "feat(mobile-pos): TopBar + History tab — přepínač prodej/přehled, logout"
```
