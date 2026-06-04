# Export / Import kompletní databáze — design

**Datum:** 2026-06-04
**Stav:** návrh ke schválení

## Cíl

Umožnit administrátorovi exportovat kompletní databázi do jednoho ZIP souboru
(CSV na každou tabulku) a selektivně importovat data zpět. Hlavní použití:
přenos kmenových dat (kategorie, čaje, pytlíky) mezi prostředími a havarijní
restore. Tlačítka jsou na stránce **Přehled** (Dashboard).

## Rozsah

- **Export:** všechny tabulky — `users`, `tea_categories`, `teas`, `bags`,
  `sales`, `sale_items` — kompletní 1:1 kopie včetně původních `id` a hashů hesel.
- **Import:** selektivní, `users` se NIKDY neimportuje (pár účtů se řeší ručně
  dle `docs/pass.md`). Importovatelné: Kategorie, Čaje, Pytlíky (default zapnuté),
  Prodeje = `sales` + `sale_items` (default vypnuté, jen restore).

## Architektura

Čistě PHP (přístup A) — žádná závislost na `exec`/`mysqldump`, funguje i na
sdíleném hostingu (Forpsi).

**Soubory:**
- `backend/lib/db_transfer.php` — jádro: funkce pro export a import, sdílené
  mezi HTTP endpointem a ověřovacím CLI skriptem.
- `backend/api/admin.php` — HTTP routing `/api/admin/export` a `/api/admin/import`,
  oba `requireAdmin()`.
- `backend/.htaccess` — `RewriteRule ^api/admin(/.*)?$ api/admin.php`.
- `backend/tools/verify_roundtrip.php` — CLI ověřovací skript (round-trip do
  oddělené DB).
- `frontend/src/api/admin.ts` — `exportDatabase()`, `importDatabase(file, tables)`.
- `frontend/src/pages/admin/Dashboard.tsx` — dvě tlačítka.
- `frontend/src/components/admin/ImportDialog.tsx` — modal importu.

### Pořadí tabulek

Pro determinismus a FK: `users`, `tea_categories`, `teas`, `bags`, `sales`,
`sale_items`. Sloupce každé tabulky se čtou dynamicky z
`INFORMATION_SCHEMA.COLUMNS` (přežije budoucí přidání sloupce).

## Export

`GET /api/admin/export` → `Content-Type: application/zip`,
`Content-Disposition: attachment; filename="cajovna-zaloha-RRRR-MM-DD.zip"`.

Obsah ZIPu (PHP `ZipArchive`):
- `users.csv`, `tea_categories.csv`, `teas.csv`, `bags.csv`, `sales.csv`,
  `sale_items.csv`
- `manifest.json`:
  ```json
  {
    "format_version": 1,
    "exported_at": "2026-06-04 14:32:00",
    "db_name": "f109530",
    "row_counts": { "users": 5, "teas": 294, "sales": 120, ... }
  }
  ```

### Formát CSV

- Oddělovač `;`, UTF-8 s BOM.
- 1. řádek = názvy sloupců přesně dle DB.
- `NULL` → marker `\N`; prázdný řetězec → `""`. Rozlišení je nutné pro 1:1 přesnost
  u nullable sloupců (`note`, `dimensions`, `parent_id`, …).
- Escaping přes `fputcsv` (zvládne `;`, `"`, odřádkování v hodnotě).
- Při serializaci: hodnota `null` z PDO → `\N`. Ostatní → string.

## Import

`POST /api/admin/import` (multipart): pole `file` = ZIP, pole `tables` =
JSON pole vybraných logických skupin, např. `["categories","teas","bags"]`
nebo `["sales"]`. `users` se ignoruje, i kdyby přišlo.

Mapování skupin na tabulky:
- `categories` → `tea_categories`
- `teas` → `teas`
- `bags` → `bags`
- `sales` → `sales` + `sale_items` (vždy spolu, `sale_items` závisí na `sales`)

### Průběh

1. **Rozbalení ZIPu** do dočasné složky (`sys_get_temp_dir()`), načtení
   `manifest.json`.
2. **Validace (před jakýmkoli zápisem):**
   - ZIP obsahuje CSV pro každou vybranou tabulku.
   - Hlavičky sloupců v CSV odpovídají aktuálnímu schématu DB (množina sloupců).
   - Počet datových řádků CSV odpovídá `row_counts` v manifestu (není useknuté).
   - Při nesouladu → `400` + chybová zpráva, **žádná změna dat.**
3. **Transakční nahrazení:**
   ```
   SET FOREIGN_KEY_CHECKS = 0;
   BEGIN;
     -- pro každou vybranou tabulku (v pořadí závislostí):
     DELETE FROM <tabulka>;
     INSERT INTO <tabulka> (<sloupce>) VALUES (...);  -- explicitní id, \N → NULL
   ```
   - `DELETE FROM` (ne `TRUNCATE` — to je DDL a dělá implicitní commit, nešlo by
     rollbacknout).
   - Vkládají se explicitní `id` → zachování 1:1.
4. **Kontrola integrity klíčů (před COMMIT):** ověřit, že žádná FK vazba v celé
   DB není osiřelá (LEFT JOIN … WHERE druhá strana IS NULL, count musí být 0):
   - `teas.category_id` → `tea_categories.id`
   - `sale_items.tea_id` → `teas.id` (nullable)
   - `sale_items.bag_id` → `bags.id` (nullable)
   - `sale_items.sale_id` → `sales.id`
   - `sales.user_id` → `users.id`
   - `tea_categories.parent_id` → `tea_categories.id` (nullable)
   - Při nalezení osiřelé reference → **`ROLLBACK`** + konkrétní chyba
     („`sale_items` odkazuje na neexistující `tea_id` 42").
5. `COMMIT; SET FOREIGN_KEY_CHECKS = 1;`
6. Odpověď: `{ "imported": { "tea_categories": 30, "teas": 294, ... } }`.

Při jakékoli chybě v krocích 3–4 → `ROLLBACK`, DB zůstane přesně jako před importem.

## Bezpečnost a edge cases

- Oba endpointy `requireAdmin()`.
- **Potvrzení v UI:** import je destruktivní → uživatel musí do pole napsat
  `NAHRADIT`; teprve pak je tlačítko aktivní.
- **Self-lockout upozornění:** import nesahá na `users`, takže přihlášení zůstává
  funkční. (Kdyby se v budoucnu měnilo, platí: JWT token je stateless a platí do
  vypršení; záchrana přes `docs/pass.md`.) Text upozornění v dialogu, že prodeje
  restoruj jen když odpovídající `users` v DB existují.
- **Limity:** ZIP se zpracovává v paměti. Pro očekávaný objem (stovky čajů,
  prodeje za měsíce) je to v pořádku. Do nasazení doporučit
  `upload_max_filesize`/`post_max_size` ≥ 16 MB, `memory_limit` ≥ 128 MB.
- Prázdný/neplatný ZIP, chybějící `manifest.json`, neznámé sloupce → `400`,
  nic se nemaže.

## Round-trip ověření (testovací strategie „backup DB")

`backend/tools/verify_roundtrip.php` (spouští se z CLI ručně před nasazením):

1. Export aktuální (zdrojové) DB do dočasného ZIPu přes sdílenou funkci.
2. Vytvoří/vyčistí oddělenou ověřovací DB (název z argumentu, např.
   `f109530_verify`) a aplikuje `db/schema.sql`.
3. Importuje ZIP do ověřovací DB — **všechny tabulky včetně `users`** (plný
   round-trip, ne přes HTTP endpoint, ale přes sdílenou funkci s plným seznamem
   tabulek).
4. Porovná každou tabulku řádek po řádku (`SELECT * ORDER BY id`) mezi zdrojovou
   a ověřovací DB; vypíše `OK` nebo konkrétní rozdíly.
5. Návratový kód 0 = shoda, 1 = rozdíl.

Tím se přesvědčíme, že export+import je věrný 1:1, než to pustíme na ostrá data.

## Testy

- **PHP round-trip (`backend/tools/`):** serializace jedné tabulky do CSV a zpět
  — ověří `\N` (NULL) vs `""` (prázdný string), escaping `;`/`"`/newline.
- **PHP integrace:** export → import do testovací DB → porovnání (jádro
  `verify_roundtrip.php`, spustitelné i jako kontrola).
- **Frontend (vitest):**
  - Dashboard zobrazí tlačítka Export DB / Import DB.
  - ImportDialog: tlačítko Importovat je disabled, dokud není vybraný soubor a
    napsáno `NAHRADIT`; po potvrzení volá `importDatabase` se správným seznamem
    vybraných tabulek; `users` checkbox neexistuje.

## Co je mimo rozsah (YAGNI)

- Import `users` (řeší se ručně).
- Inkrementální/merge import (jen kompletní nahrazení vybraných tabulek).
- Plánované automatické zálohy, šifrování ZIPu, verzování historie záloh.
