# Nákupní ceny čaje (4 balení)

**Datum:** 2026-07-18
**Stav:** schváleno v brainstormingu

## Problém

Zdrojový Google Sheet (záložka CAJE) obsahuje kromě prodejních cen (MN1-4/CENA1-4, sloupce G-T) i nákupní ceny pro totéž balení, ve sloupcích W-Z:

- **S** = MN4, **T** = CENA4 (beze změny, stávající prodejní cena balení "čajovna")
- **U** = mezera (nepoužito, stejně jako u předchozích bloků balení)
- **V** = množství nákupního balení — mimo rozsah této úpravy, neukládá se
- **W** = nákupní cena — standart
- **X** = nákupní cena — větší
- **Y** = nákupní cena — největší
- **Z** = nákupní cena — čajovna

Uživatel chce mít tato nákupní data v DB pro pozdější výpočty marže a zobrazit je v adminu vedle prodejních cen. Analogická nákupní data pro Nádobí a Etnoshop budou řešena samostatně později (jiné sloupce, jiná struktura) — tato úprava se týká výhradně `01_caje`.

## Řešení

### Datová vrstva

Nová migrace `db/migration_2026-07-18_nakupni_ceny_caje.sql`, přidává 4 sloupce do `01_caje` (stejný datový typ jako CENA1-4, tedy `INT NULL`):

```sql
ALTER TABLE `01_caje`
  ADD COLUMN `NAKUP1` INT NULL AFTER `CENA4`,
  ADD COLUMN `NAKUP2` INT NULL AFTER `NAKUP1`,
  ADD COLUMN `NAKUP3` INT NULL AFTER `NAKUP2`,
  ADD COLUMN `NAKUP4` INT NULL AFTER `NAKUP3`;
```

`NAKUP1`-`NAKUP4` párují 1:1 s `CENA1`-`CENA4` (tedy i s balením `MN1`-`MN4`): `NAKUP1` = nákupní cena pro balení, jehož prodejní cena je `CENA1` (standart), atd. `02_nadobi` a `03_etnoshop` se nemění.

### Sync (`backend/lib/sheets_sync.php`)

Dnes je sloupcová struktura sheetu (`SHEETS_COL_INDICES`/`SHEETS_COL_NAMES`) jeden sdílený seznam použitý pro sync všech tří produktových tabulek (jsou strukturně identické). Nákupní sloupce W-Z existují ale jen ve smysluplné podobě u čajů, takže je nelze přidat do sdíleného seznamu — sync nádobí/etnoshopu by se pak pokoušel zapisovat `NAKUP1`-`NAKUP4` do tabulek, které tyto sloupce nemají (SQL chyba).

Řešení: sloupcová struktura se odvodí podle cílové tabulky.

- Nová konstanta `CAJE_EXTRA_COL_INDICES = [22, 23, 24, 25]` (W, X, Y, Z) a `CAJE_EXTRA_COL_NAMES = ['NAKUP1', 'NAKUP2', 'NAKUP3', 'NAKUP4']`.
- Nová funkce `columnsForTable(string $tableName): array` vrací `[$colIndices, $colNames]` — základních 14 sloupců pro všechny tabulky, plus `CAJE_EXTRA_COL_*` navíc jen když `$tableName === '01_caje'`.
- `parseCajeRows(string $csvUtf8, array $colIndices, array $colNames): array` přestává číst globální konstanty přímo, dostává sloupcovou strukturu jako parametr.
- `sheetsUpsertProdukty(PDO $pdo, array $rows, string $tableName, array $colNames): array` — `$cols` uvnitř funkce (dnes `SHEETS_COL_NAMES`) nahrazeno parametrem `$colNames`. Zbytek logiky (UPSERT podle KOD, `V_SHEETU` flag) beze změny.
- `sheetsSyncProdukty` spočítá `columnsForTable($tableName)` a předá dál do `parseCajeRows` a `sheetsUpsertProdukty`.
- Wrappery `sheetsSyncCaje`/`sheetsUpsertCaje` beze změny signatury navenek, uvnitř volají obecné funkce s `'01_caje'`.

Pro nádobí a etnoshop se chování nemění — `columnsForTable('02_nadobi')`/`columnsForTable('03_etnoshop')` vrátí jen základních 14 sloupců, přesně jako dnes.

### Frontend

- `frontend/src/types.ts`: `TeaRow` dostává `NAKUP1?: number | null`, `NAKUP2?: number | null`, `NAKUP3?: number | null`, `NAKUP4?: number | null` (nepovinné — u řádků z `02_nadobi`/`03_etnoshop` chybí).
- `frontend/src/pages/admin/ProduktyAdmin.tsx`: když `produktTyp === 'caje'`, každý blok balení (Standard/Větší/Největší/Čajovna) dostane vedle stávajícího sloupce "Kč" (prodejní cena) nový sloupec "Kč nákup" (`NAKUP1`-`NAKUP4`), stejný `fmt()` formátovací helper jako u ostatních číselných polí. Hlavičkový `colSpan` bloku se zvýší z 2 na 3. U `nadobi`/`etnoshop` zůstává tabulka beze změny (žádný nákupní sloupec, protože data neexistují a struktura bude jiná).

### Beze změny (mimo rozsah)

- `02_nadobi`, `03_etnoshop` — nákupní ceny pro tyto řady jsou samostatný budoucí úkol s jinou sloupcovou strukturou.
- Sloupec V (množství nákupního balení) — neukládá se, není součástí této úpravy.
- Žádný výpočet marže (nákup vs. prodej) — pouze uložení a zobrazení surových dat.

## Testy

- `backend/tools/test_sheets_sync.php`: rozšířit fixture CSV o sloupce W-Z s daty, ověřit `columnsForTable('01_caje')` vrací 18 sloupců včetně `NAKUP1`-`NAKUP4`, `parseCajeRows` s touto strukturou správně naparsuje nákupní ceny; ověřit `columnsForTable('02_nadobi')` vrací jen základních 14 (beze změny oproti dnešku).
- `backend/tools/test_sheets_upsert.php`: rozšířit `mkRow()` helper o volitelné `NAKUP1`-`NAKUP4`, ověřit round-trip (upsert → SELECT) přes `sheetsUpsertCaje`.
- `frontend/src/pages/admin/ProduktyAdmin.test.tsx`: nový test — řádek s `NAKUP1`-`NAKUP4` a `produktTyp="caje"` zobrazí nákupní ceny ve sloupcích "Kč nákup"; existující testy s `produktTyp="nadobi"`/`"etnoshop"` beze změny (žádný nákupní sloupec).
