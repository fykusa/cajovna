# Mobilní POS — TopBar + History tab

**Datum:** 2026-06-06  
**Stav:** SCHVÁLENO

---

## Kontext

Mobilní POS (`/pos`) aktuálně nemá žádnou navigaci. Prodavačka potřebuje:
1. Vědět, kdo je přihlášen, a mít možnost odhlásit se
2. Přepínat mezi prodejem a přehledem dnešních prodejů

---

## Architektura

### Nové soubory

```
frontend/src/components/pos-mobile/MobileTopBar.tsx
frontend/src/components/pos-mobile/MobileTopBar.module.css
frontend/src/components/pos-mobile/MobileHistory.tsx
frontend/src/components/pos-mobile/MobileHistory.module.css
```

### Upravené soubory

```
frontend/src/pages/MobilePOS.tsx   — přidat mode state, renderovat TopBar + podmíněně History
```

---

## Komponenta MobileTopBar

**Soubor:** `components/pos-mobile/MobileTopBar.tsx`

### Props

```typescript
interface Props {
  mode: 'pos' | 'history'
  onModeChange: (mode: 'pos' | 'history') => void
  username: string
  onLogout: () => void
}
```

### Layout

```
[ Prodej | Přehled ]              [ Jana  🚪 ]
 ←— vlevo                         vpravo —→
```

- Vlevo: dvě tlačítka `Prodej` a `Přehled` — aktivní tab má zvýrazněný styl (tmavý podklad / border-bottom accent)
- Vpravo: username + logout tlačítko (ikonka dveří nebo `↩`)
- Celá lišta: `background: var(--mob-surface)`, `border-bottom: 1px solid var(--mob-border)`
- Výška: kompaktní (~44px), `padding-top: env(safe-area-inset-top)` pro notch

### Integrace do MobilePOS.tsx

```typescript
// přidat state + auth
const [mode, setMode] = useState<'pos' | 'history'>('pos')
const user = useAuthStore((s) => s.user)
const logout = useAuthStore((s) => s.logout)
const navigate = useNavigate()   // přidat import useNavigate z react-router-dom

function handleLogout() {
  logout()
  navigate('/login', { replace: true })
}
```

TopBar se renderuje jako první child `.frame`. Přepnutí mode zachovává POS stav — hook `useMobilePOS` se nedotýká.

Kdy se zobrazuje co:
- `mode === 'pos'` → stávající layout (MobileHeader + views)  
- `mode === 'history'` → `<MobileHistory />` (celý scrollovatelný obsah)

### Úprava layoutu `.frame`

Aktuálně `.view` používá `position: absolute; inset: 0` (kryje celý `.frame`). S TopBarem musí `.frame` přejít na **flex column** a `.view` na `flex: 1; overflow: hidden` — slide animace zůstává beze změny (animuje se `transform` na elementu samotném).

```css
/* MobilePOS.module.css — úprava */
.frame {
  display: flex;
  flex-direction: column;
  /* zrušit: position: relative; overflow: hidden; — nebo ponechat */
}
.view {
  flex: 1;
  overflow: hidden;
  /* zrušit: position: absolute; inset: 0; */
  display: flex;
  flex-direction: column;
  background: var(--mob-bg);
}
```

---

## Komponenta MobileHistory

**Soubor:** `components/pos-mobile/MobileHistory.tsx`

### Data fetching

```typescript
// při každém mount (= každém přepnutí na tab) fetchne dnešní prodeje
const today = new Date().toISOString().slice(0, 10)
getSales({ from: today, to: today })
  .then(sales => {
    // seřadit od nejnovějšího
    const sorted = [...sales].sort((a, b) => b.id - a.id)
    // fetchnout items pro každý prodej paralelně
    Promise.all(sorted.map(s => getSaleItems(s.id)))
      .then(allItems => ...)
  })
```

### Layout

```
┌──────────────────────────────────┐
│  3 prodeje · celkem 1 240 Kč     │  ← sticky hlavička
├──────────────────────────────────┤
│  14:32  Jana              480 Kč │  ← prodej hlavička
│  Sencha · Std 100g · 2 ks · 240K │  ← položka (malý font)
│  Sencha · Std 100g · 2 ks · 240K │
│                                  │
│  13:10  Jana              760 Kč │
│  Darjeeling · Bal1 50g · 1 ks ·… │
│  ↳ Papír 500ml · 1 ks · 2 Kč    │  ← bag položka s ↳
│  ...                             │
└──────────────────────────────────┘
```

### Typy položek

- Čaj (`item_type !== 'bag'`): `{tea_name} · {qty} ks · {total_price} Kč`
- Pytlík (`item_type === 'bag'`): `↳ {surface_type} {volume_ml} ml · {qty} ks · {total_price} Kč`

### Stav komponent

| Stav | Zobrazení |
|---|---|
| Načítání | „Načítám…" text uprostřed |
| Žádné prodeje | „Dnes zatím žádné prodeje." |
| Data | Přehled |
| Chyba | Chybová hláška |

---

## Prodejní hlavička

Každý prodej (`Sale`): `created_at` formátovaný jako `HH:MM`, username prodavačky, `total_amount` v Kč.

Časy: `new Date(sale.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })`

Celková suma v sticky hlavičce: součet `sale.total_amount` přes všechny dnešní prodeje.

---

## Testování

- Unit test: žádné nové (komponenty jsou renderovací, data přes API mock)
- E2E: zatím neplánujeme, existující testy se nedotýkají

---

## Co se nemění

- `useMobilePOS` hook — beze změny
- Desktop POS (`/pos-desktop`) — beze změny
- Backend — beze změny
