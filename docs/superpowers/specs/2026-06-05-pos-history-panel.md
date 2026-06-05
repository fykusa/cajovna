# POS — Panel s historií dnešních prodejů

**Date:** 2026-06-05  
**Status:** Design approved  
**Model:** Sonnet 4.6

## Přehled

Přidání historického panelu do levého panelu POS stránky. Uživatel (prodavač) může přepínat mezi režimem prodeje (kategorie) a režimem historie (dnešní transakce). Pomocí šipek a kliku lze navigovat historii a zobrazit detail staré transakce v sekci košíku.

## Motivace

Prodavač potřebuje rychle vidět historii dnešních prodejů bez opuštění POS (bez odchodu do Admin sekce). Použití je čtení — klik na transakci ji zobrazí v košíku, nic se neupraví.

## Chování a interakce

### Levý panel — dva režimy

Levý panel se přepíná mezi:
- **sell mode** (default): Kategorie čajů (3/4 výšky), dole mini-historia (1/4 výšky)
- **history mode**: Celoobrazovkový seznam dnešních prodejů

Volba: **Vertikální split** — oba vždy viditelné, rozlišné scrollbary.

### Ovládání

| Klávesa | Chování |
|---------|---------|
| **SPACE** | Přepínání mezi režimy (jen když `step === 'category'`; rozpracovaný prodej blokuje) |
| **↑↓ v sell mode** | Navigace mezi kategoriemi (current) |
| **↑↓ v history mode** | Navigace mezi transakcemi; **automatické zobrazení** v košíku |
| **ENTER v sell mode** | Výběr kategorie → čaj (current) |
| **Klik na kategorii** | Ekvivalent ENTER — výběr |
| **Klik na historii** | Ekvivalent šipky — zobrazí se v košíku automaticky |

### Historia — co se zobrazuje

Formát řádku: `Zelený čaj Sencha ×2 | 14:32 | prodavačka | 260 Kč`

- Nejnovější prodeje nahoře
- Scrollovatelná sekce
- Bez editace, jen čtení

### Košík — zobrazení prodeje

Když je vybraná transakce z historie, košík zobrazí:
- Hlavička: Čas, prodavač, celková cena
- Seznam položek: SaleItem format (item_type, tea/bag, qty, unit_price, total_price)
- **Bez tlačítka "Zaplatit"** — je to jen náhled

### Vrácení do prodeje

SPACE přepne zpět do sell mode. Košík zůstane s detailem transakce (neuroutit se).

## State (POS.tsx, `useState`)

```typescript
const [posMode, setPosMode] = useState<'sell' | 'history'>('sell')
const [history, setHistory] = useState<Sale[]>([])
const [historyIndex, setHistoryIndex] = useState(0)
const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
const [historyLoading, setHistoryLoading] = useState(true)
const [historyError, setHistoryError] = useState<string | null>(null)
```

## API

**Endpoint:** `getSales({ date_from, date_to, ... })`  
**Filter:** `date_from = today 00:00`, `date_to = today 23:59`  
**Timing:** On mount (parallel s ostatními daty v usePOS)  
**Fallback:** Pokud je chyba, `history = []`, UI zobrazí "Není k dispozici"

## Komponenty a změny

### POS.tsx
- Nový useState pro `posMode`, `history`, `historyIndex`, `selectedSale`
- Nový handler `handleSpace` — přepínání módů (s guardem `state.step === 'category'`)
- Nový handler pro navigaci v historii — šipky mění `historyIndex`, auto-zobrazí `selectedSale`
- Layout: levý panel se rozdělí — `CategoriesPanel` + `HistoryPanel` v griduı, pravý panel jako dnes
- Aktualizace handleKey — SPACE vstoupí do switch-case

### Nová komponenta: HistoryPanel.tsx
```typescript
interface Props {
  sales: Sale[]
  selectedIndex: number
  onSelect: (sale: Sale, index: number) => void
  isActive: boolean
}
```
- Zobrazuje seznam prodejů (nejnovější nahoře)
- Highlight aktuálně vybraného (barva pozadí)
- Scrolluje na vybraný (automaticky, aby byl vidět)

### Nová komponenta: SaleDetailView.tsx (nebo reuse existujícího)
```typescript
interface Props {
  sale: Sale | null
  items: SaleItem[]
  mode: 'view' // vs. future 'edit'
}
```
- Zobrazuje detail prodeje v košíku
- Bez zaplatit tlačítka
- Pokud je `sale = null`, zobrazí "Košík je prázdný" jako dnes

### API (frontend/src/api/sales.ts)
- Rozšíření `getSales` call v POS.tsx `useEffect` na init
- Filtr: `getSales({ date_from: todayStart, date_to: todayEnd })`

## UI

### Layout rozdělení (CSS)
```
Levý panel (35%):
├─ Kategorie (75%)  [scrollable]
└─ Historia (25%)   [scrollable]

Pravý panel (65%):
└─ Košík [scrollable, detail prodeje nebo empty]
```

### Barvy a indikátory
- History řádek: On hover — border-left highlight, background subtle
- Active (vybraný): Background #6abf69 text #111
- Mode indicator (mini): "HISTORY MODE" badge v headeru mini-panelu dole

## Error handling

- API timeout/404: `historyError = "Nepodařilo se načíst historii"`, history zůstane []
- Prázdná historia (nic se dnes neprodalo): UI zobrazí "Není k dispozici" nebo prázdný seznam
- Rozpracovaný prodej blokuje SPACE: Žádné chybové zprávy, SPACE se tiše ignoruje

## Testing

- Unit: Nový stav — navigace v historii, přepínání módů
- Integration: On mount načte data, SPACE mění mód, šipky navigují + auto-zobrazují
- E2E: Proveď prodej, zkontroluj historii, přepni na historii, zobraz starý prodej, vrať se

## Edge cases

- **Rozpracovaný prodej + SPACE** → Ignoruje se
- **Žádná data v historii** → UI "Není k dispozici"
- **API chyba** → Graceful fallback, prodej mode zůstane funkční
- **Klik na tu samou transakci 2×** → Nic se neděje (je už vybraná)
- **SPACE ve vyhledávání (search mode)** → Ignoruje se (protože `step !== 'category'`)

## Poznámky k implementaci

1. Načítání historie probíhá v `useEffect` v POS.tsx spolu s ostatními daty usePOS (na mount)
2. Historie se cachuje v state — bez polling/refresh (lze přidat později)
3. Automatické zobrazení = bez extra akce, jakmile se navigace zastaví, `setSelectedSale` se zavolá
4. Scroll na vybraný prvek — `HistoryPanel` si řídí ref/scrollIntoView
