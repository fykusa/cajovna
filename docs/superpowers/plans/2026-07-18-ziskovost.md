# Ziskovost prodejů — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamrazit ceníkovou a nákupní cenu každé prodané položky v okamžiku prodeje a zobrazit z nich spočítanou ziskovost (zisk) v Dashboardu a na stránce Tržby.

**Architecture:** Dva nové sloupce na `00_prodej_polozky` (`celk_cena_cenik`, `celk_cena_nakup`), plněné v `createProdej` v okamžiku vzniku prodeje — ne dopočítávané zpětně JOINem na aktuální `01_caje`. Sdílená logika výběru cen (`cenaColumnsForTable`, `fetchCenaRow`, `pickBaleniCeny`) a agregační SQL fragment (`PRODEJ_ZISK_SUBQUERY`) žijí v novém `backend/lib/prodej_snapshot.php`, testovatelné PHP CLI testem bez nutnosti volat HTTP vrstvu. `listProdeje` vrací nové pole `zisk` na úrovni prodeje; frontend ho sčítá stejným způsobem, jakým dnes sčítá `cenikova_cena`/`total_kc`.

**Tech Stack:** PHP 7.4 + PDO MySQL, React 19 + TypeScript, Vitest.

## Global Constraints

- Zamrazuje se jen `01_caje` (má `NAKUP1-4`). `02_nadobi`/`03_etnoshop` sloupce `NAKUP1-4` nemají — `celk_cena_nakup` u těchto typů je vždy `NULL`.
- Žádný zpětný přepočet historických prodejů — staré řádky mají `celk_cena_cenik`/`celk_cena_nakup` `NULL`.
- `zisk` (agregace na úrovni prodeje) počítá jen položky s `celk_cena_nakup IS NOT NULL` — položky s neznámou nákupní cenou se do součtu nezapočítávají vůbec, ne jako nulová marže.
- Revenue báze pro zisk je **ceníková cena** (`celk_cena_cenik`), ne skutečně účtovaná (`celk_cena`).
- Existující `cenikova_cena`/„Dýžko" (JOIN na aktuální `01_caje`) se nemění — jiná metrika, mimo rozsah.
- Dashboard/Sales agregace respektují stávající filtr storna (`activeSales = sales.filter(s => !s.cancelled_at)`).
- Zobrazení na Tržbách: jedno souhrnné číslo za období, bez rozpadu podle prodavající.
- Spec: `docs/superpowers/specs/2026-07-18-ziskovost-design.md`

---

### Task 1: DB migrace — `celk_cena_cenik`, `celk_cena_nakup`

**Files:**
- Create: `db/migration_2026-07-18_ziskovost_prodeje.sql`

**Interfaces:**
- Produces: `00_prodej_polozky.celk_cena_cenik` (`INT NULL`), `00_prodej_polozky.celk_cena_nakup` (`INT NULL`).

- [ ] **Step 1: Napsat migrační SQL soubor**

Vytvoř `db/migration_2026-07-18_ziskovost_prodeje.sql`:

```sql
-- Zamrazená ceníková a nákupní cena položky prodeje v okamžiku prodeje,
-- pro historicky přesný výpočet ziskovosti (nezávisle na pozdějším
-- syncu ze Sheets, který CENA1-4/NAKUP1-4 přepisuje). Staré řádky
-- zůstávají NULL — žádný zpětný dopočet.

ALTER TABLE `00_prodej_polozky`
  ADD COLUMN `celk_cena_cenik` INT NULL,
  ADD COLUMN `celk_cena_nakup` INT NULL;
```

- [ ] **Step 2: Spustit migraci na lokální Docker DB**

Run: `docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u root -proot f109530 < db/migration_2026-07-18_ziskovost_prodeje.sql`

Expected: bez chyby.

- [ ] **Step 3: Ověřit výsledek**

Run:
```
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u root -proot f109530 -e "SHOW COLUMNS FROM \`00_prodej_polozky\` LIKE 'celk_cena%';"
```
Expected: 4 řádky — `celk_cena`, `celk_cena_cenik`, `celk_cena_nakup` (a případně žádný další match) — konkrétně `celk_cena` (`int(11)`, `NOT NULL`, existující), `celk_cena_cenik` a `celk_cena_nakup` (`int(11)`, `Null = YES`, nové).

- [ ] **Step 4: Commit**

```bash
git add db/migration_2026-07-18_ziskovost_prodeje.sql
git commit -m "feat(db): sloupce celk_cena_cenik a celk_cena_nakup v 00_prodej_polozky"
```

**Poznámka pro později:** stejnou migraci je nutné spustit i na sdílené testovaci/produkční DB (Forpsi) — přes phpMyAdmin, ve stejném pořadí jako kód (migrace před nasazením nového backendu), stejně jako u `migration_2026-07-18_nakupni_ceny_caje.sql`.

---

### Task 2: Backend lib — `prodej_snapshot.php` (výběr cen)

**Files:**
- Create: `backend/lib/prodej_snapshot.php`
- Test: `backend/tools/test_prodej_snapshot.php`

**Interfaces:**
- Consumes: `PRODUKT_TABULKY` (`backend/lib/produkt_typy.php`, beze změny).
- Produces: `cenaColumnsForTable(string $tableName): string`, `fetchCenaRow(PDO $pdo, string $tableName, string $kod): ?array`, `pickBaleniCeny(array $row, int $baleni): array` (vrací `['cenik' => ?int, 'nakup' => ?int]`).

- [ ] **Step 1: Napsat test (červený stav)**

Vytvoř `backend/tools/test_prodej_snapshot.php`:

```php
<?php
// DB-backed test. Spouštět: docker compose exec -T php php tools/test_prodej_snapshot.php
// Vytváří a maže vlastní testovací řádky (KOD s prefixem TEST-PRODEJ-SNAPSHOT),
// nesahá na reálná synced data.
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/prodej_snapshot.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// --- cenaColumnsForTable (pure) ---
ok('cenaColumnsForTable(01_caje) obsahuje NAKUP sloupce',
   cenaColumnsForTable('01_caje') === 'CENA1,CENA2,CENA3,CENA4,NAKUP1,NAKUP2,NAKUP3,NAKUP4');
ok('cenaColumnsForTable(02_nadobi) neobsahuje NAKUP sloupce',
   cenaColumnsForTable('02_nadobi') === 'CENA1,CENA2,CENA3,CENA4');
ok('cenaColumnsForTable(03_etnoshop) neobsahuje NAKUP sloupce',
   cenaColumnsForTable('03_etnoshop') === 'CENA1,CENA2,CENA3,CENA4');

// --- pickBaleniCeny (pure) ---
$rowCaje = ['CENA1' => 130, 'CENA2' => 700, 'CENA3' => 1680, 'CENA4' => 98,
            'NAKUP1' => 80, 'NAKUP2' => null, 'NAKUP3' => 950, 'NAKUP4' => 60];
$p1 = pickBaleniCeny($rowCaje, 1);
ok('pickBaleniCeny balení 1: cenik=130', $p1['cenik'] === 130);
ok('pickBaleniCeny balení 1: nakup=80', $p1['nakup'] === 80);
$p2 = pickBaleniCeny($rowCaje, 2);
ok('pickBaleniCeny balení 2: cenik=700', $p2['cenik'] === 700);
ok('pickBaleniCeny balení 2: nakup=null (v DB NULL)', $p2['nakup'] === null);

$rowNadobi = ['CENA1' => 250, 'CENA2' => null, 'CENA3' => null, 'CENA4' => null];
$p3 = pickBaleniCeny($rowNadobi, 1);
ok('pickBaleniCeny (nadobi, bez NAKUP sloupců): cenik=250', $p3['cenik'] === 250);
ok('pickBaleniCeny (nadobi, bez NAKUP sloupců): nakup=null (sloupec v řádku vůbec není)', $p3['nakup'] === null);

// --- fetchCenaRow (DB-backed) ---
$pdo = getPDO();
$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");
$pdo->exec("INSERT INTO `01_caje` (KOD, KATEGORIE, ZEME, AKTIV, NAZEV, MN1, CENA1, NAKUP1, V_SHEETU)
            VALUES ('TEST-PRODEJ-SNAPSHOT-01', 'TEST', 'TEST', 'x', 'Test čaj', 30, 130, 80, 1)");

$row = fetchCenaRow($pdo, '01_caje', 'TEST-PRODEJ-SNAPSHOT-01');
ok('fetchCenaRow najde existující KOD', $row !== null);
ok('fetchCenaRow vrací CENA1', $row !== null && (int) $row['CENA1'] === 130);
ok('fetchCenaRow vrací NAKUP1', $row !== null && (int) $row['NAKUP1'] === 80);

$missing = fetchCenaRow($pdo, '01_caje', 'NEEXISTUJICI-KOD-XYZ');
ok('fetchCenaRow vrací null pro neexistující KOD', $missing === null);

$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
```

- [ ] **Step 2: Spustit test a ověřit, že selže**

Run: `docker compose exec -T php php tools/test_prodej_snapshot.php`
Expected: fatal error `Call to undefined function cenaColumnsForTable()` (soubor `prodej_snapshot.php` ještě neexistuje) — test se zastaví, nedoběhne do konce.

- [ ] **Step 3: Implementovat `prodej_snapshot.php`**

Vytvoř `backend/lib/prodej_snapshot.php`:

```php
<?php
// Zamrazení ceníkové a nákupní ceny položky prodeje v okamžiku prodeje
// (00_prodej_polozky.celk_cena_cenik/celk_cena_nakup), aby pozdější sync
// ze Sheets nepřepisoval historii prodejů. Viz spec
// docs/superpowers/specs/2026-07-18-ziskovost-design.md.
require_once __DIR__ . '/produkt_typy.php';

/**
 * SQL sloupcový seznam pro SELECT cen dané produktové tabulky. 01_caje má
 * navíc NAKUP1-4 (nákupní ceny), 02_nadobi/03_etnoshop je zatím nemají.
 */
function cenaColumnsForTable(string $tableName): string {
    $cols = 'CENA1,CENA2,CENA3,CENA4';
    if ($tableName === '01_caje') {
        $cols .= ',NAKUP1,NAKUP2,NAKUP3,NAKUP4';
    }
    return $cols;
}

/**
 * Načte řádek s cenami pro daný KOD ze zadané tabulky. Vrací null, pokud
 * KOD v tabulce neexistuje.
 */
function fetchCenaRow(PDO $pdo, string $tableName, string $kod): ?array {
    $stmt = $pdo->prepare('SELECT ' . cenaColumnsForTable($tableName) . " FROM `$tableName` WHERE KOD = ?");
    $stmt->execute([$kod]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

/**
 * Z řádku vráceného fetchCenaRow() vybere jednotkovou ceníkovou a nákupní
 * cenu pro dané balení (1-4). Nákupní cena chybí u nádobí/etnoshopu
 * (sloupec v řádku vůbec není) → null.
 */
function pickBaleniCeny(array $row, int $baleni): array {
    return [
        'cenik' => isset($row["CENA$baleni"]) ? (int) $row["CENA$baleni"] : null,
        'nakup' => isset($row["NAKUP$baleni"]) ? (int) $row["NAKUP$baleni"] : null,
    ];
}
```

- [ ] **Step 4: Spustit test znovu a ověřit, že projde**

Run: `docker compose exec -T php php tools/test_prodej_snapshot.php`
Expected: `13 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/prodej_snapshot.php backend/tools/test_prodej_snapshot.php
git commit -m "feat(prodej): prodej_snapshot.php - výběr ceníkové/nákupní ceny podle balení"
```

---

### Task 3: Backend integrace — `createProdej` zápis + `listProdeje` agregace `zisk`

**Files:**
- Modify: `backend/api/cajovna.php`
- Modify: `backend/lib/prodej_snapshot.php` (přidává `PRODEJ_ZISK_SUBQUERY`)
- Test: `backend/tools/test_prodej_snapshot.php` (rozšířit)

**Interfaces:**
- Consumes: `fetchCenaRow`, `pickBaleniCeny` (Task 2), `PRODUKT_TABULKY`.
- Produces: `const PRODEJ_ZISK_SUBQUERY` (SQL fragment bez aliasu, používá alias `p` pro `00_prodej` z obklopujícího dotazu). `createProdej` ukládá `celk_cena_cenik`/`celk_cena_nakup` na každou položku. `listProdeje` vrací nové pole `zisk` (float) v každém řádku výstupu.

- [ ] **Step 1: Rozšířit test o `PRODEJ_ZISK_SUBQUERY` a celý zápisový recept (červený stav)**

V `backend/tools/test_prodej_snapshot.php` přidej na začátek souboru (za `require_once __DIR__ . '/../lib/prodej_snapshot.php';`):

```php
require_once __DIR__ . '/../lib/produkt_typy.php';
```

A vlož před finální `echo "\n$PASS passed..."` řádek (tj. za blok `fetchCenaRow`, po řádku `$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");`):

```php
// --- recept, který používá createProdej: fetchCenaRow + pickBaleniCeny × kusu → INSERT ---
$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");
$pdo->exec("INSERT INTO `01_caje` (KOD, KATEGORIE, ZEME, AKTIV, NAZEV, MN1, CENA1, NAKUP1, V_SHEETU)
            VALUES ('TEST-PRODEJ-SNAPSHOT-01', 'TEST', 'TEST', 'x', 'Test čaj', 30, 130, 80, 1)");
$pdo->exec("DELETE FROM `02_nadobi` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-02'");
$pdo->exec("INSERT INTO `02_nadobi` (KOD, KATEGORIE, AKTIV, NAZEV, MN1, CENA1, V_SHEETU)
            VALUES ('TEST-PRODEJ-SNAPSHOT-02', 'TEST', 'x', 'Test hrnek', 1, 250, 1)");

$pdo->exec('INSERT INTO `00_prodej` (user_id, total_kc) VALUES (1, 1000)');
$prodejId = (int) $pdo->lastInsertId();

$polozky = [
    ['caje_kod' => 'TEST-PRODEJ-SNAPSHOT-01', 'produkt_typ' => 'caje',   'baleni' => 1, 'kusu' => 2, 'jedn_cena' => 130, 'celk_cena' => 260],
    ['caje_kod' => 'TEST-PRODEJ-SNAPSHOT-02', 'produkt_typ' => 'nadobi', 'baleni' => 1, 'kusu' => 1, 'jedn_cena' => 250, 'celk_cena' => 250],
];
$ins = $pdo->prepare('INSERT INTO `00_prodej_polozky`
    (prodej_id, caje_kod, PRODUKT_TYP, baleni, kusu, jedn_cena, celk_cena, celk_cena_cenik, celk_cena_nakup)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
foreach ($polozky as $p) {
    $table = PRODUKT_TABULKY[$p['produkt_typ']];
    $row   = fetchCenaRow($pdo, $table, $p['caje_kod']);
    $ceny  = pickBaleniCeny($row, $p['baleni']);
    $kusu  = $p['kusu'];
    $ins->execute([
        $prodejId, $p['caje_kod'], $p['produkt_typ'], $p['baleni'], $kusu,
        $p['jedn_cena'], $p['celk_cena'],
        $ceny['cenik'] !== null ? $ceny['cenik'] * $kusu : null,
        $ceny['nakup'] !== null ? $ceny['nakup'] * $kusu : null,
    ]);
}

$stored = $pdo->query("SELECT caje_kod, celk_cena_cenik, celk_cena_nakup FROM `00_prodej_polozky` WHERE prodej_id = $prodejId ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
ok('recept: čaj balení 1 × 2ks → celk_cena_cenik=260 (130×2)',    (int) $stored[0]['celk_cena_cenik'] === 260);
ok('recept: čaj balení 1 × 2ks → celk_cena_nakup=160 (80×2)',     (int) $stored[0]['celk_cena_nakup'] === 160);
ok('recept: nádobí × 1ks → celk_cena_cenik=250 (250×1)',          (int) $stored[1]['celk_cena_cenik'] === 250);
ok('recept: nádobí → celk_cena_nakup=NULL (nemá NAKUP sloupce)',  $stored[1]['celk_cena_nakup'] === null);

$rowZisk = $pdo->query('SELECT ' . PRODEJ_ZISK_SUBQUERY . " AS zisk FROM `00_prodej` p WHERE p.id = $prodejId")->fetch(PDO::FETCH_ASSOC);
ok('zisk z tohoto prodeje = 100 (jen čajová položka: 260-160, nádobí bez nákupní ceny se nepočítá)',
   (int) $rowZisk['zisk'] === 100);

$pdo->exec("DELETE FROM `00_prodej_polozky` WHERE prodej_id = $prodejId");
$rowZiskPrazdny = $pdo->query('SELECT ' . PRODEJ_ZISK_SUBQUERY . " AS zisk FROM `00_prodej` p WHERE p.id = $prodejId")->fetch(PDO::FETCH_ASSOC);
ok('prodej bez položek se známou nákupní cenou → zisk=0', (int) $rowZiskPrazdny['zisk'] === 0);

$pdo->exec("DELETE FROM `00_prodej` WHERE id = $prodejId");
$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");
$pdo->exec("DELETE FROM `02_nadobi` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-02'");
```

- [ ] **Step 2: Spustit test a ověřit, že nové assertions selžou**

Run: `docker compose exec -T php php tools/test_prodej_snapshot.php`
Expected: fatal error `Undefined constant "PRODEJ_ZISK_SUBQUERY"` (konstanta ještě neexistuje) — test se zastaví na tomhle bloku, ale bloky `cenaColumnsForTable`/`pickBaleniCeny`/`fetchCenaRow` i „recept" INSERTy proběhnou a vypíšou svoje PASS/FAIL předtím.

- [ ] **Step 3: Přidat `PRODEJ_ZISK_SUBQUERY` do `prodej_snapshot.php`**

V `backend/lib/prodej_snapshot.php` přidej na konec souboru:

```php

/**
 * SQL fragment (bez aliasu) počítající zisk jednoho prodeje ze zamrazených
 * cen položek. Položky s neznámou nákupní cenou (celk_cena_nakup IS NULL —
 * nádobí/etnoshop, nebo prodeje před nasazením zamrazování) se do součtu
 * nezapočítávají vůbec, ne jako nulová marže. Očekává alias `p` pro
 * `00_prodej` v obklopujícím dotazu.
 */
const PRODEJ_ZISK_SUBQUERY = "(SELECT COALESCE(SUM(
        CASE WHEN pp.celk_cena_nakup IS NOT NULL
             THEN pp.celk_cena_cenik - pp.celk_cena_nakup ELSE 0 END
    ), 0) FROM `00_prodej_polozky` pp WHERE pp.prodej_id = p.id)";
```

- [ ] **Step 4: Upravit `createProdej` v `cajovna.php`**

Na začátek `backend/api/cajovna.php` (za `require_once __DIR__ . '/../lib/produkt_typy.php';` na řádku 4) přidej:

```php
require_once __DIR__ . '/../lib/prodej_snapshot.php';
```

Nahraď celou funkci `createProdej` (dnes řádky 36-108):

```php
function createProdej(array $auth): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $polozky = $data['polozky'] ?? [];

    if (empty($polozky)) {
        http_response_code(400);
        echo json_encode(['error' => 'Košík je prázdný.']);
        return;
    }

    $celkemZaplaceno = $data['celkem_zaplaceno'] ?? null;
    if ($celkemZaplaceno !== null && (!is_numeric($celkemZaplaceno) || (float) $celkemZaplaceno < 0)) {
        http_response_code(400);
        echo json_encode(['error' => 'Neplatná zaplacená částka.']);
        return;
    }

    $pdo = getPDO();

    $snapshots = [];
    foreach ($polozky as $i => $p) {
        if (!isset($p['caje_kod'], $p['produkt_typ'], $p['baleni'], $p['kusu'], $p['jedn_cena'], $p['celk_cena'])
            || !is_string($p['caje_kod']) || trim($p['caje_kod']) === ''
            || !is_string($p['produkt_typ']) || !isset(PRODUKT_TABULKY[$p['produkt_typ']])) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatná položka.']);
            return;
        }
        if (!in_array((int) $p['baleni'], [1, 2, 3, 4], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatné číslo balení: ' . $p['baleni']]);
            return;
        }
        $table = PRODUKT_TABULKY[$p['produkt_typ']];
        $row   = fetchCenaRow($pdo, $table, trim($p['caje_kod']));
        if ($row === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Neznámý kód položky.']);
            return;
        }
        $ceny = pickBaleniCeny($row, (int) $p['baleni']);
        $kusu = (int) $p['kusu'];
        $snapshots[$i] = [
            'cenik' => $ceny['cenik'] !== null ? $ceny['cenik'] * $kusu : null,
            'nakup' => $ceny['nakup'] !== null ? $ceny['nakup'] * $kusu : null,
        ];
    }

    $total = $celkemZaplaceno !== null ? (int) round((float) $celkemZaplaceno) : (int) array_sum(array_column($polozky, 'celk_cena'));
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO `00_prodej` (user_id, total_kc) VALUES (?, ?)');
        $stmt->execute([$auth['user_id'], $total]);
        $prodejId = (int) $pdo->lastInsertId();

        $ins = $pdo->prepare(
            'INSERT INTO `00_prodej_polozky`
                (prodej_id, caje_kod, PRODUKT_TYP, baleni, kusu, jedn_cena, celk_cena, celk_cena_cenik, celk_cena_nakup)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($polozky as $i => $p) {
            $ins->execute([
                $prodejId,
                trim($p['caje_kod']),
                $p['produkt_typ'],
                (int) $p['baleni'],
                (int) $p['kusu'],
                (int) $p['jedn_cena'],
                (int) $p['celk_cena'],
                $snapshots[$i]['cenik'],
                $snapshots[$i]['nakup'],
            ]);
        }
        $pdo->commit();
        http_response_code(201);
        echo json_encode(['prodej_id' => $prodejId, 'total' => $total]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při zápisu prodeje.']);
    }
}
```

- [ ] **Step 5: Upravit `listProdeje` v `cajovna.php`**

Nahraď `$sql = '...'` blok uvnitř `listProdeje` (dnes řádky 143-160) a navazující zpracování řádků (dnes řádky 164-167):

```php
    $sql = 'SELECT p.id, p.created_at, p.total_kc, u.username, p.user_id, p.cancelled_at,
                   (SELECT COALESCE(SUM(pp.kusu * (
                        CASE pp.baleni
                            WHEN 1 THEN COALESCE(c.CENA1, n.CENA1, e.CENA1)
                            WHEN 2 THEN COALESCE(c.CENA2, n.CENA2, e.CENA2)
                            WHEN 3 THEN COALESCE(c.CENA3, n.CENA3, e.CENA3)
                            WHEN 4 THEN COALESCE(c.CENA4, n.CENA4, e.CENA4)
                        END
                    )), 0)
                    FROM `00_prodej_polozky` pp
                    LEFT JOIN `01_caje` c     ON c.KOD = pp.caje_kod AND pp.PRODUKT_TYP = \'caje\'
                    LEFT JOIN `02_nadobi` n   ON n.KOD = pp.caje_kod AND pp.PRODUKT_TYP = \'nadobi\'
                    LEFT JOIN `03_etnoshop` e ON e.KOD = pp.caje_kod AND pp.PRODUKT_TYP = \'etnoshop\'
                    WHERE pp.prodej_id = p.id) AS cenikova_cena,
                   ' . PRODEJ_ZISK_SUBQUERY . ' AS zisk
            FROM `00_prodej` p
            JOIN users u ON u.id = p.user_id'
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY p.created_at DESC LIMIT 500';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = array_map(function ($row) {
        $row['cenikova_cena'] = (float) $row['cenikova_cena'];
        $row['zisk']          = (float) $row['zisk'];
        return $row;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    echo json_encode($rows);
```

- [ ] **Step 6: Spustit test znovu a ověřit, že projde**

Run: `docker compose exec -T php php tools/test_prodej_snapshot.php`
Expected: `19 passed, 0 failed`.

- [ ] **Step 7: Manuální ověření endpointu**

Spusť lokální backend (`docker compose up -d`), přihlas se, získej token, a ověř, že `GET /api/cajovna/prodeje` teď vrací pole `zisk` u každého prodeje:
```
curl -s "http://localhost:8080/api/cajovna/prodeje?from=2020-01-01&to=2030-01-01" -H "Authorization: Bearer <token>" | head -c 500
```
Expected: JSON pole obsahuje `"zisk":0` (nebo nenulovou hodnotu) u prodejů — staré prodeje (bez zamrazených cen) mají `zisk: 0`, nové (po Task 4 manuálním prodeji přes POS) budou mít reálnou hodnotu.

- [ ] **Step 8: Commit**

```bash
git add backend/api/cajovna.php backend/lib/prodej_snapshot.php backend/tools/test_prodej_snapshot.php
git commit -m "feat(prodej): zamrazit cenik/nakup při prodeji, agregace zisk v listProdeje"
```

---

### Task 4: Frontend — pole `zisk` + dlaždice v Dashboardu a Tržbách

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/admin/Dashboard.tsx`
- Modify: `frontend/src/pages/admin/Sales.tsx`
- Modify: `frontend/src/pages/admin/Sales.test.tsx`

**Interfaces:**
- Consumes: `CajovnaProdej.zisk` (nové pole, Task 3).
- Produces: `CajovnaProdej.zisk: number` (required). Dashboard i Sales zobrazují dlaždici „Zisk".

**Poznámka ke scope:** `Dashboard.tsx` dnes nemá žádný testovací soubor (`Sales.tsx` ano — `Sales.test.tsx`). Zakládat kompletní testovací infrastrukturu pro `Dashboard.tsx` jen kvůli jedné dlaždici je mimo rozsah týhle práce — dlaždice v Dashboardu se ověří ručně (konzistentní s projektovou konvencí pro drobné UI přírůstky bez existující testovací základny). Na `Sales.tsx` se naopak existující testy rozšíří, protože tam infrastruktura už je.

- [ ] **Step 1: Přidat `zisk` do typu a rozšířit testovací fixtures (červený stav)**

V `frontend/src/types.ts` uprav `CajovnaProdej` (dnes řádky 172-180):

```ts
export interface CajovnaProdej {
  id: number
  created_at: string
  total_kc: number
  username: string
  user_id: number
  cancelled_at: string | null
  cenikova_cena: number
  zisk: number
}
```

V `frontend/src/pages/admin/Sales.test.tsx` nahraď fixtures `SALES` a `SALES_WITH_CANCELLED` (dnes řádky 14-24):

```ts
const SALES = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null, cenikova_cena: 260, zisk: 100 },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: null, cenikova_cena: 130, zisk: 50 },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null, cenikova_cena: 500, zisk: 200 },
]

const SALES_WITH_CANCELLED = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null, cenikova_cena: 260, zisk: 100 },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: '2026-05-28 13:00:00', cenikova_cena: 130, zisk: 50 },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null, cenikova_cena: 500, zisk: 200 },
]
```

Přidej dva nové testy na konec `describe('Sales', () => { ... })` bloku (za poslední `it(...)`, před uzavírací `})`):

```tsx
  it('spočítá celkový zisk', async () => {
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    // 100 + 50 + 200 = 350
    expect(screen.getAllByText('350 Kč').length).toBeGreaterThan(0)
  })

  it('stornovaný prodej se nezapočítá do zisku', async () => {
    vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES_WITH_CANCELLED)
    renderWithToast(<Sales />)
    // Aktivní: id=1 (100) + id=3 (200) = 300; id=2 je stornovaný (50) — nesmí se počítat
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    expect(screen.getAllByText('300 Kč').length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Spustit testy a ověřit, že 2 nové selžou**

Run: `cd frontend && npm run test -- Sales`
Expected: 6 původních testů PASS, 2 nové FAIL (dlaždice „Zisk" ještě neexistuje, text `350 Kč`/`300 Kč` se nikde nenajde).

- [ ] **Step 3: Implementovat dlaždici v `Sales.tsx`**

V `frontend/src/pages/admin/Sales.tsx` za řádek `const total = activeSales.reduce((s, sale) => s + sale.total_kc, 0)` (řádek 62) přidej:

```ts
  const zisk = activeSales.reduce((s, sale) => s + sale.zisk, 0)
```

V bloku `.stats` (dnes řádky 153-162) přidej třetí dlaždici za „Počet prodejů":

```tsx
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Celkové tržby</div>
              <div className={styles.statValue}>{fmtKc(total)}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Počet prodejů</div>
              <div className={styles.statValue}>{activeSales.length}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Zisk</div>
              <div className={styles.statValue}>{fmtKc(zisk)}</div>
            </div>
          </div>
```

- [ ] **Step 4: Spustit testy znovu a ověřit, že všech 8 projde**

Run: `cd frontend && npm run test -- Sales`
Expected: `8 passed`.

- [ ] **Step 5: Implementovat dlaždici v `Dashboard.tsx`**

V `frontend/src/pages/admin/Dashboard.tsx` za řádek `const dyzko = total - cenikSoucet` (řádek 133) přidej:

```ts
  const zisk = activeSales.reduce((s, sale) => s + sale.zisk, 0)
```

Do bloku `.stats` (dnes řádky 272-285) přidej čtvrtou dlaždici za „Dýžko":

```tsx
            <div className={styles.stat}>
              <div className={styles.statLabel}>Zisk</div>
              <div className={styles.statValue}>{Math.round(zisk).toLocaleString('cs-CZ')} Kč</div>
            </div>
```

- [ ] **Step 6: Typecheck a plná testovací sada**

Run: `cd frontend && npx tsc -b`
Expected: bez chyby.

Run: `cd frontend && npm run test`
Expected: všechny testy PASS (žádná regrese mimo `Sales`).

- [ ] **Step 7: Manuální ověření v prohlížeči**

Otevři `/admin` (Dashboard) a `/admin/sales` (Tržby), zkontroluj, že dlaždice „Zisk" jsou vidět a hodnota dává smysl (0 Kč, dokud nebude aspoň jeden nový prodej po nasazení Task 3). Ruční ověření necháváš na sobě — jen dej vědět, jestli sedí rozvržení.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types.ts frontend/src/pages/admin/Dashboard.tsx frontend/src/pages/admin/Sales.tsx frontend/src/pages/admin/Sales.test.tsx
git commit -m "feat(admin): dlaždice Zisk v Dashboardu a na Tržbách"
```
