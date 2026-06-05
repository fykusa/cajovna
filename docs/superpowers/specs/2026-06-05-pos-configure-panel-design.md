# POS — Configure Panel (3-panel redesign)

**Datum:** 2026-06-05  
**Scope:** POS workflow po výběru čaje — výběr balení, množství a pytlíku v jedné obrazovce

---

## Kontext

Stávající flow po výběru čaje: `quantity` (modal) → `bag_yn` → `bag_material` → `bag_volume` (4 sekvenční kroky). Nový design je sloučí do jednoho kroku `configure` se třemi vertikálními panely.

Výběr kategorie a čaje se nemění.

---

## State model

### Změny v `POSStep`

Odebrat: `'quantity'`, `'bag_yn'`, `'bag_material'`, `'bag_volume'`  
Přidat: `'configure'`

### Nová pole v `POSState`

```ts
configPanel: 'packaging' | 'quantity' | 'bag'
packagingIndex: number   // index do pole packagingOptions (odvozeného z selectedTea)
bagIndex: number         // 0 = žádný, 1..N = pytlík z bagList
```

### Odebrat z `POSState`

`wantBag`, `materialIndex`, `volumeIndex`, `bagVolumes`

### Stávající pole zachovat

`quantity: number` zůstává pro hodnotu množství.

### Computed (odvozovat při renderování, neukládat do state)

```ts
// Dostupná balení čaje
type PackagingOption = { type: ItemType; label: string; weightG: number; price: number }
packagingOptions = filtrace std/pkg1/pkg2 z selectedTea (jen nenullové)

// Seznam pytlíků
type BagListItem = { bag: Bag | null; label: string }
bagList = [{ bag: null, label: 'Žádný' }, ...bags.map(b => ({ bag: b, label: `${b.surface_type} ${b.volume_ml} ml` }))]
         // seřazeno dle surface_type ASC, volume_ml ASC
```

---

## Klávesnicová navigace

Platí pro `step === 'configure'`:

| Klávesa | Chování |
|---------|---------|
| `ArrowLeft` | configPanel: quantity→packaging, bag→quantity, packaging→(nic) |
| `ArrowRight` | configPanel: packaging→quantity, quantity→bag, bag→(nic) |
| `ArrowUp` | v packaging: packagingIndex−1 (wrap); v quantity: quantity+1; v bag: bagIndex−1 (wrap) |
| `ArrowDown` | v packaging: packagingIndex+1 (wrap); v quantity: quantity−1 (min 1); v bag: bagIndex+1 (wrap) |
| `Enter` | potvrdí celou konfiguraci, přidá položku do košíku, vrátí na `category` |
| `Escape` | `CANCEL_ITEM` → vrátí na `category` |

Množství **není `<input type="number">`** — jen číslo ovládané šipkami. Žádný focus trap.

Nový krok `configure` se aktivuje při vstupu do `POS.tsx` kbd handleru stejnou cestou jako dřívější `quantity`/`bag_*` (blok před INPUT guard).

---

## Reducer změny

### CONFIRM (tea step → configure)

```ts
if (state.step === 'tea') {
  return { ...state, step: 'configure', configPanel: 'packaging', packagingIndex: 0, bagIndex: 0, quantity: 1, selectedTea: tea }
}
```

### CONFIRM (configure → cart)

Sestaví `CartItem` z:
- `packagingOptions[packagingIndex]` → `itemType` + `unitPrice`
- `quantity`
- `bagIndex === 0 ? null : bagList[bagIndex]` → `bag`

Vrátí na `step: 'category'`.

### MOVE_LEFT / MOVE_RIGHT

Nová větev pro `step === 'configure'`: posouvá `configPanel`.

### MOVE_UP / MOVE_DOWN

Nová větev pro `step === 'configure'`: dle aktivního `configPanel`.

### Odebrat větve

`bag_yn`, `bag_material`, `bag_volume` větve v CONFIRM, MOVE_UP, MOVE_DOWN.

---

## UI komponenty

### Odstranit

- `QuantityModal.tsx` + `.module.css`
- `QuantitySelector.tsx` + `.module.css`
- `BagSelector.tsx` + `.module.css`

### Přidat

`components/pos/ConfigurePanel.tsx` — 3 vertikální sekce:

```
┌─────────────┬──────────────┬─────────────┐
│  Balení     │  Množství    │  Pytlík     │
│  ─────────  │  ─────────   │  ─────────  │
│ ▶ Std 240Kč │      3       │ ▶ Žádný     │
│   Bal1 830  │              │   Papír 100 │
│   Bal2 1990 │              │   Papír 200 │
└─────────────┴──────────────┴─────────────┘
```

Props:
```ts
interface Props {
  tea: Tea
  packagingOptions: PackagingOption[]
  packagingIndex: number
  quantity: number
  bagList: Array<{ bag: Bag | null; label: string }>
  bagIndex: number
  activePanel: 'packaging' | 'quantity' | 'bag'
}
```

Aktivní panel: zvýrazněný border (`#4caf50`), background mírně odlišný.  
Aktivní položka v seznamu: zelená (stejný styl jako kategorie/čaje).

`ConfigurePanel.module.css` — flex row, každá sekce `flex: 1`, `border-right: 1px solid #333`.

### Změny v `POS.tsx`

- `renderMainPanel()`: nová větev pro `step === 'configure'` → renderuje `<ConfigurePanel />`
- Odebrat podmíněný render `<QuantityModal />` (byl mimo `<main>`)
- Kbd handler: blok pro configure steps

### Změny v `POS.module.css`

Žádné — stávající `splitLayout` se použije pro configure panel (3 sekce jsou uvnitř).

---

## Testy

### Unit testy (usePOS.test.ts)

- CONFIRM v tea step přejde na configure
- MOVE_LEFT/RIGHT přepíná configPanel
- MOVE_UP/DOWN v packaging mění packagingIndex
- MOVE_UP/DOWN v quantity mění quantity (min 1)
- MOVE_UP/DOWN v bag mění bagIndex
- CONFIRM v configure přidá item do košíku se správným itemType, quantity, bag
- CONFIRM s bagIndex=0 přidá item bez pytlíku

### Unit testy (ConfigurePanel.test.tsx)

- Renderuje 3 sekce
- Aktivní panel má CSS třídu `active`
- Zobrazí správná balení, množství, pytlíky

---

## Co se nemění

- Cart (vpravo) — beze změny
- Checkout flow — beze změny
- `buildCartItem` helper — beze změny (může být)
- Kategorie / čaj výběr — beze změny
- Hledání — beze změny
