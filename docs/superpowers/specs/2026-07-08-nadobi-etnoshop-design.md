# Nádobí + Etnoshop jako další produktové řady

**Datum:** 2026-07-08
**Stav:** schváleno v brainstormingu

## Problém

Zdrojový Google Sheet má nově dva další štítky vedle CAJE — NADOBI a ETNOSHOP, se stejnou strukturou sloupců (KATEGORIE, ZEME, AKTIV, KOD, NAZEV, POZNAMKA, 4 úrovně balení MN1-4/CENA1-4). Uživatel chce se k nim chovat úplně stejně jako k čaji: vlastní sync tlačítko v adminu, vlastní přehled v admin sekci, možnost prodávat je v POS (CajovnaPOS).

## Řešení

### Datová vrstva

Dvě nové tabulky, zrcadlící `01_caje` 1:1 (stejné sloupce + `V_SHEETU` flag): `02_nadobi`, `03_etnoshop`. `01_caje` se **vůbec nemění** — chráníme dnes prvně nasazený a odladěný systém (KOD business klíč, sync, CGIPassAuth fix, migrace) před jakýmkoli rizikem regrese.

`00_prodej_polozky`:
- Přidán sloupec `PRODUKT_TYP ENUM('caje','nadobi','etnoshop') NOT NULL DEFAULT 'caje'`.
- Sloupec `caje_kod` se **nepřejmenovává** — zůstává nosičem KODu z libovolné ze 3 tabulek podle `PRODUKT_TYP` (přejmenování by znamenalo další migraci na tabulce, která dnes prošla bolestivým laděním; riziko/přínos nestojí za to).
- **Zrušena FK `fk_polozky_kod`** (přidaná dnes, viz `docs/superpowers/specs/2026-07-07-pos-search-caju-design.md` a incident v `production-deploy` paměti) — MySQL neumí podmíněnou FK na jednu ze 3 tabulek podle typu. Nahrazeno aplikační validací existence KODu při zápisu prodeje (`createProdej` v `cajovna.php`), platí stejně pro všechny 3 typy včetně čaje.

### Sync (backend)

- `backend/lib/sheets_sync.php`: `sheetsSyncCaje`/`sheetsUpsertCaje` zobecněny na parametrizované `sheetsSyncProdukty(PDO $pdo, string $csvUrl, string $tableName): array`. Sloupcová struktura (`SHEETS_COL_INDICES`/`SHEETS_COL_NAMES`) je shodná pro všechny 3 sheety, takže jde o mechanické zobecnění beze změny chování pro čaj. Zachovány wrappery `sheetsSyncCaje()`/`sheetsSyncNadobi()`/`sheetsSyncEtnoshop()` volající obecnou funkci s pevnou tabulkou (čitelnost, konzistence s existujícím API).
- `backend/config/sheets.php`: přibudou klíče `nadobi_csv_url`, `etnoshop_csv_url` (`config/sheets.example.php` také aktualizovat).
- `backend/api/admin.php`: `handleSheetsSync` přečte nový query parametr `?sheet=caje|nadobi|etnoshop` (default `caje` pro zpětnou kompatibilitu se stávajícím Apps Script voláním), zvolí odpovídající CSV URL + tabulku.

### Admin katalogy

- `frontend/src/pages/admin/Teas.tsx` zobecněn na parametrizovanou komponentu (přijímá typ produktu → endpoint, název tabulky, nadpis). Použit 3× pod routami `/admin/teas`, `/admin/nadobi`, `/admin/etnoshop`, každá se svým sync tlačítkem volajícím `?sheet=<typ>`.
- `frontend/src/router/AppRouter.tsx`: 2 nové admin routy.
- Nav sidebar (`AdminLayout`): položky "Nádobí", "Etnoshop" vedle "Čaje".
- `frontend/src/api/teas.ts` zobecněn na parametrizované `getProdukty(typ: 'caje' | 'nadobi' | 'etnoshop')` (konzistentní s generalizací sync/admin/POS vrstvy); stávající `getTeas()` zůstává jako tenký wrapper (`getProdukty('caje')`) kvůli zpětné kompatibilitě volajících míst.

### POS flow

- `CajeHome.tsx`: místo jednoho tlačítka "+ Přidat položku" tři — **Čaj / Nádobí / Etnoshop**. Klik na kterékoli rovnou vede na výběr kategorie dané řady (žádný mezikrok navíc).
- `useCajovnaPOS.ts` a komponenty `CajeCategories`, `CajeZeme`, `CajeTeas`, `CajePackaging`, `CajeQuantity` zobecněny parametrem produktové řady (endpoint pro čaje/kategorie, KOD prefix pro validaci) — beze změny chování a vzhledu pro čaj, jen navíc podporují i nádobí/etnoshop nad stejným flow (kategorie → země → produkt → balení → množství → košík; krok země se stále přeskakuje u ≤1 země, dle dnešní logiky).
- Košík a checkout zůstávají **jednotné** napříč typy — jedna transakce `00_prodej` může obsahovat čaj i nádobí najednou; každá položka v `00_prodej_polozky` nese svůj `PRODUKT_TYP`.
- `frontend/src/types.ts`: `TeaRow` je již strukturálně identický pro všechny 3 řady (potvrzeno uživatelem) — ponechán název `TeaRow` beze změny (přejmenování na obecnější typ by bylo čistě kosmetické a zvyšovalo by diff bez přínosu).

### Beze změny (mimo rozsah)

Dashboard filtry a stránka Tržby zůstávají jen pro čaj — rozšíření reportingu o produktovou řadu je samostatný následný úkol v `tasks.md`. Export/import celé DB (`db_transfer.php`) — nové tabulky se do exportu/importu doplní jako součást implementace (musí být v `DBT_GROUPS`), ale bez zvláštního reportingového UI.

### Testy

- `sheets_sync.test`/PHP CLI ekvivalent (`tools/test_sheets_sync.php` vzor): `sheetsSyncProdukty` nad fixture CSV pro nadobi/etnoshop, stejné scénáře jako dnes pro čaj (upsert, V_SHEETU vyřazení, duplicitní KOD).
- `useCajovnaPOS.test.ts`: zobecněné testy parametrizované přes produktovou řadu (fixtures pro nadobi/etnoshop), ověřit že existující čajové testy beze změny procházejí (žádná regrese).
- `CajeCategories.test.tsx` a další komponentní testy: ověřit parametrizaci nezměnila chování pro čaj.
- Aplikační validace KODu v `createProdej` (nahrazující zrušenou FK): test na neplatný KOD → 400, platný KOD kterékoli ze 3 tabulek → úspěch.
- Admin: nový/zobecněný test pro parametrizovanou Teas.tsx komponentu (sync tlačítko, načítání, filtr).
