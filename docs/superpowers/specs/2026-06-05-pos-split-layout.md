# Spec: POS Split Layout — Kategorie & Čaje Side-by-Side

**Datum:** 2026-06-05  
**Status:** Design approved, ready for implementation

## Přehled

Refactor POS UI z sekvenčního flow (obrazovka 1: kategorie → obrazovka 2: čaje) na jednu stránku s vertikálním splitlayoutem:
- **Levá čtvrtina (25%):** seznam kategorií
- **Pravých 75%:** seznam čajů z vybrané kategorie

Navigace mezi panely pomocí šipek (doprava/doleva), keyboard flow zůstává konzistentní.

## Architektura

### State Management (usePOS hook)

Existující state se rozšíří o:
```typescript
activePanel: 'categories' | 'teas'  // který panel má focus
```

Při vstupu na POS: `activePanel = 'categories'`, focus na první kategorii.

### Komponenty

**Nová rozdělení:**
- `CategoryPanel.tsx` — levý panel (25%), seznam kategorií
  - Přijímá: `categories`, `selectedCategoryId`, `onSelectCategory`
  - Keyboard: šipka nahoru/dolů (change category), šipka doprava (focus to teas)
  
- `TeaPanel.tsx` — pravý panel (75%), seznam čajů
  - Přijímá: `teas` (čaje z vybrané kategorie), `selectedTeaId`, `onSelectTea`, `onTeaSelected` (ENTER handler)
  - Keyboard: šipka nahoru/dolů (navigate teas), šipka doleva (focus back to categories), ENTER (modal flow)
  - Při filtru: schová se, vidět jen filtrované čaje

**Refactor:**
- `POS.tsx` — změní se na splitlayout (flex, 25%/75%)
  - Hlavní keyboard handler expanduje na logiku pro `activePanel`
  - Filter state zůstává jak je (ale ovlivní filtrování čajů, skrytí kategorií)

### Keyboard Flow

```
Focus = categories:
  ↑/↓ → změna vybrané kategorie, refresh čajů vpravo
  → → focus = teas
  
Focus = teas:
  ↑/↓ → změna vybraného čaje
  ← → focus = categories
  Enter → modal: množství → pytlík → vrátit se na stejné místo
  
Filter aktivní (uživatel píše):
  Kategorie zmizí, vidět jen filtrované čaje
  Escape → filtr zrušen, vrátit se na poslední kategorii + čaje
```

### Filter Mechanika

**Stav:** `filterText` (existuje)

Chování:
- Když je `filterText` neprázdný:
  - CategoryPanel se schová (or renders disabled)
  - TeaPanel zobrazí jen čaje matchující `filterText`
  - `activePanel` se nastaví na 'teas' (aby se keyboard handler zaměřil na čaje)
  
- `Escape` v FilterInput:
  - Zruší `filterText` (set na '')
  - `activePanel` se vrátí na 'categories'
  - Refresh kategorie + čaje

### Modální dialogy

Bez změn — existující flow (množství → pytlík) zůstává stejný. Po potvrzení pytlíku se vrátí na POS layout, `activePanel` zůstane na 'teas', fokus na stejné kategorii + čaj.

## Komponenty a Odpovědnosti

| Komponenta | Odpovědnost | Změna |
|---|---|---|
| `POS.tsx` | Layout (flex split), keyboard handler | Nová logika pro `activePanel` |
| `usePOS.ts` | State machine | Přidat `activePanel` state + actions |
| `CategoryPanel.tsx` | Render kategorií, handle kategorie keyboard | Nová |
| `TeaPanel.tsx` | Render čajů, handle čaje keyboard | Nová |
| `QuantityModal` | Množství | Žádná změna |
| `BagModal` | Pytlík | Žádná změna |

## Data Flow

```
POS.tsx (state: activePanel, categories, selectedCategoryId, teas, selectedTeaId, filterText)
├── CategoryPanel
│   ├── Input: selectedCategoryId, categories, onSelectCategory, activePanel
│   └── Output: onSelectCategory (dispatch)
│
└── TeaPanel
    ├── Input: selectedTeaId, teas (filtered based on filterText), onSelectTea, onTeasSelected
    └── Output: onSelectTea (dispatch), onTeasSelected (dispatch + open modals)
```

## Styling

- **CategoryPanel:** border-right (oddělení), min-width 25%, max-height: viewport
- **TeaPanel:** flex-grow 1, max-height: viewport
- Obě panely: scrollable (if overflow), highlight na vybraném prvku (green bg, similar to current)
- Modal dialogy se otevírají over splitlayout (z-index)

## Testing

Existující E2E testy (`pos.spec.ts`) se rozšíří na:
1. ✓ Otevření POS → focus na 1. kategorii, vidět čaje z ní
2. ✓ Šipka nahoru/dolů → změna kategorie, refresh čajů
3. ✓ Šipka doprava → focus přejde na čaje
4. ✓ V čajích: šipka nahoru/dolů → navigace
5. ✓ V čajích: ENTER → modal množství
6. ✓ Šipka doleva z čajů → focus zpět na kategorie
7. ✓ Psaní filtru → kategorie zmizí, vidět jen filtrované čaje
8. ✓ Escape ve filtru → vrátit se na kategorii + čaje
9. ✓ Po OK modálů → vrátit se na stejné místo v layoutu

## Edge Cases

1. **Filtr a malý viewport:** Kategorie zmizí, čaje zabírají 100%. OK (responsive).
2. **Kategorie bez čajů:** TeaPanel je prázdný. OK (konsistentní s aktuálním chováním).
3. **Filtr se rozmazem:** Filtr hledá v `name` čaje. OK (stejně jako dřív).
4. **Scroll v kategoriích + čajích:** Obě panely mají vlastní scroll. OK.
5. **Modal keyboard:** Při otevřeném modálu se keyboard handler ignores (stav se změní). OK (existující chování).

## Scope

- Nic se nemění v backendových API — POS data flow zůstává stejný
- Modály (množství, pytlík) se nemění — jen se otevírají stejným způsobem
- Filtr mechanika se nemění — jen se visual effect (kategorie zmizí)

## Next Steps

1. Napsat implementační plán (komponenty, test scénáře, order)
2. Implementovat CategoryPanel, TeaPanel
3. Refactor usePOS + keyboard handler
4. Update styling (flex split)
5. Update E2E testy
