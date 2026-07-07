# POS Čajovna — search box na obrazovce kategorií

**Datum:** 2026-07-07
**Stav:** schváleno v brainstormingu

## Problém

Cesta k čaji přes kategorie → země → čaje je pro obsluhu pomalá, pokud přesně ví, jaký čaj hledá. Chybí zkratka — napsat pár písmen z názvu a rovnou skočit na balení.

## Řešení

Search box natrvalo připnutý nahoře na obrazovce `categories` (`CajeCategories.tsx`). Dokud je prázdný, chová se obrazovka jako dnes (mřížka kategorií). Jakmile do něj uživatel píše, mřížka se nahradí seznamem odpovídajících čajů napříč všemi kategoriemi; klik na výsledek jde **rovnou na balení** (stejná cesta jako běžný výběr čaje) — kategorie i země se přeskočí.

### Matching

- Zdroj: `allRows` (už načtené v `useCajovnaPOS`), filtr `AKTIV === 'x'` + shoda v `NAZEV`.
- Case-insensitive **a bez diakritiky** — obsluha na dotykové klávesnici nemusí trefit háčky/čárky (`"cerny"` najde `"Černý"`).
- Normalizace: čistá exportovaná funkce `normalizeSearch(s: string): string` (lowercase + `NFD` + odstranění kombinujících diakritických znamének), použitá na obou stranách porovnání (query i NAZEV).
- Hledá se pouze v `NAZEV` (ne KOD, ne POZNAMKA).

### Změny

- `frontend/src/hooks/useCajovnaPOS.ts`:
  - Nový stav `searchQuery: string` (default `''`) + `setSearchQuery(q: string)`.
  - `normalizeSearch` helper (exportovaný, testovatelný samostatně).
  - Odvozený `searchResults: TeaRow[]` přes `useMemo` nad `allRows` + `searchQuery` (prázdný query → prázdné pole, komponenta pak stejně nezobrazí výsledky místo gridu).
  - `searchQuery` se vyprázdní v `selectTea` (po výběru čaje, ať už z gridu nebo z vyhledávání) a v `newSale`. Vyprázdnění při `selectCategory` není potřeba — dokud je query neprázdný, grid kategorií není vidět, takže `selectCategory` se z hledání nedá vyvolat.
- `frontend/src/components/pos-cajovna/CajeCategories.tsx`:
  - Nové props: `searchQuery: string`, `onSearchChange: (q: string) => void`, `searchResults: TeaRow[]`, `onSelectTea: (tea: TeaRow) => void`.
  - `<input>` nahoře nad `.scroll` wrapperem (styl dle `--mob-*` proměnných jako zbytek Čajovna POS).
  - `searchQuery.length === 0` → render mřížky jako dnes.
  - jinak → render `<CajeTeas teas={searchResults} categoryName="" onSelect={onSelectTea} emptyMessage="Nic nenalezeno" />`.
- `frontend/src/components/pos-cajovna/CajeTeas.tsx`:
  - Nový volitelný prop `emptyMessage?: string`, default zachovává současný text (`Žádné čaje v kategorii {categoryName}.`) pro zpětnou kompatibilitu s běžným flow.
- `frontend/src/pages/CajovnaPOS.tsx`:
  - Do `<CajeCategories>` doplnit `searchQuery={pos.searchQuery} onSearchChange={pos.setSearchQuery} searchResults={pos.searchResults} onSelectTea={pos.selectTea}`.

### Beze změn

Backend, DB, `selectTea`/balení/checkout flow, kroky `countries`/`teas`, desktop/mobilní POS mimo Čajovnu.

### Testy

- `useCajovnaPOS.test.ts`: `normalizeSearch` (diakritika, case), `searchResults` filtruje jen aktivní čaje a shoduje se bez diakritiky, `searchQuery` se vyprázdní po `selectTea`/`newSale`.
- `CajeCategories.test.tsx` (nový soubor — komponenta zatím vlastní test nemá): psaní do inputu skryje grid a zobrazí `CajeTeas` výsledky, klik na výsledek zavolá `onSelectTea`, prázdný query zobrazí grid.
