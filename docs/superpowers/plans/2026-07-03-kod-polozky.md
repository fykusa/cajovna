# KOD položky jako business klíč — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sloupec D sheetu (jednoznačný KOD položky) se stane business klíčem `01_caje`; sync přejde z TRUNCATE na UPSERT, prodeje odkazují `caje_kod` s FK.

**Architecture:** DB migrace přidá `KOD` (UNIQUE) + `V_SHEETU` do `01_caje` a `caje_kod` s FK do `00_prodej_polozky`. Sync (`sheets_sync.php`) parsuje posunuté sloupce a upsertuje podle KOD; položky chybějící v sheetu zůstávají s `V_SHEETU = 0`. API a frontend přecházejí z `caje_id` (int) na `caje_kod` (string).

**Tech Stack:** PHP 7.4 (docker `php` service), MySQL 5.7 (docker `mysql` service), React + TypeScript + Vitest (`frontend/`).

**Spec:** `docs/superpowers/specs/2026-07-03-kod-polozky-design.md`

## Global Constraints

- MySQL 5.7 — `ON DUPLICATE KEY UPDATE` s `VALUES()` syntaxí (ne novější aliasy).
- PHP 7.4 — žádné PHP 8 syntaxe (match, named args…); arrow fn `fn()` OK.
- Frontend testy: spouštět `npm run test` v `frontend/` (lokální vitest s jsdom), NIKDY `npx vitest`.
- Mocky v testech: statický import + `vi.mock()` na začátku souboru (viz stávající `useCajovnaPOS.test.ts`).
- PHP CLI testy: `docker compose exec -T php php tools/<test>.php` z rootu repa.
- Formát KOD: volný `VARCHAR(32)`, např. `2606-C-BILY-TAWN-01`. Nevalidovat pattern, jen přítomnost a unikátnost.
- Komunikace/commity česky, konvence `feat(kasa):`-style prefixy dle git logu.
- Commity provádět po každém tasku (uživatel dal pro tento plán souhlas s commitem per task — pokud ne, před commitem se zeptat).

---

### Task 1: Oprava zastaralého testu (červený baseline)

Na masteru padá 1 test: commit `fb96d09` odstranil success screen po checkoutu (view jde rovnou na `home`), ale test v `useCajovnaPOS.test.ts` stále čeká `'success'`. Bez zelené baseline nelze dělat TDD.

**Files:**
- Modify: `frontend/src/hooks/useCajovnaPOS.test.ts:152-168`

**Interfaces:**
- Consumes: `useCajovnaPOS().confirmCheckout()` — po úspěchu volá `newSale()` → view `'home'`.
- Produces: zelený baseline pro všechny další tasky.

- [ ] **Step 1: Oprava očekávání v testu**

V `frontend/src/hooks/useCajovnaPOS.test.ts` změnit:

```ts
  test('confirmCheckout → volá createCajovnaSale, vymaže košík, vrátí na home', async () => {
```
(původní název: `'confirmCheckout → volá createCajovnaSale, přejde na success, vymaže košík'`)

a řádek 165:

```ts
    expect(result.current.view).toBe('home')
```
(původně `.toBe('success')`)

- [ ] **Step 2: Ověřit zelený běh souboru**

Run: `cd frontend && npm run test -- --run src/hooks/useCajovnaPOS.test.ts`
Expected: `17 passed (17)`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useCajovnaPOS.test.ts
git commit -m "test(cajovna): opravit zastaralé očekávání view po checkoutu (fb96d09 zrušil success screen)"
```

---

### Task 2: DB migrace — KOD, V_SHEETU, caje_kod + FK

**Files:**
- Create: `db/migration_2026-07-03_kod_polozky.sql`

**Interfaces:**
- Produces: `01_caje.KOD VARCHAR(32) NOT NULL` (UNIQUE `uq_kod`), `01_caje.V_SHEETU TINYINT(1) NOT NULL DEFAULT 1`, `00_prodej_polozky.caje_kod VARCHAR(32) NOT NULL` s FK `fk_polozky_kod` → `01_caje(KOD)`. Sloupec `caje_id` už neexistuje.

- [ ] **Step 1: Vytvořit migrační soubor**

`db/migration_2026-07-03_kod_polozky.sql`:

```sql
-- KOD položky jako business klíč číselníku čajů.
-- 01_caje: sync tabulka — data doteče z prvního syncu po nasazení.
-- 00_prodej_polozky: obsahuje jen test data, reálné prodeje neexistují.
-- Pořadí: TRUNCATE 01_caje musí proběhnout dřív, než na ni vznikne FK.
-- TRUNCATE nelze na 00_prodej (míří na ni FK z položek) → DELETE + reset AI.

TRUNCATE TABLE `01_caje`;
ALTER TABLE `01_caje`
  ADD COLUMN `KOD` VARCHAR(32) NOT NULL AFTER `id`,
  ADD COLUMN `V_SHEETU` TINYINT(1) NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uq_kod` (`KOD`);

TRUNCATE TABLE `00_prodej_polozky`;
DELETE FROM `00_prodej`;
ALTER TABLE `00_prodej` AUTO_INCREMENT = 1;

ALTER TABLE `00_prodej_polozky`
  DROP COLUMN `caje_id`,
  ADD COLUMN `caje_kod` VARCHAR(32) NOT NULL AFTER `prodej_id`,
  ADD CONSTRAINT `fk_polozky_kod` FOREIGN KEY (`caje_kod`) REFERENCES `01_caje`(`KOD`);
```

- [ ] **Step 2: Aplikovat na lokální DB**

Run (PowerShell, root repa):
```powershell
Get-Content db\migration_2026-07-03_kod_polozky.sql -Raw | docker compose exec -T mysql mysql -ucajovna -pcajovna cajovna
```
Expected: žádný výstup (bez chyby). Pozn.: jednosloupcový index na `caje_id` MySQL odstraní automaticky spolu se sloupcem; kdyby ALTER přesto selhal na indexu, přidat `DROP INDEX caje_id,` před `DROP COLUMN`.

- [ ] **Step 3: Ověřit schéma**

Run:
```powershell
docker compose exec -T mysql mysql -ucajovna -pcajovna cajovna -e "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='cajovna' AND TABLE_NAME IN ('01_caje','00_prodej_polozky') ORDER BY TABLE_NAME, ORDINAL_POSITION; SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='cajovna' AND TABLE_NAME='00_prodej_polozky' AND REFERENCED_TABLE_NAME IS NOT NULL;"
```
Expected: `01_caje` má `KOD varchar(32)` a `V_SHEETU tinyint(1)`; `00_prodej_polozky` má `caje_kod varchar(32)` a NEMÁ `caje_id`; FK `fk_polozky_kod` → `01_caje`.

- [ ] **Step 4: Commit**

```bash
git add db/migration_2026-07-03_kod_polozky.sql
git commit -m "feat(db): migrace KOD + V_SHEETU v 01_caje, caje_kod s FK v prodej polozkach"
```

---

### Task 3: Sync parse — posunuté sloupce, KOD, kontrola duplicit (TDD)

**Files:**
- Modify: `backend/lib/sheets_sync.php` (konstanty, `parseCajeRows`, nová `assertUniqueKod`)
- Test: `backend/tools/test_sheets_sync.php` (přepsat na nové rozložení)

**Interfaces:**
- Consumes: nic z předchozích tasků (čisté funkce bez DB).
- Produces: `parseCajeRows(string $csvUtf8): array` — vrací `[$rows]`, každý row má klíče `KATEGORIE, ZEME, AKTIV, KOD, NAZEV, POZNAMKA, MN1, CENA1, MN2, CENA2, MN3, CENA3, MN4, CENA4` (stringy nebo null); řádky bez KATEGORIE/NAZEV/KOD přeskočeny. `assertUniqueKod(array $rows): void` — hodí `RuntimeException` s textem obsahujícím duplicitní kód.

- [ ] **Step 1: Přepsat CLI test na nové rozložení sloupců**

Celý nový obsah `backend/tools/test_sheets_sync.php`:

```php
<?php
require_once __DIR__ . '/../lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// Sloupce A-T (0-based): bereme 0,1,2,3,4,5,6,7,10,11,14,15,18,19
function makeCsvLine(array $vals, int $totalCols = 20): string {
    $padded = array_pad($vals, $totalCols, '');
    return implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $padded));
}

$header1 = makeCsvLine(['','','','','','','Standart','','','','Větší','','','','Největší','','','','V čajovně','']);
$header2 = makeCsvLine(['KATEGORIE','ZEME','AKTIV','KOD','NAZEV','POZNAMKA','MN1','CENA1','','','MN2','CENA2','','','MN3','CENA3','','','MN4','CENA4']);

// Řádek 3: plný řádek
$data1 = makeCsvLine(['BÍLÝ','ČÍNA','x','2606-C-BILY-TAWN-01','Show Mee','','30','130','','','200','700','','','500','1680','','','7','98']);
// Řádek 4: prázdný → přeskočit
$data2 = makeCsvLine([]);
// Řádek 5: aktivní=prázdné (neaktivní)
$data3 = makeCsvLine(['ZELENÉ','JAPONSKO','','2606-C-ZELE-JAPO-01','Gyokuro','Poznámka test','40','200','','','200','800','','','','','','','20','150']);
// Řádek 6: bez KATEGORIE → přeskočit
$data4 = makeCsvLine(['','','x','2606-C-XXXX-XXXX-01','Bez kategorie','','30','130']);
// Řádek 7: bez KOD → přeskočit
$data5 = makeCsvLine(['BÍLÝ','ČÍNA','x','','Bez kódu','','30','130']);

$csv = implode("\n", [$header1, $header2, $data1, $data2, $data3, $data4, $data5]);

[$rows] = parseCajeRows($csv);

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

$r2 = $rows[1];
ok('řádek 2 KOD = 2606-C-ZELE-JAPO-01',        $r2['KOD'] === '2606-C-ZELE-JAPO-01');
ok('řádek 2 NAZEV = Gyokuro',                  $r2['NAZEV'] === 'Gyokuro');
ok('řádek 2 AKTIV = null (neaktivní)',         $r2['AKTIV'] === null);
ok('řádek 2 POZNAMKA = Poznámka test',         $r2['POZNAMKA'] === 'Poznámka test');
ok('řádek 2 MN3 = null (prázdné)',             $r2['MN3'] === null);

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

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
```

- [ ] **Step 2: Spustit test — musí selhat**

Run: `docker compose exec -T php php tools/test_sheets_sync.php`
Expected: FAIL (staré indexy čtou KOD jako NAZEV; `assertUniqueKod` nedefinována → fatal error). Obojí je očekávané selhání.

- [ ] **Step 3: Implementace v `backend/lib/sheets_sync.php`**

Nahradit konstanty (řádky 5–8):

```php
// Indexy sloupců v sheetu, které bereme (0-based, A=0). D = KOD (od 2026-07).
const SHEETS_COL_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 14, 15, 18, 19];
const SHEETS_COL_NAMES   = ['KATEGORIE', 'ZEME', 'AKTIV', 'KOD', 'NAZEV', 'POZNAMKA',
                             'MN1', 'CENA1', 'MN2', 'CENA2', 'MN3', 'CENA3', 'MN4', 'CENA4'];
```

V `parseCajeRows` za `if ($row['NAZEV'] === null) continue;` přidat:

```php
        if ($row['KOD'] === null) continue;
```

Za `parseCajeRows` přidat novou funkci:

```php
/**
 * Ověří unikátnost KOD napříč parsovanými řádky.
 * Duplicita = chyba dat v sheetu → RuntimeException (sync se nesmí provést).
 */
function assertUniqueKod(array $rows): void {
    $seen = [];
    foreach ($rows as $row) {
        $kod = $row['KOD'];
        if (isset($seen[$kod])) {
            throw new RuntimeException('Duplicitní KOD v sheetu: ' . $kod);
        }
        $seen[$kod] = true;
    }
}
```

- [ ] **Step 4: Spustit test — musí projít**

Run: `docker compose exec -T php php tools/test_sheets_sync.php`
Expected: `... passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/sheets_sync.php backend/tools/test_sheets_sync.php
git commit -m "feat(sync): parse sloupce KOD (D) + posun mapovani, kontrola duplicit"
```

---

### Task 4: Sync upsert místo TRUNCATE (TDD s DB)

**Files:**
- Modify: `backend/lib/sheets_sync.php` (`sheetsSyncCaje` → fetch+parse+assert+upsert; nová `sheetsUpsertCaje`; smazat `insertCajeRows`)
- Test: Create `backend/tools/test_sheets_upsert.php`

**Interfaces:**
- Consumes: schéma z Task 2 (`KOD`, `V_SHEETU`), `parseCajeRows`/`assertUniqueKod` z Task 3.
- Produces: `sheetsUpsertCaje(PDO $pdo, array $rows): array` — vrací `['synced' => int, 'vyrazeno' => int]`. `sheetsSyncCaje(PDO $pdo, string $csvUrl): array` — stejný návrat (mění se tvar: dříve `['inserted' => N]`!). Task 7 na to navazuje ve frontendu.

- [ ] **Step 1: Napsat DB-backed CLI test**

Celý obsah `backend/tools/test_sheets_upsert.php`:

```php
<?php
// DB-backed test upsert syncu. Spouštět: docker compose exec -T php php tools/test_sheets_upsert.php
// POZOR: maže obsah 00_prodej_polozky, 00_prodej a 01_caje v lokální DB (dev data, lze re-seedovat).
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

function mkRow(string $kod, string $nazev, string $cena1): array {
    return ['KATEGORIE' => 'BÍLÝ', 'ZEME' => 'ČÍNA', 'AKTIV' => 'x', 'KOD' => $kod,
            'NAZEV' => $nazev, 'POZNAMKA' => null, 'MN1' => '30', 'CENA1' => $cena1,
            'MN2' => null, 'CENA2' => null, 'MN3' => null, 'CENA3' => null,
            'MN4' => null, 'CENA4' => null];
}

$pdo = getPDO();
$pdo->exec('TRUNCATE TABLE `00_prodej_polozky`');
$pdo->exec('DELETE FROM `00_prodej`');
$pdo->exec('DELETE FROM `01_caje`');

// --- 1. sync: dva nové řádky ---
$res = sheetsUpsertCaje($pdo, [
    mkRow('2606-C-BILY-TAWN-01', 'Show Mee', '130'),
    mkRow('2606-C-BILY-TAWN-02', 'Bai Mu Dan', '220'),
]);
ok('1. sync: synced = 2',   $res['synced'] === 2);
ok('1. sync: vyrazeno = 0', $res['vyrazeno'] === 0);

$id1 = (int) $pdo->query("SELECT id FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-01'")->fetchColumn();
ok('1. sync: řádek 1 existuje', $id1 > 0);
$vs = (int) $pdo->query("SELECT V_SHEETU FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-02'")->fetchColumn();
ok('1. sync: V_SHEETU = 1', $vs === 1);

// --- 2. sync: řádek 1 změněná cena, řádek 2 zmizel ze sheetu, řádek 3 nový ---
$res = sheetsUpsertCaje($pdo, [
    mkRow('2606-C-BILY-TAWN-01', 'Show Mee', '150'),
    mkRow('2607-C-ZELE-JAPO-01', 'Gyokuro', '200'),
]);
ok('2. sync: synced = 2',   $res['synced'] === 2);
ok('2. sync: vyrazeno = 1', $res['vyrazeno'] === 1);

$row1 = $pdo->query("SELECT id, CENA1, V_SHEETU FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-01'")->fetch(PDO::FETCH_ASSOC);
ok('2. sync: řádek 1 — id stabilní',      (int) $row1['id'] === $id1);
ok('2. sync: řádek 1 — cena updatnutá',   (int) $row1['CENA1'] === 150);
ok('2. sync: řádek 1 — V_SHEETU = 1',     (int) $row1['V_SHEETU'] === 1);

$row2 = $pdo->query("SELECT NAZEV, V_SHEETU FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-02'")->fetch(PDO::FETCH_ASSOC);
ok('2. sync: vyřazený řádek zůstal v DB',   $row2 !== false);
ok('2. sync: vyřazený řádek — V_SHEETU = 0', (int) $row2['V_SHEETU'] === 0);
ok('2. sync: vyřazený řádek — data intaktní', $row2['NAZEV'] === 'Bai Mu Dan');

$cnt = (int) $pdo->query('SELECT COUNT(*) FROM `01_caje`')->fetchColumn();
ok('2. sync: celkem 3 řádky v DB', $cnt === 3);

// --- 3. FK: prodej odkazuje na vyřazený kód → JOIN historie stále funguje ---
$pdo->exec("INSERT INTO `00_prodej` (user_id, total_kc) VALUES (1, 220)");
$pid = (int) $pdo->lastInsertId();
$pdo->exec("INSERT INTO `00_prodej_polozky` (prodej_id, caje_kod, baleni, kusu, jedn_cena, celk_cena)
            VALUES ($pid, '2606-C-BILY-TAWN-02', 1, 1, 220, 220)");
$nazev = $pdo->query(
    "SELECT c.NAZEV FROM `00_prodej_polozky` pp LEFT JOIN `01_caje` c ON c.KOD = pp.caje_kod WHERE pp.prodej_id = $pid"
)->fetchColumn();
ok('FK + JOIN: historie dohledá název vyřazené položky', $nazev === 'Bai Mu Dan');

// úklid prodeje po testu
$pdo->exec('TRUNCATE TABLE `00_prodej_polozky`');
$pdo->exec('DELETE FROM `00_prodej`');

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
```

- [ ] **Step 2: Spustit test — musí selhat**

Run: `docker compose exec -T php php tools/test_sheets_upsert.php`
Expected: fatal error `Call to undefined function sheetsUpsertCaje()`.

- [ ] **Step 3: Implementace v `backend/lib/sheets_sync.php`**

Nahradit `sheetsSyncCaje` a `insertCajeRows` (funkce `insertCajeRows` úplně smazat):

```php
/**
 * Hlavní sync: stáhne CSV, parsuje, ověří unikátnost KOD, upsertuje do 01_caje.
 * Vrací ['synced' => N, 'vyrazeno' => M].
 */
function sheetsSyncCaje(PDO $pdo, string $csvUrl): array {
    $raw = sheetsFetchCsv($csvUrl);
    $utf = dbtToUtf8($raw);

    [$rows] = parseCajeRows($utf);
    assertUniqueKod($rows);

    return sheetsUpsertCaje($pdo, $rows);
}

/**
 * Upsert řádků do 01_caje podle KOD (UNIQUE klíč uq_kod).
 * Řádky chybějící v $rows zůstanou v DB s V_SHEETU = 0 (vyřazené ze sheetu).
 * Nikdy nemaže — 00_prodej_polozky.caje_kod má FK na 01_caje.KOD.
 * Vrací ['synced' => počet řádků v sheetu, 'vyrazeno' => počet V_SHEETU = 0 po syncu].
 */
function sheetsUpsertCaje(PDO $pdo, array $rows): array {
    $pdo->beginTransaction();
    try {
        $pdo->exec('UPDATE `01_caje` SET V_SHEETU = 0');

        if (!empty($rows)) {
            $cols     = SHEETS_COL_NAMES;
            $dataCols = array_values(array_diff($cols, ['KOD']));
            $sql = 'INSERT INTO `01_caje` (`' . implode('`,`', $cols) . '`, `V_SHEETU`)'
                 . ' VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ', 1)'
                 . ' ON DUPLICATE KEY UPDATE '
                 . implode(', ', array_map(fn($c) => "`$c` = VALUES(`$c`)", $dataCols))
                 . ', `V_SHEETU` = 1';
            $stmt = $pdo->prepare($sql);
            foreach ($rows as $row) {
                $stmt->execute(array_map(fn($c) => $row[$c] ?? null, $cols));
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $vyrazeno = (int) $pdo->query('SELECT COUNT(*) FROM `01_caje` WHERE V_SHEETU = 0')->fetchColumn();
    return ['synced' => count($rows), 'vyrazeno' => $vyrazeno];
}
```

- [ ] **Step 4: Spustit oba CLI testy — musí projít**

Run: `docker compose exec -T php php tools/test_sheets_sync.php; docker compose exec -T php php tools/test_sheets_upsert.php`
Expected: oba `0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/sheets_sync.php backend/tools/test_sheets_upsert.php
git commit -m "feat(sync): upsert podle KOD misto TRUNCATE, V_SHEETU flag pro vyrazene polozky"
```

---

### Task 5: Backend API — caje_kod v prodejích, V_SHEETU filtry

**Files:**
- Modify: `backend/api/cajovna.php` (createProdej, listProdeje, listKategorie, listPolozky)
- Modify: `backend/api/teas.php` (listTeas)

**Interfaces:**
- Consumes: schéma z Task 2; v DB pár řádků z Task 4 testu (`2606-C-BILY-TAWN-01` atd.) pro curl ověření.
- Produces: `POST /api/cajovna/prodej` přijímá položky `{ caje_kod: string, baleni, kusu, jedn_cena, celk_cena }`; neznámý kód → 400 `Neznámý kód položky.`. `GET /api/cajovna/prodeje/{id}/polozky` vrací `caje_kod` místo `caje_id`. `GET /api/teas` vrací jen `V_SHEETU = 1` (včetně sloupců `KOD`, `V_SHEETU`). Task 6 (frontend) na tyto tvary navazuje.

- [ ] **Step 1: Upravit `createProdej` v `backend/api/cajovna.php`**

Validace položek (nahradit stávající foreach):

```php
    foreach ($polozky as $p) {
        if (!isset($p['caje_kod'], $p['baleni'], $p['kusu'], $p['jedn_cena'], $p['celk_cena'])
            || !is_string($p['caje_kod']) || trim($p['caje_kod']) === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatná položka.']);
            return;
        }
        if (!in_array((int) $p['baleni'], [1, 2, 3, 4], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatné číslo balení: ' . $p['baleni']]);
            return;
        }
    }
```

INSERT (nahradit `$ins` a smyčku):

```php
        $ins = $pdo->prepare(
            'INSERT INTO `00_prodej_polozky` (prodej_id, caje_kod, baleni, kusu, jedn_cena, celk_cena)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($polozky as $p) {
            $ins->execute([
                $prodejId,
                trim($p['caje_kod']),
                (int) $p['baleni'],
                (int) $p['kusu'],
                (int) $p['jedn_cena'],
                (int) $p['celk_cena'],
            ]);
        }
```

Catch blok (nahradit stávající `catch (Throwable $e)`):

```php
    } catch (PDOException $e) {
        $pdo->rollBack();
        // 1452 = FK violation → kód neexistuje v 01_caje
        if (($e->errorInfo[1] ?? 0) === 1452) {
            http_response_code(400);
            echo json_encode(['error' => 'Neznámý kód položky.']);
            return;
        }
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při zápisu prodeje.']);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při zápisu prodeje.']);
    }
```

- [ ] **Step 2: Upravit JOINy a filtry v `backend/api/cajovna.php`**

`listProdeje` — oba EXISTS řádky (114 a 118): `JOIN `01_caje` c ON c.id = pp.caje_id` → `JOIN `01_caje` c ON c.KOD = pp.caje_kod`.

`listKategorie` — WHERE rozšířit:

```php
        "SELECT DISTINCT KATEGORIE as kategorie, ZEME as zeme FROM `01_caje`
         WHERE AKTIV = 'x' AND V_SHEETU = 1 AND KATEGORIE IS NOT NULL
         ORDER BY KATEGORIE, ZEME"
```

`listPolozky` — SELECT a JOIN:

```php
        'SELECT pp.id, pp.caje_kod, pp.baleni, pp.kusu, pp.jedn_cena, pp.celk_cena,
                c.NAZEV as nazev, c.KATEGORIE as kategorie, c.ZEME as zeme
         FROM `00_prodej_polozky` pp
         LEFT JOIN `01_caje` c ON c.KOD = pp.caje_kod
         WHERE pp.prodej_id = ?
         ORDER BY pp.id'
```

- [ ] **Step 3: Upravit `listTeas` v `backend/api/teas.php`**

Řádek 29: `$where  = [];` → `$where  = ['V_SHEETU = 1'];` (SELECT pak vždy má WHERE — stávající `if ($where)` to složí správně).

- [ ] **Step 4: Ověřit přes curl (PowerShell)**

```powershell
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login -ContentType 'application/json' -Body '{"username":"admin","password":"admin"}').token
# teas: jen V_SHEETU=1, obsahuje KOD
Invoke-RestMethod -Uri http://localhost:8080/api/teas -Headers @{Authorization="Bearer $token"} | Format-Table KOD, NAZEV, V_SHEETU
# prodej s platným kódem (řádek z Task 4 testu)
$body = '{"polozky":[{"caje_kod":"2606-C-BILY-TAWN-01","baleni":1,"kusu":1,"jedn_cena":150,"celk_cena":150}]}'
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/cajovna/prodej -ContentType 'application/json' -Headers @{Authorization="Bearer $token"} -Body $body
# prodej s neznámým kódem → 400
$bad = '{"polozky":[{"caje_kod":"NEEXISTUJE-99","baleni":1,"kusu":1,"jedn_cena":10,"celk_cena":10}]}'
try { Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/cajovna/prodej -ContentType 'application/json' -Headers @{Authorization="Bearer $token"} -Body $bad } catch { $_.Exception.Response.StatusCode.value__ }
```
Expected: teas vrací 2 řádky (V_SHEETU=1 z Task 4), platný prodej vrátí `prodej_id` + `total: 150`, neznámý kód vrátí `400`.

Pozn.: Task 4 test po sobě uklízí prodeje, takže tento testovací prodej je jediný v DB — smaže ho re-seed v Task 8.

- [ ] **Step 5: Commit**

```bash
git add backend/api/cajovna.php backend/api/teas.php
git commit -m "feat(api): prodeje pres caje_kod, V_SHEETU filtry v teas a kategorie"
```

---

### Task 6: Frontend — typy, API vrstva, hook (TDD)

**Files:**
- Modify: `frontend/src/types.ts` (TeaRow, CajePolozkaSale)
- Modify: `frontend/src/api/cajovna.ts` (CajePolozkaSend)
- Modify: `frontend/src/hooks/useCajovnaPOS.ts:124`
- Test: `frontend/src/hooks/useCajovnaPOS.test.ts`

**Interfaces:**
- Consumes: API tvary z Task 5.
- Produces: `TeaRow` má `KOD: string` a `V_SHEETU?: number`; `CajePolozkaSend.caje_kod: string`; `CajePolozkaSale.caje_kod: string`. Task 7 na typy navazuje.

- [ ] **Step 1: Upravit test — fixtures s KOD + očekávání caje_kod**

V `frontend/src/hooks/useCajovnaPOS.test.ts` doplnit do fixtures `KOD` (za `id`):

```ts
const row1: TeaRow = {
  id: 1, KOD: '2606-C-BILY-TAWN-01', KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Show Mee',
  POZNAMKA: null, MN1: 30, CENA1: 130, MN2: 200, CENA2: 700,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row2: TeaRow = {
  id: 2, KOD: '2606-C-BILY-TAWN-02', KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Bai Mu Dan',
  POZNAMKA: 'poznámka', MN1: 30, CENA1: 220, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row3: TeaRow = {
  id: 3, KOD: '2606-C-ZELE-JAPO-01', KATEGORIE: 'ZELENÉ', ZEME: 'Japonsko', AKTIV: null, NAZEV: 'Neaktivní',
  POZNAMKA: null, MN1: 30, CENA1: 100, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
```

a očekávání checkoutu (řádky 162–164):

```ts
    expect(cajovnaApi.createCajovnaSale).toHaveBeenCalledWith([
      { caje_kod: '2606-C-BILY-TAWN-01', baleni: 1, kusu: 1, jedn_cena: 130, celk_cena: 130 },
    ])
```

- [ ] **Step 2: Spustit test — musí selhat**

Run: `cd frontend && npm run test -- --run src/hooks/useCajovnaPOS.test.ts`
Expected: FAIL — `createCajovnaSale` voláno s `caje_id: 1` místo `caje_kod`.

- [ ] **Step 3: Implementace typů a hooku**

`frontend/src/types.ts` — `TeaRow` doplnit za `id: number`:

```ts
  KOD: string
  V_SHEETU?: number
```

`frontend/src/types.ts` — `CajePolozkaSale`: `caje_id: number` → `caje_kod: string`.

`frontend/src/api/cajovna.ts` — `CajePolozkaSend`: `caje_id: number` → `caje_kod: string`.

`frontend/src/hooks/useCajovnaPOS.ts:124`: `caje_id:   item.caj.id,` → `caje_kod:  item.caj.KOD,`.

- [ ] **Step 4: Spustit test — musí projít**

Run: `cd frontend && npm run test -- --run src/hooks/useCajovnaPOS.test.ts`
Expected: `17 passed (17)`.

- [ ] **Step 5: Typecheck celého frontendu**

Run: `cd frontend && npx tsc -b`
Expected: bez chyb. Pokud tsc hlásí použití `caje_id`/chybějící `KOD` v dalších souborech (Dashboard.tsx, CajeHistory.tsx se řeší v Task 7 — pokud tsc spadne jen na nich, pokračovat na Task 7 a typecheck zopakovat tam).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/cajovna.ts frontend/src/hooks/useCajovnaPOS.ts frontend/src/hooks/useCajovnaPOS.test.ts
git commit -m "feat(pos): kosik a prodej pres caje_kod, TeaRow s KOD"
```

---

### Task 7: Frontend — zobrazení fallbacků a výsledek syncu

**Files:**
- Modify: `frontend/src/components/pos-cajovna/CajeHistory.tsx:87`
- Modify: `frontend/src/pages/admin/Dashboard.tsx:353`
- Modify: `frontend/src/api/admin.ts:33-35`
- Modify: `frontend/src/pages/admin/Teas.tsx:35`

**Interfaces:**
- Consumes: `CajePolozkaSale.caje_kod` z Task 6; API `/admin/sheets-sync` vrací `{ ok, synced: { synced, vyrazeno } }` z Task 4.
- Produces: UI bez odkazů na `caje_id`.

- [ ] **Step 1: Fallbacky zobrazení**

`CajeHistory.tsx:87`: `{it.nazev ?? `Čaj #${it.caje_id}`}` → `{it.nazev ?? it.caje_kod}`
`Dashboard.tsx:353`: `{p.nazev ?? `Čaj #${p.caje_id}`}` → `{p.nazev ?? p.caje_kod}`

- [ ] **Step 2: SyncResult a toast**

`frontend/src/api/admin.ts`:

```ts
export interface SyncResult {
  synced: number
  vyrazeno: number
}
```

`frontend/src/pages/admin/Teas.tsx:35`:

```ts
      toast.success(`Sync hotový — ${result.synced} položek (${result.vyrazeno} vyřazeno)`)
```

- [ ] **Step 3: Typecheck + celé frontend testy**

Run: `cd frontend && npx tsc -b && npm run test`
Expected: tsc bez chyb; všechny testy pass (žádný failed).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pos-cajovna/CajeHistory.tsx frontend/src/pages/admin/Dashboard.tsx frontend/src/api/admin.ts frontend/src/pages/admin/Teas.tsx
git commit -m "feat(admin): fallback zobrazeni pres caje_kod, sync toast se synced/vyrazeno"
```

---

### Task 8: seed_testdata.php přes caje_kod + nová test data

**Files:**
- Modify: `backend/seed_testdata.php:48-49,79,123,151`

**Interfaces:**
- Consumes: schéma z Task 2, data v `01_caje` (nutný předchozí sync nebo řádky z Task 4 testu).
- Produces: naplněné `00_prodej` + `00_prodej_polozky` s `caje_kod`.

- [ ] **Step 1: Úpravy v `backend/seed_testdata.php`**

Řádek 48–49 (SELECT):

```php
$teas = $pdo->query(
    "SELECT KOD, NAZEV, CENA1, CENA2, CENA3, CENA4 FROM `01_caje` WHERE AKTIV = 'x' AND V_SHEETU = 1"
)->fetchAll(PDO::FETCH_ASSOC);
```

Řádek 79 (INSERT položky):

```php
    'INSERT INTO `00_prodej_polozky` (prodej_id, caje_kod, baleni, kusu, jedn_cena, celk_cena)
     VALUES (?, ?, ?, ?, ?, ?)'
```

Řádek 123 (položka v košíku):

```php
                'caje_kod'  => $tea['KOD'],
```

Řádek 151 (execute):

```php
                    $pol['caje_kod'],
```

- [ ] **Step 2: Ověřit generátor**

Prerekvizita: `01_caje` obsahuje aktivní čaje (po Task 4 testu jsou tam 2–3 syntetické; pro plná test data nejdřív spustit reálný sync ze Sheets přes admin UI — sheet už musí mít KOD vyplněné).

Run: `Invoke-RestMethod -Method Post -Uri http://localhost:8080/seed_testdata.php | Select-String 'Celkem vloženo'`
Expected: `Celkem vloženo: N prodejů` (N > 0), žádné `Chyba prodeje`.

Kontrola dat: 
```powershell
docker compose exec -T mysql mysql -ucajovna -pcajovna cajovna -e "SELECT pp.caje_kod, COUNT(*) FROM 00_prodej_polozky pp GROUP BY pp.caje_kod LIMIT 5;"
```
Expected: řádky s kódy, žádný prázdný.

- [ ] **Step 3: Commit**

```bash
git add backend/seed_testdata.php
git commit -m "feat(seed): test data prodeju pres caje_kod"
```

---

### Task 9: Finální ověření

**Files:** žádné nové změny — jen verifikace.

- [ ] **Step 1: Kompletní testy**

Run: `cd frontend && npm run test`
Expected: všechny testy pass (baseline byl 17/17 v useCajovnaPOS + zbytek suite; nic failed).

Run: `docker compose exec -T php php tools/test_sheets_sync.php; docker compose exec -T php php tools/test_sheets_upsert.php`
Expected: oba `0 failed`.

- [ ] **Step 2: Smoke test aplikace**

1. `docker compose up -d` + `cd frontend && npm run dev`
2. Login jako `prodavacka`/`prodavacka123` → POS: kategorie se načtou, prodej čaje projde.
3. Login jako `admin`/`admin` → Čaje: tabulka ukazuje sloupec KOD po syncu; Dashboard: detail prodeje ukazuje názvy položek.

- [ ] **Step 3: Označit task v `.claude/tasks.md` jako hotový**

Přesunout řádek KOD položky do `## Hotovo` (soubor založit sekci, pokud chybí) a commitnout spolu s případnými zbytky:

```bash
git add .claude/tasks.md
git commit -m "chore: KOD polozky hotovo v tasks.md"
```

---

## Poznámky k nasazení (mimo plán, ruční kroky uživatele)

1. Doplnit KOD všem řádkům sheetu (podmínka: unikátní, už se nemění).
2. Spustit migraci `db/migration_2026-07-03_kod_polozky.sql` na produkci (phpMyAdmin/CLI).
3. Nahrát na FTP **celou složku `backend/`** + nový frontend build.
4. Spustit sync (admin UI „Sync ze Sheets" nebo Apps Script token) — naplní `01_caje` s KOD.
5. `seed_testdata.php` na produkci NEPOUŠTĚT (jen lokálně) — a pokud tam soubor je, smazat ho.
