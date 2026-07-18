# Nákupní ceny čaje (4 balení) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uložit nákupní cenu čaje pro 4 balení (standart/větší/největší/čajovna) ze sloupců W-Z zdrojového Google Sheetu do `01_caje` a zobrazit ji v admin přehledu čajů.

**Architecture:** 4 nové sloupce `NAKUP1`-`NAKUP4` v `01_caje`, párující se 1:1 s existujícími `CENA1`-`CENA4`. Sync (`backend/lib/sheets_sync.php`) přestává mít jeden globální seznam sloupců sdílený pro `01_caje`/`02_nadobi`/`03_etnoshop` a odvozuje sloupcovou strukturu podle cílové tabulky (`columnsForTable()`) — nákupní sloupce se čtou jen pro `01_caje`. `ProduktyAdmin.tsx` (sdílená komponenta pro Čaje/Nádobí/Etnoshop) zobrazí sloupec "Kč nákup" jen když `produktTyp === 'caje'`.

**Tech Stack:** React 19 + TypeScript, Vitest, PHP 7.4 + PDO MySQL.

## Global Constraints

- Mění se **jen** `01_caje` — `02_nadobi` a `03_etnoshop` se nemění (nákupní ceny pro tyto řady jsou samostatný budoucí úkol s jinou sloupcovou strukturou).
- `NAKUP1`-`NAKUP4` jsou `INT NULL`, stejně jako `CENA1`-`CENA4`.
- Sloupcové indexy ve sheetu (0-based, A=0): W=22, X=23, Y=24, Z=25. Sloupec V (index 21, množství nákupního balení) se neukládá.
- Žádný výpočet marže — jen uložení a zobrazení surových nákupních cen.
- Backend PHP CLI testy se spouští: `docker compose exec -T php php tools/test_sheets_sync.php` a `docker compose exec -T php php tools/test_sheets_upsert.php` (druhý je DB-backed, maže obsah `00_prodej_polozky`/`00_prodej`/`01_caje` v lokální dev DB).
- Frontend testy se spouští `cd frontend && npm run test` (NE `npx vitest` — lokální cache bez jsdom).
- Spec: `docs/superpowers/specs/2026-07-18-nakupni-ceny-caje-design.md`

---

### Task 1: DB migrace — `NAKUP1`-`NAKUP4` v `01_caje`

**Files:**
- Create: `db/migration_2026-07-18_nakupni_ceny_caje.sql`

**Interfaces:**
- Produces: sloupce `01_caje.NAKUP1`, `NAKUP2`, `NAKUP3`, `NAKUP4` (`INT NULL`), umístěné za `CENA4`.

- [ ] **Step 1: Napsat migrační SQL soubor**

Vytvoř `db/migration_2026-07-18_nakupni_ceny_caje.sql`:

```sql
-- Nákupní ceny čaje pro 4 balení (standart/větší/největší/čajovna),
-- párují se 1:1 s CENA1-4. Zdroj: sloupce W-Z Google Sheetu CAJE.
-- Týká se jen 01_caje — 02_nadobi/03_etnoshop se nemění.

ALTER TABLE `01_caje`
  ADD COLUMN `NAKUP1` INT NULL AFTER `CENA4`,
  ADD COLUMN `NAKUP2` INT NULL AFTER `NAKUP1`,
  ADD COLUMN `NAKUP3` INT NULL AFTER `NAKUP2`,
  ADD COLUMN `NAKUP4` INT NULL AFTER `NAKUP3`;
```

- [ ] **Step 2: Spustit migraci na lokální Docker DB**

Run: `docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u root -proot f109530 < db/migration_2026-07-18_nakupni_ceny_caje.sql`

(Pokud `.env` má jiné `DB_NAME`, použij tu hodnotu místo `f109530`.)

Expected: bez chyby.

- [ ] **Step 3: Ověřit výsledek**

Run:
```
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u root -proot f109530 -e "SHOW COLUMNS FROM \`01_caje\` LIKE 'NAKUP%';"
```
Expected: 4 řádky — `NAKUP1`, `NAKUP2`, `NAKUP3`, `NAKUP4`, typ `int(11)`, `Null = YES`.

- [ ] **Step 4: Commit**

```bash
git add db/migration_2026-07-18_nakupni_ceny_caje.sql
git commit -m "feat(db): sloupce NAKUP1-4 (nákupní ceny čaje) v 01_caje"
```

**Poznámka pro později:** stejnou migraci je nutné spustit i na sdílené testovaci/produkční DB (Forpsi) přes phpMyAdmin, stejně jako předchozí migrace — součást budoucího "překlopení na produkci" tasku.

---

### Task 2: Backend — sync per-tabulka sloupcová struktura + nákupní ceny

**Files:**
- Modify: `backend/lib/sheets_sync.php`
- Test: `backend/tools/test_sheets_sync.php`
- Test: `backend/tools/test_sheets_upsert.php`

**Interfaces:**
- Consumes: `PRODUKT_TABULKY` (`backend/lib/produkt_typy.php`, beze změny), `dbtToUtf8` (beze změny).
- Produces: `columnsForTable(string $tableName): array` vrací `[$colIndices, $colNames]` — 14 základních sloupců pro všechny tabulky, `01_caje` navíc dostává `NAKUP1`-`NAKUP4` (indexy 22-25). `parseCajeRows(string $csvUtf8, array $colIndices, array $colNames): array` (signatura změněna — dřív brala jen `$csvUtf8`). `sheetsUpsertProdukty(PDO $pdo, array $rows, string $tableName, array $colNames): array` (signatura změněna — přibyl `$colNames`). `sheetsSyncProdukty`, `sheetsSyncCaje`, `sheetsUpsertCaje` mají navenek stejnou signaturu jako dnes (interní přepočet sloupců je skrytý).

- [ ] **Step 1: Rozšířit oba testy o nákupní ceny (červený stav)**

Nahraď celý obsah `backend/tools/test_sheets_sync.php`:

```php
<?php
require_once __DIR__ . '/../lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// Sloupce A-Z (0-based, 26 sloupců). CAJE bere 0,1,2,3,4,5,6,7,10,11,14,15,18,19
// + nákupní ceny 22,23,24,25 (W-Z). NADOBI/ETNOSHOP berou jen prvních 14.
function makeCsvLine(array $vals, int $totalCols = 26): string {
    $padded = array_pad($vals, $totalCols, '');
    return implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $padded));
}

$header1 = makeCsvLine(['','','','','','','Standart','','','','Větší','','','','Největší','','','','V čajovně','','','','Nákup std','Nákup větší','Nákup největší','Nákup čajovna']);
$header2 = makeCsvLine(['KATEGORIE','ZEME','AKTIV','KOD','NAZEV','POZNAMKA','MN1','CENA1','','','MN2','CENA2','','','MN3','CENA3','','','MN4','CENA4','','','NAKUP1','NAKUP2','NAKUP3','NAKUP4']);

// Řádek 3: plný řádek, vč. nákupních cen W-Z
$data1 = makeCsvLine(['BÍLÝ','ČÍNA','x','2606-C-BILY-TAWN-01','Show Mee','','30','130','','','200','700','','','500','1680','','','7','98','','','90','480','1150','65']);
// Řádek 4: prázdný → přeskočit
$data2 = makeCsvLine([]);
// Řádek 5: aktivní=prázdné (neaktivní), bez nákupních cen
$data3 = makeCsvLine(['ZELENÉ','JAPONSKO','','2606-C-ZELE-JAPO-01','Gyokuro','Poznámka test','40','200','','','200','800','','','','','','','20','150']);
// Řádek 6: bez KATEGORIE → přeskočit
$data4 = makeCsvLine(['','','x','2606-C-XXXX-XXXX-01','Bez kategorie','','30','130']);
// Řádek 7: bez KOD → přeskočit
$data5 = makeCsvLine(['BÍLÝ','ČÍNA','x','','Bez kódu','','30','130']);

$csv = implode("\n", [$header1, $header2, $data1, $data2, $data3, $data4, $data5]);

// --- columnsForTable ---
[$colIndices, $colNames] = columnsForTable('01_caje');
ok('columnsForTable(01_caje) vrací 18 sloupců (14 základních + 4 nákupní)', count($colNames) === 18);
ok('columnsForTable(01_caje) obsahuje NAKUP1-4 na konci',
   array_slice($colNames, -4) === ['NAKUP1', 'NAKUP2', 'NAKUP3', 'NAKUP4']);
ok('columnsForTable(01_caje) indexy W-Z = 22,23,24,25',
   array_slice($colIndices, -4) === [22, 23, 24, 25]);

[$colIndicesNadobi, $colNamesNadobi] = columnsForTable('02_nadobi');
ok('columnsForTable(02_nadobi) vrací jen 14 základních sloupců (beze změny)', count($colNamesNadobi) === 14);
ok('columnsForTable(02_nadobi) neobsahuje NAKUP sloupce', !in_array('NAKUP1', $colNamesNadobi, true));

// --- parseCajeRows s nákupními cenami ---
[$rows] = parseCajeRows($csv, $colIndices, $colNames);

ok('parsuje 2 řádky (bez NAZEV/KATEGORIE/KOD přeskočeny)', count($rows) === 2);

$r1 = $rows[0];
ok('KATEGORIE = BÍLÝ',                 $r1['KATEGORIE'] === 'BÍLÝ');
ok('ZEME = ČÍNA',                      $r1['ZEME'] === 'ČÍNA');
ok('AKTIV = x',                        $r1['AKTIV'] === 'x');
ok('KOD = 2606-C-BILY-TAWN-01 (sl. D)', $r1['KOD'] === '2606-C-BILY-TAWN-01');
ok('NAZEV = Show Mee (sloupec E)',     $r1['NAZEV'] === 'Show Mee');
ok('POZNAMKA = null',                  $r1['POZNAMKA'] === null);
ok('MN1 = 30 (sloupec G)',             $r1['MN1'] === '30');
ok('CENA1 = 130 (sloupec H)',          $r1['CENA1'] === '130');
ok('MN2 = 200 (sloupec K)',            $r1['MN2'] === '200');
ok('CENA2 = 700 (sloupec L)',          $r1['CENA2'] === '700');
ok('MN3 = 500 (sloupec O)',            $r1['MN3'] === '500');
ok('CENA3 = 1680 (sloupec P)',         $r1['CENA3'] === '1680');
ok('MN4 = 7 (sloupec S)',              $r1['MN4'] === '7');
ok('CENA4 = 98 (sloupec T)',           $r1['CENA4'] === '98');
ok('NAKUP1 = 90 (sloupec W)',          $r1['NAKUP1'] === '90');
ok('NAKUP2 = 480 (sloupec X)',         $r1['NAKUP2'] === '480');
ok('NAKUP3 = 1150 (sloupec Y)',        $r1['NAKUP3'] === '1150');
ok('NAKUP4 = 65 (sloupec Z)',          $r1['NAKUP4'] === '65');

$r2 = $rows[1];
ok('řádek 2 KOD = 2606-C-ZELE-JAPO-01',        $r2['KOD'] === '2606-C-ZELE-JAPO-01');
ok('řádek 2 NAZEV = Gyokuro',                  $r2['NAZEV'] === 'Gyokuro');
ok('řádek 2 AKTIV = null (neaktivní)',         $r2['AKTIV'] === null);
ok('řádek 2 POZNAMKA = Poznámka test',         $r2['POZNAMKA'] === 'Poznámka test');
ok('řádek 2 MN3 = null (prázdné)',             $r2['MN3'] === null);
ok('řádek 2 NAKUP1 = null (chybí ve zdroji)',  $r2['NAKUP1'] === null);

// --- assertUniqueKod ---
try {
    assertUniqueKod($rows);
    ok('unikátní kódy projdou bez výjimky', true);
} catch (RuntimeException $e) {
    ok('unikátní kódy projdou bez výjimky', false);
}

$dup = array_merge($rows, [$rows[0]]);
try {
    assertUniqueKod($dup);
    ok('duplicitní KOD hodí výjimku', false);
} catch (RuntimeException $e) {
    ok('duplicitní KOD hodí výjimku', true);
    ok('hláška obsahuje duplicitní kód', strpos($e->getMessage(), '2606-C-BILY-TAWN-01') !== false);
}

$caseDup = $rows;
$caseDup[1]['KOD'] = strtolower($rows[0]['KOD']);
try {
    assertUniqueKod($caseDup);
    ok('KOD lišící se jen velikostí písmen hodí výjimku (DB kolace je case-insensitive)', false);
} catch (RuntimeException $e) {
    ok('KOD lišící se jen velikostí písmen hodí výjimku (DB kolace je case-insensitive)', true);
}

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
```

V `backend/tools/test_sheets_upsert.php` nahraď funkci `mkRow` (řádky 14-19):

```php
function mkRow(string $kod, string $nazev, string $cena1, array $nakup = []): array {
    return array_merge([
        'KATEGORIE' => 'BÍLÝ', 'ZEME' => 'ČÍNA', 'AKTIV' => 'x', 'KOD' => $kod,
        'NAZEV' => $nazev, 'POZNAMKA' => null, 'MN1' => '30', 'CENA1' => $cena1,
        'MN2' => null, 'CENA2' => null, 'MN3' => null, 'CENA3' => null,
        'MN4' => null, 'CENA4' => null,
        'NAKUP1' => null, 'NAKUP2' => null, 'NAKUP3' => null, 'NAKUP4' => null,
    ], $nakup);
}
```

A vlož nový testovací blok mezi „--- 4. prázdný vstup ---" sekci a finální `echo "\n$PASS passed..."` řádek (tj. na konec souboru, před posledními dvěma řádky):

```php
// --- 5. nákupní ceny (NAKUP1-4) se uloží a čtou zpět ---
$pdo->exec('DELETE FROM `01_caje`');
$res = sheetsUpsertCaje($pdo, [
    mkRow('2608-C-BILY-TAWN-03', 'Da Bai', '140', [
        'NAKUP1' => '80', 'NAKUP2' => '400', 'NAKUP3' => '950', 'NAKUP4' => '60',
    ]),
]);
ok('5. sync: synced = 1', $res['synced'] === 1);

$rowNakup = $pdo->query(
    "SELECT NAKUP1, NAKUP2, NAKUP3, NAKUP4 FROM `01_caje` WHERE KOD = '2608-C-BILY-TAWN-03'"
)->fetch(PDO::FETCH_ASSOC);
ok('5. sync: NAKUP1 = 80',  (int) $rowNakup['NAKUP1'] === 80);
ok('5. sync: NAKUP2 = 400', (int) $rowNakup['NAKUP2'] === 400);
ok('5. sync: NAKUP3 = 950', (int) $rowNakup['NAKUP3'] === 950);
ok('5. sync: NAKUP4 = 60',  (int) $rowNakup['NAKUP4'] === 60);
```

- [ ] **Step 2: Spustit oba testy a ověřit, že selžou**

Run: `docker compose exec -T php php tools/test_sheets_sync.php`
Expected: fatal error `Call to undefined function columnsForTable()` (funkce ještě neexistuje) — test se zastaví, nedoběhne do konce.

Run: `docker compose exec -T php php tools/test_sheets_upsert.php`
Expected: `FAIL: 5. sync: NAKUP1 = 80` a další 3 `FAIL` na nákupní ceny (stará `sheetsUpsertCaje` nákupní ceny ještě neukládá — nejsou ve starém `SHEETS_COL_NAMES`), zbytek `PASS`.

- [ ] **Step 3: Implementovat `columnsForTable` a přepojit parse/upsert na per-tabulkovou strukturu**

Nahraď celý obsah `backend/lib/sheets_sync.php`:

```php
<?php
// Sync produktových záložek z Google Sheets → tabulky 01_caje / 02_nadobi / 03_etnoshop.
require_once __DIR__ . '/db_transfer.php';
require_once __DIR__ . '/produkt_typy.php';

// Indexy sloupců v sheetu, které bereme (0-based, A=0). D = KOD (od 2026-07).
const SHEETS_COL_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 14, 15, 18, 19];
const SHEETS_COL_NAMES   = ['KATEGORIE', 'ZEME', 'AKTIV', 'KOD', 'NAZEV', 'POZNAMKA',
                             'MN1', 'CENA1', 'MN2', 'CENA2', 'MN3', 'CENA3', 'MN4', 'CENA4'];

// Nákupní ceny (jen 01_caje) — sloupce W,X,Y,Z. Sloupec V (nákupní množství,
// index 21) se neukládá; U (index 20) je mezera stejně jako u ostatních bloků.
const CAJE_EXTRA_COL_INDICES = [22, 23, 24, 25];
const CAJE_EXTRA_COL_NAMES   = ['NAKUP1', 'NAKUP2', 'NAKUP3', 'NAKUP4'];

/**
 * Vrátí [colIndices, colNames] pro danou tabulku. Základních 14 sloupců je
 * shodných napříč 01_caje/02_nadobi/03_etnoshop, nákupní ceny (W-Z) existují
 * jen ve sloupcích 01_caje.
 */
function columnsForTable(string $tableName): array {
    $indices = SHEETS_COL_INDICES;
    $names   = SHEETS_COL_NAMES;
    if ($tableName === '01_caje') {
        $indices = array_merge($indices, CAJE_EXTRA_COL_INDICES);
        $names   = array_merge($names, CAJE_EXTRA_COL_NAMES);
    }
    return [$indices, $names];
}

/**
 * Stáhne CSV ze zadané URL. Při chybě hodí RuntimeException.
 */
function sheetsFetchCsv(string $url): string {
    $ctx = stream_context_create(['http' => [
        'timeout'         => 15,
        'follow_location' => true,
        'max_redirects'   => 5,
        'user_agent'      => 'CajovnaSync/1.0',
    ]]);
    $content = @file_get_contents($url, false, $ctx);
    if ($content === false) {
        throw new RuntimeException('Nepodařilo se stáhnout CSV ze Sheets: ' . $url);
    }
    return $content;
}

/**
 * Hlavní sync pro libovolnou produktovou řadu: stáhne CSV, parsuje,
 * ověří unikátnost KOD, upsertuje do zadané tabulky.
 * Vrací ['synced' => N, 'vyrazeno' => M].
 */
function sheetsSyncProdukty(PDO $pdo, string $csvUrl, string $tableName): array {
    $raw = sheetsFetchCsv($csvUrl);
    $utf = dbtToUtf8($raw);

    [$colIndices, $colNames] = columnsForTable($tableName);
    [$rows] = parseCajeRows($utf, $colIndices, $colNames);
    assertUniqueKod($rows);

    return sheetsUpsertProdukty($pdo, $rows, $tableName, $colNames);
}

/** Zpětně kompatibilní wrapper pro čaje. */
function sheetsSyncCaje(PDO $pdo, string $csvUrl): array {
    return sheetsSyncProdukty($pdo, $csvUrl, '01_caje');
}

/**
 * Parsuje CSV string produktové záložky (CAJE/NADOBI/ETNOSHOP).
 * Řádek 1 = zobrazovací hlavička (přeskočit).
 * Řádek 2 = DB názvy sloupců (přeskočit).
 * Řádky 3+ = data.
 * $colIndices/$colNames si musí pozičně odpovídat (viz columnsForTable()).
 * Vrací [rows] kde každý row je asociativní pole dle $colNames.
 */
function parseCajeRows(string $csvUtf8, array $colIndices, array $colNames): array {
    $fh = fopen('php://temp', 'r+');
    fwrite($fh, $csvUtf8);
    rewind($fh);

    // Strip BOM
    $first = fread($fh, 3);
    if ($first !== "\xEF\xBB\xBF") {
        rewind($fh);
    }

    $lineNum = 0;
    $rows    = [];

    while (($line = fgetcsv($fh, 0, ',', '"')) !== false) {
        $lineNum++;
        if ($lineNum <= 2) continue; // přeskočit hlavičkové řádky
        if ($line === [null])        continue; // prázdný řádek

        $row = [];
        foreach ($colIndices as $i => $colIdx) {
            $colName = $colNames[$i];
            $val     = isset($line[$colIdx]) ? trim($line[$colIdx]) : '';
            $row[$colName] = $val === '' ? null : $val;
        }
        // Přeskočit řádky bez kategorie nebo bez názvu
        if ($row['KATEGORIE'] === null) continue;
        if ($row['NAZEV'] === null) continue;
        if ($row['KOD'] === null) continue;

        $rows[] = $row;
    }
    fclose($fh);
    return [$rows];
}

/**
 * Ověří unikátnost KOD napříč parsovanými řádky.
 * Duplicita = chyba dat v sheetu → RuntimeException (sync se nesmí provést).
 */
function assertUniqueKod(array $rows): void {
    $seen = [];
    foreach ($rows as $row) {
        $kod = $row['KOD'];
        $kodNormalized = mb_strtoupper($kod);
        if (isset($seen[$kodNormalized])) {
            throw new RuntimeException('Duplicitní KOD v sheetu: ' . $kod);
        }
        $seen[$kodNormalized] = true;
    }
}

/**
 * Upsert řádků do zadané tabulky podle KOD (UNIQUE klíč uq_kod).
 * Řádky chybějící v $rows zůstanou v DB s V_SHEETU = 0 (vyřazené ze sheetu).
 * Nikdy nemaže.
 * Vrací ['synced' => počet řádků v sheetu, 'vyrazeno' => počet V_SHEETU = 0 po syncu].
 */
function sheetsUpsertProdukty(PDO $pdo, array $rows, string $tableName, array $colNames): array {
    if (!in_array($tableName, PRODUKT_TABULKY, true)) {
        throw new InvalidArgumentException('Neznámá tabulka pro sync: ' . $tableName);
    }
    if (empty($rows)) {
        throw new RuntimeException('Sheet neobsahuje žádné platné řádky — sync přerušen.');
    }

    $pdo->beginTransaction();
    try {
        $pdo->exec("UPDATE `$tableName` SET V_SHEETU = 0");

        $cols     = $colNames;
        $dataCols = array_values(array_diff($cols, ['KOD']));
        $sql = "INSERT INTO `$tableName` (`" . implode('`,`', $cols) . '`, `V_SHEETU`)'
             . ' VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ', 1)'
             . ' ON DUPLICATE KEY UPDATE '
             . implode(', ', array_map(fn($c) => "`$c` = VALUES(`$c`)", $dataCols))
             . ', `V_SHEETU` = 1';
        $stmt = $pdo->prepare($sql);
        foreach ($rows as $row) {
            $stmt->execute(array_map(fn($c) => $row[$c] ?? null, $cols));
        }

        $vyrazeno = (int) $pdo->query("SELECT COUNT(*) FROM `$tableName` WHERE V_SHEETU = 0")->fetchColumn();

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return ['synced' => count($rows), 'vyrazeno' => $vyrazeno];
}

/** Zpětně kompatibilní wrapper pro čaje. */
function sheetsUpsertCaje(PDO $pdo, array $rows): array {
    return sheetsUpsertProdukty($pdo, $rows, '01_caje', columnsForTable('01_caje')[1]);
}
```

- [ ] **Step 4: Spustit oba testy znovu a ověřit, že projdou**

Run: `docker compose exec -T php php tools/test_sheets_sync.php`
Expected: `34 passed, 0 failed` (30 původních + 4 nové assertions na `columnsForTable`/`NAKUP*`; přesný počet ověř v konzolovém výstupu, ale `0 failed` je podmínka).

Run: `docker compose exec -T php php tools/test_sheets_upsert.php`
Expected: `0 failed`, včetně `PASS: 5. sync: NAKUP1 = 80` a zbylých tří nákupních assertions.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/sheets_sync.php backend/tools/test_sheets_sync.php backend/tools/test_sheets_upsert.php
git commit -m "feat(sync): per-tabulková sloupcová struktura, nákupní ceny NAKUP1-4 pro 01_caje"
```

---

### Task 3: Frontend — `TeaRow` typ + zobrazení nákupních cen v `ProduktyAdmin`

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/admin/ProduktyAdmin.tsx`
- Test: `frontend/src/pages/admin/ProduktyAdmin.test.tsx`

**Interfaces:**
- Consumes: `TeaRow` (Task 3, Step 1), `getProdukty(produktTyp: ProduktTyp)` (beze změny).
- Produces: `TeaRow.NAKUP1`-`NAKUP4?: number | null`. `ProduktyAdmin` zobrazuje sloupec "Kč nákup" jen pro `produktTyp === 'caje'`.

- [ ] **Step 1: Rozšířit `TeaRow` a napsat 2 nové testy (červený stav)**

V `frontend/src/types.ts` nahraď blok `TeaRow` (řádky 67-84):

```ts
export interface TeaRow {
  id: number
  KOD: string
  V_SHEETU?: number
  KATEGORIE: string | null
  ZEME: string | null
  AKTIV: string | null
  NAZEV: string | null
  POZNAMKA: string | null
  MN1: number | null
  CENA1: number | null
  MN2: number | null
  CENA2: number | null
  MN3: number | null
  CENA3: number | null
  MN4: number | null
  CENA4: number | null
  /** Nákupní ceny — jen u řádků z 01_caje, chybí u nadobi/etnoshop. */
  NAKUP1?: number | null
  NAKUP2?: number | null
  NAKUP3?: number | null
  NAKUP4?: number | null
}
```

V `frontend/src/pages/admin/ProduktyAdmin.test.tsx` přidej na konec `describe('ProduktyAdmin', () => { ... })` bloku (za poslední `it(...)`, před uzavírací `})`):

```tsx
  it('zobrazí sloupec "Kč nákup" a hodnoty NAKUP1-4 jen pro produktTyp="caje"', async () => {
    const rowWithNakup: TeaRow = {
      ...ROW,
      NAKUP1: 90, NAKUP2: null, NAKUP3: null, NAKUP4: null,
    }
    vi.mocked(teasApi.getProdukty).mockResolvedValue([rowWithNakup])
    renderWithToast(<ProduktyAdmin produktTyp="caje" nadpis="Čaje" />)
    await screen.findByText('Hrnek modrý')
    expect(screen.getAllByText('Kč nákup')).toHaveLength(4)
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('nezobrazí sloupec "Kč nákup" pro nadobi/etnoshop', async () => {
    renderWithToast(<ProduktyAdmin produktTyp="nadobi" nadpis="Nádobí" />)
    await screen.findByText('Hrnek modrý')
    expect(screen.queryByText('Kč nákup')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Spustit testy a ověřit, že nové 2 selžou**

Run: `cd frontend && npm run test -- ProduktyAdmin`
Expected: 3 původní testy PASS, 2 nové testy FAIL (`Unable to find an element with the text: Kč nákup` a hodnota `90` nenalezena — komponenta ještě nákupní sloupec nezobrazuje).

- [ ] **Step 3: Implementovat zobrazení nákupních cen v `ProduktyAdmin.tsx`**

Nahraď celý obsah `frontend/src/pages/admin/ProduktyAdmin.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { getProdukty } from '../../api/teas'
import type { TeaRow, ProduktTyp } from '../../types'
import { useToast } from '../../components/toast/useToast'
import { syncFromSheets } from '../../api/admin'
import styles from './Items.module.css'
import gridStyles from '../../components/admin/EditableGrid.module.css'

interface Props {
  produktTyp: ProduktTyp
  nadpis: string
}

export default function ProduktyAdmin({ produktTyp, nadpis }: Props) {
  const [rows, setRows] = useState<TeaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [kategorieFilter, setKategorieFilter] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getProdukty(produktTyp))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast, produktTyp])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncFromSheets(produktTyp)
      toast.success(`Sync hotový — ${result.synced} položek (${result.vyrazeno} vyřazeno)`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync se nezdařil')
    } finally {
      setSyncing(false)
    }
  }

  const categories = Array.from(new Set(rows.map((r) => r.KATEGORIE).filter(Boolean))) as string[]
  categories.sort()

  const nameQuery = nameFilter.trim().toLowerCase()
  const visible = rows
    .filter((r) => showInactive ? r.AKTIV !== 'x' : r.AKTIV === 'x')
    .filter((r) => kategorieFilter === null || r.KATEGORIE === kategorieFilter)
    .filter((r) => nameQuery === '' || (r.NAZEV ?? '').toLowerCase().includes(nameQuery))

  const fmt = (v: number | null | undefined) => (v == null ? '' : String(v))
  const showNakup = produktTyp === 'caje'
  const priceBorderStyle = showNakup ? undefined : { borderRight: '2px solid #444' }
  const nakupBorderStyle = { borderRight: '2px solid #444' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{nadpis} — import ze Sheets</h1>
        <input
          className={styles.nameFilter}
          placeholder="Hledat název…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
        />
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setKategorieFilter(null) }}
          />
          Zobrazit neaktivní
        </label>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{ marginLeft: 'auto', padding: '6px 14px', background: '#4a90d9', color: '#fff',
                   border: 'none', borderRadius: 4, cursor: syncing ? 'not-allowed' : 'pointer',
                   opacity: syncing ? 0.6 : 1, fontSize: '0.9rem' }}
        >
          {syncing ? 'Synchronizuji…' : '↻ Sync ze Sheets'}
        </button>
        <span style={{ color: '#666', fontSize: '0.85rem' }}>
          {visible.length} záznamů
        </span>
      </div>

      {categories.length > 0 && (
        <div className={styles.filterSection}>
          <span className={styles.filterLabel}>Kategorie</span>
          <div className={styles.filterGrid}>
            <button
              className={`${styles.filterBtn} ${kategorieFilter === null ? styles.filterActive : ''}`}
              onClick={() => setKategorieFilter(null)}
            >
              Vše
            </button>
            {categories.map((k) => (
              <button
                key={k}
                className={`${styles.filterBtn} ${kategorieFilter === k ? styles.filterActive : ''}`}
                onClick={() => setKategorieFilter(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Načítám…</div>
        ) : visible.length === 0 ? (
          <div className={styles.empty}>
            {rows.length === 0 ? 'Tabulka je prázdná — data se načtou po synchronizaci ze Sheets.' : 'Žádné záznamy.'}
          </div>
        ) : (
          <table className={gridStyles.table}>
            <thead>
              <tr>
                <th colSpan={6} style={{ borderRight: '2px solid #444' }}>Základní info</th>
                <th colSpan={showNakup ? 3 : 2} style={{ borderRight: '2px solid #444' }}>Standard</th>
                <th colSpan={showNakup ? 3 : 2} style={{ borderRight: '2px solid #444' }}>Větší</th>
                <th colSpan={showNakup ? 3 : 2} style={{ borderRight: '2px solid #444' }}>Největší</th>
                <th colSpan={showNakup ? 3 : 2}>Čajovna</th>
              </tr>
              <tr>
                <th>Kód</th>
                <th>Kategorie</th>
                <th>Země</th>
                <th>Aktiv</th>
                <th>Název</th>
                <th style={{ borderRight: '2px solid #444' }}>Poznámka</th>
                <th>g</th>
                <th style={priceBorderStyle}>Kč</th>
                {showNakup && <th style={nakupBorderStyle}>Kč nákup</th>}
                <th>g</th>
                <th style={priceBorderStyle}>Kč</th>
                {showNakup && <th style={nakupBorderStyle}>Kč nákup</th>}
                <th>g</th>
                <th style={priceBorderStyle}>Kč</th>
                {showNakup && <th style={nakupBorderStyle}>Kč nákup</th>}
                <th>g</th>
                <th>Kč</th>
                {showNakup && <th>Kč nákup</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.AKTIV !== 'x' ? styles.rowInactive : undefined}>
                  <td>{r.KOD}</td>
                  <td>{r.KATEGORIE}</td>
                  <td>{r.ZEME}</td>
                  <td>{r.AKTIV}</td>
                  <td>{r.NAZEV}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{r.POZNAMKA}</td>
                  <td>{fmt(r.MN1)}</td>
                  <td style={priceBorderStyle}>{fmt(r.CENA1)}</td>
                  {showNakup && <td style={nakupBorderStyle}>{fmt(r.NAKUP1)}</td>}
                  <td>{fmt(r.MN2)}</td>
                  <td style={priceBorderStyle}>{fmt(r.CENA2)}</td>
                  {showNakup && <td style={nakupBorderStyle}>{fmt(r.NAKUP2)}</td>}
                  <td>{fmt(r.MN3)}</td>
                  <td style={priceBorderStyle}>{fmt(r.CENA3)}</td>
                  {showNakup && <td style={nakupBorderStyle}>{fmt(r.NAKUP3)}</td>}
                  <td>{fmt(r.MN4)}</td>
                  <td>{fmt(r.CENA4)}</td>
                  {showNakup && <td>{fmt(r.NAKUP4)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Spustit testy znovu a ověřit, že všech 5 projde**

Run: `cd frontend && npm run test -- ProduktyAdmin`
Expected: `5 passed`.

- [ ] **Step 5: Spustit celou frontend test suitu a typecheck**

Run: `cd frontend && npm run test`
Expected: všechny testy PASS (žádná regrese mimo `ProduktyAdmin`).

Run: `cd frontend && npx tsc -b`
Expected: bez chyby (čistý typecheck).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/pages/admin/ProduktyAdmin.tsx frontend/src/pages/admin/ProduktyAdmin.test.tsx
git commit -m "feat(admin): zobrazit nákupní ceny čaje (Kč nákup) v ProduktyAdmin"
```
