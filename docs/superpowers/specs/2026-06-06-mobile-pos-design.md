# Mobilní POS — Design Spec

**Datum:** 2026-06-06  
**Stav:** SCHVÁLENO

---

## Kontext

Prodavačky na prodejně používají mobilní telefon, nikoli klávesnici. Stávající POS (`/pos`) je klávesnicový — šipky, Enter, F10. Potřebujeme touch-first alternativu.

Zdrojem designu je Open Design prototyp v `D:\_FYKA\AI\POS\` (projekt "POS" v OD), který definuje 8 views, béžovou paletu, slide animace a česky psaný UI text.

---

## Rozhodnutí

### Routing
- `/pos` → **MobilePOS** (nová stránka, default pro prodavačky)
- `/pos-desktop` → **POS** (stávající klávesnicový, beze změny)
- Login redirect prodavačky po přihlášení: `/pos` (upravit `Login.tsx`)
- `ProtectedRoute` zachován, role `prodavacka` i `admin`

### Implementace — Přístup A
- Nový `useMobilePOS` hook + nové komponenty v `components/pos-mobile/`
- Stávající `usePOS` + klávesnicové komponenty zůstávají **beze změny**
- Sdílená pouze API vrstva (`getCategories`, `getProducts`, `getBags`, `postSale`)
- **Žádná změna backendu**

---

## Hook `useMobilePOS`

**Soubor:** `frontend/src/hooks/useMobilePOS.ts`

### Views (stavy)

```typescript
type MobileView = 'home' | 'categories' | 'teas' | 'packaging' | 'quantity' | 'bags' | 'checkout' | 'success'

const VIEW_ORDER: MobileView[] = ['home', 'categories', 'teas', 'packaging', 'quantity', 'bags', 'checkout', 'success']
```

| View | Funkce |
|---|---|
| `home` | Košík — přehled položek + celková cena |
| `categories` | 2-sloupcový grid kategorií |
| `teas` | Seznam čajů vybrané kategorie |
| `packaging` | Výběr balení (papírový sáček, plechovka, pytlíky…) |
| `quantity` | 3-sloupcový grid množství |
| `bags` | Výběr typu pytlíku (jen pokud balení = pytlíky) |
| `checkout` | Přehled prodeje před zaplacením |
| `success` | Potvrzení — prodej zaúčtován |

### State

```typescript
interface MobilePOSState {
  view: MobileView
  categories: Category[]
  teas: Tea[]
  bags: Bag[]
  selectedCategory: Category | null
  selectedTea: Tea | null
  selectedPackaging: PackagingOption | null
  quantity: number
  selectedBag: Bag | null
  cart: CartItem[]
  lastTotal: number
  loading: boolean
  error: string | null
}
```

`PackagingOption` a funkce `getPackagingOptions(tea)` se **sdílí** ze stávajícího `usePOS.ts` — extrahují se do `frontend/src/hooks/posHelpers.ts` (nový sdílený soubor), aby se neduplikovala logika. Typ: `id`, `label`, `sub`, `type: 'loose'|'bags'`, `premium: number`.

### Akce (metody hooku)

| Metoda | Efekt |
|---|---|
| `selectCategory(cat)` | nastaví `selectedCategory`, načte čaje dané kategorie, → `teas` |
| `selectTea(tea)` | nastaví `selectedTea`, → `packaging` |
| `selectPackaging(pkg)` | nastaví `selectedPackaging`, → `quantity` |
| `selectQuantity(n)` | nastaví `quantity`; pokud `packaging.type === 'bags'` → `bags`, jinak `addItem()` + → `home` |
| `selectBag(bag)` | nastaví `selectedBag`, `addItem()`, → `home` |
| `removeFromCart(id)` | smaže položku z košíku dle `localId` |
| `goBack()` | vrátí o view zpět dle `VIEW_ORDER`; z `home` nedělá nic |
| `startCheckout()` | → `checkout` |
| `confirmCheckout()` | volá `postSale()`, nastaví `lastTotal`, → `success` |
| `newSale()` | reset výběrů + košíku, → `home` |

### Výpočet ceny

```typescript
function calcPrice(tea: Tea, packaging: PackagingOption, quantity: number): number {
  if (packaging.type === 'bags') {
    return Math.ceil((tea.price / 100) * 2.2 * quantity) + packaging.premium
  }
  return Math.ceil((quantity / 100) * tea.price) + packaging.premium
}
```

---

## Komponenty

**Adresář:** `frontend/src/components/pos-mobile/`

### Sdílené sub-komponenty

| Komponenta | Popis |
|---|---|
| `MobileHeader.tsx` | Tlačítko zpět (`‹`), název kroku, badge s počtem položek v košíku |
| `MobileActionBar.tsx` | Fixní spodní lišta s CTA tlačítkem (primary/secondary) |
| `MobileProgressBar.tsx` | Tenké pruhy dle VIEW_ORDER (done / active / empty) |

### View komponenty

| Komponenta | View | Obsah |
|---|---|---|
| `MobileHome.tsx` | `home` | Header s datem, seznam CartItem, prázdný stav (znak 茶), total, „+ Přidat položku" + „Zaúčtovat prodej →" |
| `MobileCategories.tsx` | `categories` | 2-sloupcový CSS Grid karet kategorií |
| `MobileTeas.tsx` | `teas` | Scrollovatelný seznam (jméno + sub + cena/100g + šipka ›) |
| `MobilePackaging.tsx` | `packaging` | Seznam typů balení s příplatkem / pill „std" |
| `MobileQuantity.tsx` | `quantity` | 3-sloupcový grid tlačítek (číslo / jednotka / cena) |
| `MobileBags.tsx` | `bags` | 2-sloupcový grid typů pytlíků |
| `MobileCheckout.tsx` | `checkout` | Přehled položek, celková cena, „✓ Zákazník zaplatil" + „Zpět na košík" |
| `MobileSuccess.tsx` | `success` | Zelený kruh ✓, zaplacená částka, datum, „Nový prodej" |

### Orchestrátor

**Soubor:** `frontend/src/pages/MobilePOS.tsx`

- Drží hook `useMobilePOS`
- Renderuje `MobileHeader` + `MobileProgressBar` + příslušný view component + `MobileActionBar`
- Řídí slide animaci: přidá CSS třídu `slide-fwd` / `slide-back` na view kontejner při změně `view`

---

## CSS / Styling

**Soubory:** `MobilePOS.module.css` + per-komponenta CSS Modules

Nesdílí styly se stávajícím klávesnicovým POS (tmavá paleta). Béžová paleta přesně z OD prototypu:

```css
--mob-bg:           oklch(93% 0.025 68);
--mob-surface:      oklch(97% 0.018 70);
--mob-surface-alt:  oklch(89% 0.032 66);
--mob-fg:           oklch(20% 0.06 32);
--mob-fg-2:         oklch(36% 0.07 34);
--mob-muted:        oklch(54% 0.055 38);
--mob-border:       oklch(83% 0.035 64);
--mob-accent:       oklch(36% 0.11 28);
--mob-accent-bg:    oklch(90% 0.04 52);
--mob-success:      oklch(46% 0.13 148);
--mob-success-bg:   oklch(91% 0.05 132);
--mob-danger:       oklch(50% 0.15 22);
--mob-danger-bg:    oklch(93% 0.04 20);
```

**Layout:**
- Kontejner: `max-width: 430px; margin: 0 auto` — funguje jako "mobilní app" i na desktopu
- View: `position: absolute; inset: 0; display: flex; flex-direction: column`
- Scroll oblast: `flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch`
- Action bar: `padding-bottom: env(safe-area-inset-bottom)` (notch/home indicator)
- Header: `padding-top: env(safe-area-inset-top)` (status bar)

**Animace přechodů:**
```css
.slide-fwd  { animation: slideFwd  220ms cubic-bezier(0.4,0,0.2,1) both; }
.slide-back { animation: slideBack 220ms cubic-bezier(0.4,0,0.2,1) both; }
@keyframes slideFwd  { from { transform: translateX(100%); opacity: 0.7; } }
@keyframes slideBack { from { transform: translateX(-30%); opacity: 0.7; } }
```

**Touch feedback:** `:active { transform: scale(0.97); opacity: 0.85; }` na všech interaktivních prvcích.

**Typografie:** Systémový font stack (`-apple-system, BlinkMacSystemFont, Inter, sans-serif`), čísla cen v monospace (`JetBrains Mono, IBM Plex Mono, monospace`).

---

## Testování

### Unit testy hooku (`useMobilePOS.test.ts`, ~15 testů)
- Základní flow: category → tea → packaging → quantity → addItem → home
- Flow s pytlíky: packaging type=bags → quantity → bags → addItem → home
- `goBack()` vrací správný předchozí view
- `goBack()` z `home` nemění view
- `calcPrice()` sypný čaj: správný výpočet s příplatkem
- `calcPrice()` pytlíky: koeficient 2.2g/pytlík
- `confirmCheckout()` volá `postSale` se správnými daty
- `confirmCheckout()` při chybě API nastaví `error`
- `removeFromCart()` smaže správnou položku dle localId
- `newSale()` resetuje košík i výběry

### Komponenty (smoke testy)
- Každá view komponenta se renderuje bez pádu
- Kliknutí na položku volá příslušný callback

### E2E — Playwright

**Nový:** `e2e/mobile-pos-flow.spec.ts`
- Přihlásí se jako prodavačka → `/pos`
- Vybere kategorii → čaj → balení (sypný) → množství
- Ověří breadcrumb a progress bar
- Přidá do košíku → ověří košík
- Zaúčtuje → ověří success screen

**Upravený:** `e2e/pos-flow.spec.ts` — URL `/pos` → `/pos-desktop`

---

## Soubory ke změně / vytvoření

### Nové soubory
```
frontend/src/hooks/posHelpers.ts        — sdílené: getPackagingOptions, PackagingOption, calcPrice
frontend/src/hooks/useMobilePOS.ts
frontend/src/hooks/useMobilePOS.test.ts
frontend/src/pages/MobilePOS.tsx
frontend/src/pages/MobilePOS.module.css
frontend/src/components/pos-mobile/MobileHeader.tsx
frontend/src/components/pos-mobile/MobileActionBar.tsx
frontend/src/components/pos-mobile/MobileProgressBar.tsx
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

### Upravené soubory
```
frontend/src/hooks/usePOS.ts        — extrahovat getPackagingOptions + PackagingOption do posHelpers.ts
frontend/src/router/AppRouter.tsx   — přidat /pos (MobilePOS) + /pos-desktop (POS)
frontend/src/pages/Login.tsx        — redirect prodavačky na /pos místo /pos-desktop
e2e/pos-flow.spec.ts               — URL /pos → /pos-desktop
```
