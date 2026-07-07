# POS Čajovna — dvoustupňový výběr: kategorie → země

**Datum:** 2026-07-07
**Stav:** schváleno v brainstormingu (varianta A), implementace lineárně na větvi feat/kod-polozky

## Problém

POS dnes nabízí dlaždice kombinací kategorie+země (jedna dlaždice na unikátní dvojici KATEGORIE‖ZEME). Po kliknutí se ale čaje filtrují **jen podle kategorie** — země se ignoruje (latentní bug: „BÍLÝ – Čína" i „BÍLÝ – Taiwan" vedou na tentýž seznam). Uživatel chce dva kroky: nejdřív jen kategorie, pak upřesnění země.

## Řešení (varianta A — schváleno)

Nový krok `countries` ve flow hooku `useCajovnaPOS` mezi `categories` a `teas`. Navigační stav zůstává celý v hooku (vzor POS).

### Flow

home → **kategorie** (jen názvy: BÍLÝ, ČERNÝ, …) → **země** (jen u kategorií s 2+ zeměmi) → čaje → balení → množství → checkout.

- Krok zemí: první dlaždice **„Vše"** (celá kategorie), pak jednotlivé země abecedně (cs collation).
- Kategorie s 0–1 zemí: krok zemí se **přeskočí**, rovnou čaje (PUERH má dnes 1 zemi).
- Filtrování čajů: `AKTIV='x' AND kategorie` + při výběru konkrétní země `AND zeme` („Vše"/přeskočený krok = jen kategorie). Tím se opravuje i dnešní ignorace země.
- `goBack` z čajů: na `countries`, pokud se krok zobrazil; jinak na `categories`. (Podmíněný goBack má precedens: checkout → home.)

### Změny

- `frontend/src/hooks/useCajovnaPOS.ts`:
  - `CAJE_VIEW_ORDER` + view `'countries'`.
  - `deriveCategories` → vrací unikátní **názvy kategorií** (`string[]`, cs sort). Typ `CajeCategory` zůstává pro Dashboard (getCajovnaKategorie) — POS ho přestane používat.
  - Nový helper `deriveZeme(rows, kategorie): string[]` (unikátní země aktivních čajů kategorie, cs sort; prázdné/NULL země se vynechají).
  - Stav: `selectedCategory: string | null`, `selectedZeme: string | null` (null = Vše/nevybráno), `zemeOptions: string[]`.
  - `selectCategory(kategorie: string)`: 2+ zemí → view `countries`; jinak naplní čaje a jde na `teas`.
  - Nová `selectZeme(zeme: string | null)`: naplní čaje (kategorie + případná země) → `teas`.
  - `goBack` z `teas` → `countries` pokud `zemeOptions.length >= 2`, jinak `categories`.
  - `newSale`/reset čistí i `selectedZeme`/`zemeOptions`.
- `frontend/src/components/pos-cajovna/CajeCategories.tsx`: props `categories: string[]`, dlaždice jen s názvem (podtitulek země končí).
- Nová `frontend/src/components/pos-cajovna/CajeZeme.tsx`: dlaždice „Vše" + země; znovupoužívá `CajeCategories.module.css`.
- POS stránka (render view `countries`) + `CajeProgressBar`: doplnit krok (ověřit, jak bar odvozuje kroky — pokud z `CAJE_VIEW_ORDER`, přibude automaticky).
- Čaj s prázdnou ZEME (dnes v datech není): objeví se jen pod „Vše", krok zemí nespadne.

### Beze změn

Backend, DB, admin Dashboard filtry, desktop/mobilní POS mimo Čajovnu.

### Testy

`useCajovnaPOS.test.ts`: fixtures rozšířit o kategorii se 2 zeměmi; scénáře — (1) kategorie s 2+ zeměmi → view countries s „Vše"+země, (2) výběr konkrétní země filtruje kategorie+země, (3) „Vše" filtruje jen kategorii, (4) kategorie s 1 zemí přeskočí krok, (5) goBack z čajů v obou cestách, (6) newSale resetuje zemi. Komponentní testy dle stávajícího pokrytí (CajeCategories nemá vlastní test — nevytvářet nový nad rámec vzoru).
