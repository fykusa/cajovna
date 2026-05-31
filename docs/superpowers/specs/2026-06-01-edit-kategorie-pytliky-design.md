# Návrh: Editace kategorií a pytlíků

**Datum:** 2026-06-01
**Stav:** Schváleno k implementaci

## Cíl

Přidat plnou správu (edit + přidání + mazání) pro **kategorie čajů** a **pytlíky**,
ve stylu existující inline-editovatelné tabulky čajů (`Items.tsx`). Sdílenou
inline-edit logiku vytáhnout do znovupoužitelné komponenty `EditableGrid`.

## Výchozí stav

- **Items (`/admin/products` → `Items.tsx`)** — inline editovatelná tabulka čajů,
  edit polí + soft-deaktivace (flag). Backend `products.php` má GET/PUT/DELETE.
  Kryto 85 frontend testy (vitest + RTL).
- **Pytlíky (`/admin/bags` → `Bags.tsx`)** — read-only, seskupené dle materiálu.
  Backend `bags.php` má **jen GET**.
- **Kategorie** — žádná admin stránka. Jen GET `listCategories` v `products.php`
  na `/api/products/categories`. Používají se v POS a jako filtr v Items.
- **Routing backendu** — explicitní per-resource rewrite v `backend/.htaccess`
  (`^api/{resource}(/.*)?$ → api/{resource}.php`).
- **Schéma** (`db/schema.sql`):
  - `tea_categories`: `id`, `name`, `parent_id` (FK self, `ON DELETE SET NULL`),
    `sort_order`. FK z `teas.category_id` je `ON DELETE RESTRICT`.
  - `bags`: `id`, `surface_type`, `volume_ml`, `dimensions`, `price_per_piece`
    (+ nákupní var-sloupce `var1..3_*`, `supplier_url` — mimo rozsah).

## Rozhodnutí

- **Operace:** edit + přidání + mazání.
- **Mazání:** hard delete s FK guardem → HTTP 409 s přívětivou hláškou
  (stejný vzor jako `deleteProduct`). Soft-deaktivace se nedělá — kategorie ani
  pytlíky nemají `flag`/`active` sloupec a přidávat ho je mimo rozsah.
- **Architektura:** vytáhnout sdílený `EditableGrid`; Items se na něj přepne.
- **Pytlíky:** plochá editovatelná tabulka (materiál je editovatelný sloupec),
  seskupení dle materiálu zaniká.

## 1. Sdílená komponenta `EditableGrid`

Nový soubor `frontend/src/components/admin/EditableGrid.tsx`. Vytáhne z `Items.tsx`
keyboard-edit engine:

- stav `selectedCell` / `editingCell` / `editValue`,
- klávesy: šipky (navigace mezi buňkami; **během editace neaktivní** — viz
  stávající fix `if (editingCell) return`), Enter (vstup do editace / uložení),
  Escape (zrušení editace),
- inline editor (`input type=text` + `inputMode=decimal` pro čísla + `size={1}`;
  `select` pro typ select),
- formátování čísel přes `parseFloat` (zahodí `.0`/`.000`),
- skrytí výběrového outline u buňky, která se právě edituje,
- návrat focusu na grid kontejner po uložení/zrušení.

### Rozhraní

```ts
interface ColDef<T> {
  key: keyof T & string
  label: string
  type: 'readonly' | 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]   // pro select
  render?: (row: T) => string                      // vlastní zobrazení (např. název kategorie)
}

interface EditableGridProps<T> {
  columns: ColDef<T>[]
  rows: T[]
  getRowId: (row: T) => number
  // stránka řeší API volání, parsování hodnoty dle typu a aktualizaci svého stavu:
  onSaveCell: (row: T, col: ColDef<T>, value: string) => Promise<void>
  renderRowActions?: (row: T) => ReactNode   // tlačítka vpravo (deaktivovat / smazat)
}
```

### Princip izolace

Grid drží **pouze UI stav editace**. Zdroj pravdy o datech (`rows`) i ukládání
vlastní stránka přes `onSaveCell`. Zobrazení buňky:
1. `col.render(row)` má-li ho,
2. jinak `row[col.key]`; u `type === 'number'` přes `parseFloat`; u `select`
   se hodnota mapuje na `options[].label`.

Sloupec akcí se renderuje jen když je `renderRowActions` předáno.

## 2. Refactor `Items.tsx`

Items přepsat tak, aby renderoval `<EditableGrid>`. V Items zůstává:
- filtry (`showInactive`, filtr kategorií), hlavička stránky,
- `onSaveCell` handler s rozlišením stock (`updateStock`) vs product (`updateProduct`)
  a parsováním (`category_id` → int, number → float|null),
- `renderRowActions` = tlačítko deaktivovat/aktivovat (flag toggle).

**Žádná změna chování.** Stávajících 85 testů musí zůstat zelených (hlídají
keyboard nav, deaktivaci, formátování čísel). Selektory v `Items.test.tsx` se
případně upraví na nové DOM, ale aserce chování se nemění.

## 3. Backend (PHP)

### Kategorie — nový `backend/api/categories.php`

- `GET /api/categories` — list (stejné jako stávající `listCategories`).
- `GET /api/categories/{id}` — detail.
- `POST /api/categories` — vytvoření (`requireAdmin`), vrací nový řádek.
- `PUT /api/categories/{id}` — update (`requireAdmin`), allow-list polí
  `name`, `parent_id`, `sort_order`; vrací aktualizovaný řádek.
- `DELETE /api/categories/{id}` — (`requireAdmin`), hard delete; FK z `teas`
  je RESTRICT → při použití PDOException `23000` → HTTP 409
  „Kategorie je použita u čajů, nelze smazat".
- `.htaccess`: přidat `RewriteRule ^api/categories(/.*)?$ api/categories.php [QSA,L]`.
- Stávající `GET /api/products/categories` se **zachová** (POS a Items filtr na něm
  závisí), aby refactor backendu nerozbil frontend mimo rozsah.

### Pytlíky — rozšířit `backend/api/bags.php`

- Allow-Methods header: `GET, POST, PUT, DELETE, OPTIONS`.
- `POST /api/bags` — vytvoření (`requireAdmin`), vrací nový řádek.
- `PUT /api/bags/{id}` — update (`requireAdmin`), allow-list
  `surface_type`, `volume_ml`, `dimensions`, `price_per_piece`; vrací řádek.
- `DELETE /api/bags/{id}` — (`requireAdmin`), hard delete; FK `fk_sale_items_bag`
  (`sale_items.bag_id`, `ON DELETE RESTRICT`) → při použití PDOException `23000`
  → HTTP 409 „Pytlík je použit v prodeji, nelze smazat".
- Zápisové operace vyžadují `requireAdmin` (čtení `requireAuth` jako dosud).

## 4. Frontend — API a stránky

### API moduly

- nový `frontend/src/api/categories.ts`:
  `getCategories`, `createCategory`, `updateCategory`, `deleteCategory`.
- rozšířit `frontend/src/api/bags.ts`:
  `createBag`, `updateBag`, `deleteBag` (+ stávající `getBags`).
- Typy: `Category` už existuje. `Bag` už existuje (5 polí).

### Kategorie — `frontend/src/pages/admin/Categories.tsx`

- Route `/admin/categories`, lazy import v `AppRouter.tsx`.
- Nav prvek „Kategorie" v `AdminLayout.tsx` za „Čaje".
- Sloupce: ID (readonly), Název (text), Nadřazená (select kategorií +
  „(žádná)" → `parent_id = null`), Pořadí (number).
- Tlačítko „Přidat" → `createCategory({ name: 'Nová kategorie', parent_id: null,
  sort_order: 0 })`, řádek se připne a otevře se editace názvu.
- `renderRowActions` = tlačítko „smazat" (červené, jako varovné) → `deleteCategory`;
  při 409 zobrazit vrácenou chybu.

### Pytlíky — přepsat `frontend/src/pages/admin/Bags.tsx`

- Plochá `EditableGrid`. Sloupce: ID (readonly), Materiál (text),
  Objem ml (number), Rozměry (text), Cena/ks (number).
- Tlačítko „Přidat" → `createBag` s defaulty → editace.
- `renderRowActions` = „smazat" → `deleteBag`; 409 handling.

## 5. Datový tok

1. Stránka načte data (`getX`) do lokálního stavu `rows`.
2. Uživatel edituje buňku → `EditableGrid` zavolá `onSaveCell(row, col, value)`.
3. Stránka naparsuje hodnotu, zavolá `updateX`, dostane aktualizovaný řádek,
   `setRows(prev => prev.map(...))`.
4. „Přidat" → `createX` → `setRows(prev => [...prev, newRow])`, výběr na nový řádek.
5. „Smazat" → `deleteX` → při úspěchu `setRows(prev => prev.filter(...))`,
   při 409 `setError(zpráva)`.

## 6. Ošetření chyb

- 401 (expirace) — řeší centrálně `apiFetch` (redirect na login).
- 409 (FK guard při mazání) — stránka zobrazí přívětivou hlášku z těla odpovědi.
- Validace — minimální (MVP): prázdný název kategorie backend přijme, ale
  povinná pole (`volume_ml`, `price_per_piece` u bags jsou NOT NULL) ošetřit
  defaulty při POST.

## 7. Testy

Frontend (vitest + RTL), statický mock import (viz konvence projektu):

- `EditableGrid.test.tsx` — navigace šipkami, vstup/výstup z editace, šipky během
  editace nepřesouvají výběr, `onSaveCell` se volá se správnými argumenty,
  formátování čísel, `renderRowActions` se renderuje.
- `Categories.test.tsx` — render seznamu, edit pole → `updateCategory`, přidání →
  `createCategory`, smazání → `deleteCategory`, 409 zobrazí chybu.
- `Bags.test.tsx` — render ploché tabulky, edit, přidání, smazání.
- `Items.test.tsx` — upravit selektory na novou strukturu, chování beze změny.

Backend PHP nemá test framework (jako zbytek repa) → ověření přes běžící aplikaci
(`docker compose up`, frontend `npm run dev`).

## Fázování implementace

1. **Fáze 1 — EditableGrid + refactor Items.** Čistý refactor; stávající Items
   testy zůstávají zelené. Přidat `EditableGrid.test.tsx`.
2. **Fáze 2 — Kategorie.** Backend `categories.php` + `.htaccess`, `api/categories.ts`,
   `Categories.tsx` + route + nav, testy.
3. **Fáze 3 — Pytlíky.** Backend rozšíření `bags.php`, `api/bags.ts`,
   přepis `Bags.tsx`, testy.

Fáze 2 a 3 jsou na sobě nezávislé (obě stojí na Fázi 1).

## Mimo rozsah

- Nákupní var-sloupce pytlíků (`var1..3_*`, `supplier_url`).
- Soft-deaktivace kategorií/pytlíků (vyžaduje změnu schématu).
- Drag-and-drop řazení kategorií (řeší se polem „Pořadí").
- Pokročilá validace formulářů.
