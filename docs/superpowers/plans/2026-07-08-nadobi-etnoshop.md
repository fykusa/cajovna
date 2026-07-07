# Nádobí + Etnoshop jako další produktové řady — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat dvě nové produktové řady (Nádobí, Etnoshop) se stejnou strukturou dat jako Čaje — vlastní sync ze Sheets, vlastní admin přehled, možnost prodávat je v POS (CajovnaPOS) vedle čaje, se sdíleným košíkem.

**Architecture:** Dvě nové DB tabulky (`02_nadobi`, `03_etnoshop`) zrcadlící `01_caje`. `01_caje` se nemění. Backend sync/listing kód zobecněn parametrem tabulky přes whitelist `PRODUKT_TABULKY`. `00_prodej_polozky` dostává sloupec `PRODUKT_TYP`; FK `fk_polozky_kod` se ruší (nahrazena aplikační validací přes stejný whitelist, protože MySQL neumí FK podmíněnou podle typu). Frontend: `useCajovnaPOS` hook zůstává jediný, načte všechny 3 katalogy najednou při startu a přepíná mezi nimi podle toho, které ze 3 tlačítek na Home obrazovce uživatel zvolí; košík je sdílený napříč typy.

**Tech Stack:** React 19 + TypeScript, Vitest, PHP 7.4 + PDO MySQL.

## Global Constraints

- `01_caje` se v této práci **nemění** (žádné ALTER, žádný nový sloupec) — chráníme prvně nasazený a odladěný systém.
- Sloupec `00_prodej_polozky.caje_kod` se **nepřejmenovává** — zůstává nosičem KODu z libovolné ze 3 tabulek podle nového sloupce `PRODUKT_TYP`.
- FK `fk_polozky_kod` se ruší, existence KODu se ověřuje v aplikačním kódu (viz spec `docs/superpowers/specs/2026-07-08-nadobi-etnoshop-design.md`).
- Beze změny: Dashboard filtry, stránka Tržby, export/import DB (`01_caje` v nich dnes stejně není).
- Typ `TeaRow` v `frontend/src/types.ts` se **nepřejmenovává** (strukturálně identický pro všechny 3 řady).
- Spec: `docs/superpowers/specs/2026-07-08-nadobi-etnoshop-design.md`

---

### Task 1: DB migrace — nové tabulky + `00_prodej_polozky`

**Files:**
- Create: `db/migration_2026-07-08_nadobi_etnoshop.sql`

**Interfaces:**
- Produces: tabulky `02_nadobi`, `03_etnoshop` (shodná struktura s `01_caje`: `id, KOD, KATEGORIE, ZEME, AKTIV, NAZEV, POZNAMKA, MN1-4, CENA1-4, V_SHEETU`, `UNIQUE KEY uq_kod (KOD)`). `00_prodej_polozky.PRODUKT_TYP ENUM('caje','nadobi','etnoshop') NOT NULL DEFAULT 'caje'`. FK `fk_polozky_kod` odstraněna.

- [ ] **Step 1: Napsat migrační SQL soubor**

Vytvoř `db/migration_2026-07-08_nadobi_etnoshop.sql`:

```sql
-- Nové produktové řady Nádobí a Etnoshop — zrcadlí strukturu 01_caje.
-- 01_caje se NEMĚNÍ. 00_prodej_polozky dostává PRODUKT_TYP a ztrácí
-- pevnou FK na 01_caje (nahrazeno aplikační validací, viz cajovna.php).

CREATE TABLE IF NOT EXISTS `02_nadobi` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
  `KOD`       VARCHAR(32)   NOT NULL,
  `KATEGORIE` VARCHAR(100)  NULL,
  `ZEME`      VARCHAR(100)  NULL,
  `AKTIV`     VARCHAR(10)   NULL,
  `NAZEV`     VARCHAR(255)  NULL,
  `POZNAMKA`  TEXT          NULL,
  `MN1`       DECIMAL(8,1)  NULL,
  `CENA1`     INT           NULL,
  `MN2`       DECIMAL(8,1)  NULL,
  `CENA2`     INT           NULL,
  `MN3`       DECIMAL(8,1)  NULL,
  `CENA3`     INT           NULL,
  `MN4`       DECIMAL(8,1)  NULL,
  `CENA4`     INT           NULL,
  `V_SHEETU`  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kod` (`KOD`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `03_etnoshop` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
  `KOD`       VARCHAR(32)   NOT NULL,
  `KATEGORIE` VARCHAR(100)  NULL,
  `ZEME`      VARCHAR(100)  NULL,
  `AKTIV`     VARCHAR(10)   NULL,
  `NAZEV`     VARCHAR(255)  NULL,
  `POZNAMKA`  TEXT          NULL,
  `MN1`       DECIMAL(8,1)  NULL,
  `CENA1`     INT           NULL,
  `MN2`       DECIMAL(8,1)  NULL,
  `CENA2`     INT           NULL,
  `MN3`       DECIMAL(8,1)  NULL,
  `CENA3`     INT           NULL,
  `MN4`       DECIMAL(8,1)  NULL,
  `CENA4`     INT           NULL,
  `V_SHEETU`  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kod` (`KOD`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `00_prodej_polozky`
  ADD COLUMN `PRODUKT_TYP` ENUM('caje','nadobi','etnoshop') NOT NULL DEFAULT 'caje' AFTER `caje_kod`;

-- Pozn.: pokud tenhle řádek spadne s chybou, že FK neexistuje ("check that
-- column/key exists" / "error in list of foreign keys"), FK už byla dřív
-- odstraněná — přeskoč tenhle příkaz a pokračuj dál, nic to nerozbije.
ALTER TABLE `00_prodej_polozky` DROP FOREIGN KEY `fk_polozky_kod`;
```

- [ ] **Step 2: Spustit migraci na lokální Docker DB**

Run: `docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u root -proot f109530 < db/migration_2026-07-08_nadobi_etnoshop.sql`

(Pokud `.env` má jiné `DB_NAME`, použij tu hodnotu místo `f109530`.)

Expected: bez chyby (nebo jen na posledním `DROP FOREIGN KEY` řádku, pokud FK lokálně ještě neexistuje — v tom případě spustit soubor znovu bez posledního řádku).

- [ ] **Step 3: Ověřit výsledek**

Run:
```
docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u root -proot f109530 -e "SHOW COLUMNS FROM \`02_nadobi\`; SHOW COLUMNS FROM \`03_etnoshop\`; SHOW COLUMNS FROM \`00_prodej_polozky\` LIKE 'PRODUKT_TYP';"
```
Expected: `02_nadobi` a `03_etnoshop` mají sloupce shodné s `01_caje` (KOD, KATEGORIE, ZEME, AKTIV, NAZEV, POZNAMKA, MN1-4/CENA1-4, V_SHEETU); `00_prodej_polozky` má nový sloupec `PRODUKT_TYP`.

- [ ] **Step 4: Commit**

```bash
git add db/migration_2026-07-08_nadobi_etnoshop.sql
git commit -m "feat(db): tabulky 02_nadobi a 03_etnoshop, PRODUKT_TYP v 00_prodej_polozky"
```

**Poznámka pro později:** stejnou migraci je nutné spustit i na sdílené testovaci/produkční DB (Forpsi) — přes phpMyAdmin, stejně jako `migration_2026-07-03_kod_polozky.sql` dnes. Přidat do `tasks.md` jako součást následného "překlopení na produkci" tasku.

---

### Task 2: Backend — zobecnění sync ze Sheets

**Files:**
- Create: `backend/lib/produkt_typy.php`
- Modify: `backend/lib/sheets_sync.php`
- Modify: `backend/config/sheets.example.php`
- Modify: `backend/config/sheets.php` (lokální, není v gitu — jen doplnit klíče)
- Test: `backend/tools/test_sheets_sync.php` (ověřit, že stávající testy dál procházejí beze změny)

**Interfaces:**
- Produces: konstanta `PRODUKT_TABULKY: array<string,string>` (whitelist typ → název tabulky). Funkce `sheetsSyncProdukty(PDO $pdo, string $csvUrl, string $tableName): array` (nahrazuje `sheetsSyncCaje`). `sheetsSyncCaje(PDO $pdo, string $csvUrl): array` zůstává jako tenký wrapper volající `sheetsSyncProdukty($pdo, $csvUrl, '01_caje')` (zpětná kompatibilita, žádné volající místo se nemusí měnit).
- Consumes: `parseCajeRows`, `assertUniqueKod`, `SHEETS_COL_NAMES` (beze změny).

- [ ] **Step 1: Vytvořit whitelist produktových typů**

Vytvoř `backend/lib/produkt_typy.php`:

```php
<?php
// Whitelist produktových řad → název DB tabulky. Používá se všude, kde by
// se jinak název tabulky skládal z uživatelského vstupu (query param,
// tělo POST requestu) — nikdy nepoužívat vstup přímo v SQL identifikátoru.
const PRODUKT_TABULKY = [
    'caje'     => '01_caje',
    'nadobi'   => '02_nadobi',
    'etnoshop' => '03_etnoshop',
];
```

- [ ] **Step 2: Zobecnit sync funkce v `sheets_sync.php`**

V `backend/lib/sheets_sync.php` nahraď funkce `sheetsSyncCaje` a `sheetsUpsertCaje` (řádky 31-39 a 105-135) za:

```php
/**
 * Hlavní sync pro libovolnou produktovou řadu: stáhne CSV, parsuje,
 * ověří unikátnost KOD, upsertuje do zadané tabulky.
 * Vrací ['synced' => N, 'vyrazeno' => M].
 */
function sheetsSyncProdukty(PDO $pdo, string $csvUrl, string $tableName): array {
    $raw = sheetsFetchCsv($csvUrl);
    $utf = dbtToUtf8($raw);

    [$rows] = parseCajeRows($utf);
    assertUniqueKod($rows);

    return sheetsUpsertProdukty($pdo, $rows, $tableName);
}

/** Zpětně kompatibilní wrapper pro čaje. */
function sheetsSyncCaje(PDO $pdo, string $csvUrl): array {
    return sheetsSyncProdukty($pdo, $csvUrl, '01_caje');
}

/**
 * Upsert řádků do zadané tabulky podle KOD (UNIQUE klíč uq_kod).
 * Řádky chybějící v $rows zůstanou v DB s V_SHEETU = 0 (vyřazené ze sheetu).
 * Nikdy nemaže.
 * Vrací ['synced' => počet řádků v sheetu, 'vyrazeno' => počet V_SHEETU = 0 po syncu].
 */
function sheetsUpsertProdukty(PDO $pdo, array $rows, string $tableName): array {
    if (empty($rows)) {
        throw new RuntimeException('Sheet neobsahuje žádné platné řádky — sync přerušen.');
    }
    if (!in_array($tableName, PRODUKT_TABULKY, true)) {
        throw new InvalidArgumentException('Neznámá tabulka pro sync: ' . $tableName);
    }

    $pdo->beginTransaction();
    try {
        $pdo->exec("UPDATE `$tableName` SET V_SHEETU = 0");

        $cols     = SHEETS_COL_NAMES;
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
```

Na začátek souboru (za `require_once __DIR__ . '/db_transfer.php';`) přidej:

```php
require_once __DIR__ . '/produkt_typy.php';
```

- [ ] **Step 3: Spustit existující PHP test a ověřit, že prochází beze změny**

Run: `docker compose exec -T php php tools/test_sheets_sync.php`
Expected: `29 passed, 0 failed` (stejný počet jako před změnou — `parseCajeRows`/`assertUniqueKod` nejsou dotčené, `sheetsSyncCaje` je teď tenký wrapper).

- [ ] **Step 4: Doplnit config vzory**

V `backend/config/sheets.example.php` uprav pole tak, aby obsahovalo i nové klíče:

```php
<?php
// Zkopíruj tento soubor na config/sheets.php a vyplň hodnoty.
// config/sheets.php NESMÍ být v gitu (je v .gitignore).
return [
    // Sdílené tajemství mezi Apps Script a serverem.
    // Nastav stejnou hodnotu v Apps Script Project Settings → Script Properties → SYNC_TOKEN.
    'sync_token' => 'REPLACE_WITH_RANDOM_SECRET',

    // URL jednotlivých záložek publikovaných jako CSV.
    // Google Sheets → Soubor → Sdílet → Publikovat na webu → záložka → CSV → Publikovat.
    'caje_csv_url'     => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
    'nadobi_csv_url'   => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
    'etnoshop_csv_url' => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
];
```

Do lokálního `backend/config/sheets.php` (není v gitu) ručně doplň `nadobi_csv_url` a `etnoshop_csv_url` s reálnými URL — bez toho nepůjde sync pro tyto řady ověřit v kroku dalšího tasku. Pokud URL ještě nemáš (sheety teprve vznikají), použij prozatím stejnou URL jako `caje_csv_url` — jen pro účely ověření mechanismu, přepíšeš až budou reálné.

- [ ] **Step 5: Commit**

```bash
git add backend/lib/produkt_typy.php backend/lib/sheets_sync.php backend/config/sheets.example.php
git commit -m "feat(sync): zobecnit sheetsSyncCaje na sheetsSyncProdukty pro libovolnou tabulku"
```

---

### Task 3: Backend — `admin.php` sync endpoint podle `?sheet=`

**Files:**
- Modify: `backend/api/admin.php`

**Interfaces:**
- Consumes: `PRODUKT_TABULKY` (Task 2), `sheetsSyncProdukty` (Task 2).
- Produces: `POST /api/admin/sheets-sync?sheet=caje|nadobi|etnoshop` (default `caje` beze změny stávajícího volání z Apps Scriptu, které parametr neposílá).

- [ ] **Step 1: Upravit `handleSheetsSync`**

V `backend/api/admin.php` najdi funkci `handleSheetsSync()` (aktuálně řádky 57-81) a nahraď ji:

```php
function handleSheetsSync(): void {
    $configPath = __DIR__ . '/../config/sheets.php';
    if (!is_file($configPath)) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'Konfigurace Sheets chybí (config/sheets.php).']);
        return;
    }
    $config = require $configPath;

    // Auth: token (Apps Script) nebo admin session (ruční sync z Dashboardu)
    $incomingToken = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
    $tokenOk       = $incomingToken !== '' && hash_equals($config['sync_token'] ?? '', $incomingToken);
    if (!$tokenOk) {
        requireAdmin(); // hodí 401/403 pokud není admin session
    }

    $sheet = $_GET['sheet'] ?? 'caje';
    if (!isset(PRODUKT_TABULKY[$sheet])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Neznámá záložka: ' . $sheet]);
        return;
    }
    $tableName = PRODUKT_TABULKY[$sheet];

    $url = $config["{$sheet}_csv_url"] ?? '';
    if ($url === '') {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'CSV URL není nakonfigurována.']);
        return;
    }

    try {
        $result = sheetsSyncProdukty(getPDO(), $url, $tableName);
        echo json_encode(['ok' => true, 'synced' => $result]);
    } catch (Throwable $e) {
        error_log('Sheets sync error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}
```

- [ ] **Step 2: Ověřit require řetězec**

Zkontroluj, že `backend/api/admin.php` už na začátku má `require_once __DIR__ . '/../lib/sheets_sync.php';` (ano, řádek 5) — ten teď navíc `require_once`uje `produkt_typy.php` (Task 2, Step 2), takže `PRODUKT_TABULKY` je v `admin.php` dostupná bez dalšího importu.

- [ ] **Step 3: Manuální ověření**

Spusť lokální backend (`docker compose up -d`) a přihlas se jako admin, získej token, pak:

```
curl -X POST "http://localhost:8080/api/admin/sheets-sync?sheet=caje" -H "Authorization: Bearer <token>"
curl -X POST "http://localhost:8080/api/admin/sheets-sync?sheet=nadobi" -H "Authorization: Bearer <token>"
curl -X POST "http://localhost:8080/api/admin/sheets-sync" -H "Authorization: Bearer <token>"
```

Expected: první dva vrátí `{"ok":true,"synced":{"synced":N,"vyrazeno":M}}` (podle dat v `config/sheets.php`), třetí (bez `?sheet=`) se chová jako `sheet=caje` (zpětná kompatibilita).

- [ ] **Step 4: Commit**

```bash
git add backend/api/admin.php
git commit -m "feat(admin): sheets-sync endpoint prijima ?sheet=caje|nadobi|etnoshop"
```

---

### Task 4: Backend — listovací endpointy pro nádobí a etnoshop

**Files:**
- Create: `backend/lib/produkty_list.php`
- Modify: `backend/api/teas.php`
- Create: `backend/api/nadobi.php`
- Create: `backend/api/etnoshop.php`
- Modify: `backend/.htaccess` (lokální Docker routing)

**Interfaces:**
- Produces: `handleListProdukty(string $tableName): void` — společná GET listovací logika (auth, filtry `search`/`kategorie`/`aktiv`, `V_SHEETU = 1`).
- Produces: `GET /api/nadobi`, `GET /api/etnoshop` (stejný tvar odpovědi jako `GET /api/teas`).

- [ ] **Step 1: Vytáhnout sdílenou listovací logiku**

Vytvoř `backend/lib/produkty_list.php`:

```php
<?php
/**
 * Sdílená GET listovací logika pro produktové tabulky (01_caje, 02_nadobi,
 * 03_etnoshop) — shodná struktura sloupců, liší se jen název tabulky.
 * Volající soubor (teas.php/nadobi.php/etnoshop.php) si řeší CORS hlavičky,
 * OPTIONS a routing regex sám; tahle funkce dělá jen požadovaný GET dotaz.
 */
function handleListProdukty(string $tableName): void {
    requireAuth();

    $pdo    = getPDO();
    $where  = ['V_SHEETU = 1'];
    $params = [];

    if (!empty($_GET['search'])) {
        $where[]  = 'NAZEV LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }
    if (!empty($_GET['kategorie'])) {
        $where[]  = 'KATEGORIE = ?';
        $params[] = $_GET['kategorie'];
    }
    if (isset($_GET['aktiv'])) {
        $where[]  = 'AKTIV = ?';
        $params[] = $_GET['aktiv'];
    }

    $sql  = "SELECT * FROM `$tableName`";
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY KATEGORIE, NAZEV';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
}
```

- [ ] **Step 2: Zjednodušit `teas.php` na tenký vstupní bod**

Nahraď celý obsah `backend/api/teas.php`:

```php
<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../lib/produkty_list.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

if ($method === 'GET' && preg_match('#/api/teas$#', $path)) {
    handleListProdukty('01_caje');
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}
```

- [ ] **Step 3: Vytvořit `nadobi.php` a `etnoshop.php`**

Vytvoř `backend/api/nadobi.php`:

```php
<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../lib/produkty_list.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

if ($method === 'GET' && preg_match('#/api/nadobi$#', $path)) {
    handleListProdukty('02_nadobi');
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}
```

Vytvoř `backend/api/etnoshop.php` — identické, jen `preg_match('#/api/etnoshop$#', $path)` a `handleListProdukty('03_etnoshop')`.

- [ ] **Step 4: Doplnit lokální `.htaccess` routing**

V `backend/.htaccess` přidej za řádek `RewriteRule ^api/teas(/.*)?$    api/teas.php    [QSA,L]`:

```apache
RewriteRule ^api/nadobi(/.*)?$   api/nadobi.php   [QSA,L]
RewriteRule ^api/etnoshop(/.*)?$ api/etnoshop.php [QSA,L]
```

(Poznámka: živý `.htaccess` na Forpsi tohle nepotřebuje — má obecné pravidlo `^api/([^/]+)(/.*)?$ api/$1.php`, viz `production-deploy` paměť. Tahle úprava je jen pro lokální Docker.)

- [ ] **Step 5: Manuální ověření**

```
curl http://localhost:8080/api/teas -H "Authorization: Bearer <token>"
curl http://localhost:8080/api/nadobi -H "Authorization: Bearer <token>"
curl http://localhost:8080/api/etnoshop -H "Authorization: Bearer <token>"
```

Expected: `/api/teas` vrací stejná data jako před refaktorem (regresní kontrola). `/api/nadobi` a `/api/etnoshop` vrací `[]` (prázdné pole), dokud neproběhne sync (Task 3 je zvládl, ale bez naplněného `config/sheets.php` může být prázdné — to je v pořádku).

- [ ] **Step 6: Commit**

```bash
git add backend/lib/produkty_list.php backend/api/teas.php backend/api/nadobi.php backend/api/etnoshop.php backend/.htaccess
git commit -m "feat(api): endpointy /api/nadobi a /api/etnoshop, sdilena listovaci logika"
```

---

### Task 5: Backend — `cajovna.php` napříč 3 typy

**Files:**
- Modify: `backend/api/cajovna.php`

**Interfaces:**
- Consumes: `PRODUKT_TABULKY` (Task 2).
- Produces: `createProdej` přijímá v každé položce navíc `produkt_typ`, validuje KOD proti odpovídající tabulce (nahrazuje zrušenou FK). `listPolozky` vrací položky se jmény/kategorií napříč všemi 3 tabulkami.

- [ ] **Step 1: Upravit `createProdej`**

V `backend/api/cajovna.php` nahraď funkci `createProdej` (aktuálně řádky 35-84):

```php
function createProdej(array $auth): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $polozky = $data['polozky'] ?? [];

    if (empty($polozky)) {
        http_response_code(400);
        echo json_encode(['error' => 'Košík je prázdný.']);
        return;
    }

    $pdo = getPDO();

    foreach ($polozky as $p) {
        if (!isset($p['caje_kod'], $p['produkt_typ'], $p['baleni'], $p['kusu'], $p['jedn_cena'], $p['celk_cena'])
            || !is_string($p['caje_kod']) || trim($p['caje_kod']) === ''
            || !isset(PRODUKT_TABULKY[$p['produkt_typ']])) {
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
        $check = $pdo->prepare("SELECT 1 FROM `$table` WHERE KOD = ?");
        $check->execute([trim($p['caje_kod'])]);
        if ($check->fetchColumn() === false) {
            http_response_code(400);
            echo json_encode(['error' => 'Neznámý kód položky.']);
            return;
        }
    }

    $total = (int) array_sum(array_column($polozky, 'celk_cena'));
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO `00_prodej` (user_id, total_kc) VALUES (?, ?)');
        $stmt->execute([$auth['user_id'], $total]);
        $prodejId = (int) $pdo->lastInsertId();

        $ins = $pdo->prepare(
            'INSERT INTO `00_prodej_polozky` (prodej_id, caje_kod, PRODUKT_TYP, baleni, kusu, jedn_cena, celk_cena)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($polozky as $p) {
            $ins->execute([
                $prodejId,
                trim($p['caje_kod']),
                $p['produkt_typ'],
                (int) $p['baleni'],
                (int) $p['kusu'],
                (int) $p['jedn_cena'],
                (int) $p['celk_cena'],
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

(Zrušen `catch (PDOException $e)` větev pro FK chybu 1452 — FK už neexistuje, neplatný KOD se teď chytá dřív aplikační validací výše.)

- [ ] **Step 2: Upravit `listPolozky` — join napříč 3 tabulkami**

Nahraď funkci `listPolozky` (aktuálně řádky 175-187):

```php
function listPolozky(int $prodejId): void {
    $pdo  = getPDO();
    $stmt = $pdo->prepare(
        'SELECT pp.id, pp.caje_kod, pp.PRODUKT_TYP, pp.baleni, pp.kusu, pp.jedn_cena, pp.celk_cena,
                COALESCE(c.NAZEV, n.NAZEV, e.NAZEV) as nazev,
                COALESCE(c.KATEGORIE, n.KATEGORIE, e.KATEGORIE) as kategorie,
                COALESCE(c.ZEME, n.ZEME, e.ZEME) as zeme
         FROM `00_prodej_polozky` pp
         LEFT JOIN `01_caje` c    ON c.KOD = pp.caje_kod AND pp.PRODUKT_TYP = \'caje\'
         LEFT JOIN `02_nadobi` n  ON n.KOD = pp.caje_kod AND pp.PRODUKT_TYP = \'nadobi\'
         LEFT JOIN `03_etnoshop` e ON e.KOD = pp.caje_kod AND pp.PRODUKT_TYP = \'etnoshop\'
         WHERE pp.prodej_id = ?
         ORDER BY pp.id'
    );
    $stmt->execute([$prodejId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}
```

- [ ] **Step 3: Přidat require pro `produkt_typy.php`**

Na začátek `backend/api/cajovna.php` (za `require_once __DIR__ . '/../middleware.php';`) přidej:

```php
require_once __DIR__ . '/../lib/produkt_typy.php';
```

**Poznámka k pokrytí testy:** `cajovna.php` nemá dnes žádný automatizovaný test (žádný PHP CLI skript ho nepokrývá — na rozdíl od `sheets_sync.php`/`db_transfer.php`, které testují čisté funkce bez DB). Zavádět pro tenhle jeden task nový typ testovací infrastruktury (HTTP/DB integrační test) by bylo nepřiměřené rozšíření rozsahu — ověření zůstává manuální (Step 4), stejně jako u zbytku `cajovna.php` dnes.

- [ ] **Step 4: Manuální ověření**

Předpokládá naplněné `02_nadobi`/`03_etnoshop` (Task 3 sync). Zkus vytvořit prodej s položkou z `02_nadobi`:

```
curl -X POST http://localhost:8080/api/cajovna/prodej \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"polozky":[{"caje_kod":"<realny KOD z 02_nadobi>","produkt_typ":"nadobi","baleni":1,"kusu":1,"jedn_cena":100,"celk_cena":100}]}'
```

Expected: `201` s `{"prodej_id":N,"total":100}`. Zkus i s neexistujícím KODem → `400 {"error":"Neznámý kód položky."}`. Zkus `GET /api/cajovna/prodeje/<prodej_id>/polozky` → vrátí položku se správným `nazev`/`kategorie` z `02_nadobi`.

- [ ] **Step 5: Commit**

```bash
git add backend/api/cajovna.php
git commit -m "feat(cajovna): validace KOD napric 3 tabulkami, PRODUKT_TYP v prodeji"
```

---

### Task 6: Frontend — typy a API vrstva

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/teas.ts`
- Modify: `frontend/src/api/cajovna.ts`
- Modify: `frontend/src/api/admin.ts`

**Interfaces:**
- Produces: `export type ProduktTyp = 'caje' | 'nadobi' | 'etnoshop'` v `types.ts`. `CajeCartItem.produktTyp: ProduktTyp`. `getProdukty(typ: ProduktTyp, params?): Promise<TeaRow[]>` v `api/teas.ts` (`getTeas` zůstává tenký wrapper). `CajePolozkaSend.produkt_typ: ProduktTyp` v `api/cajovna.ts`. `syncFromSheets(sheet?: ProduktTyp): Promise<SyncResult>` v `api/admin.ts`.

- [ ] **Step 1: Přidat `ProduktTyp` a rozšířit `CajeCartItem`**

V `frontend/src/types.ts` za `export interface CajeBaleni { ... }` (řádek 149-154) a před `CajeCartItem` přidej:

```ts
export type ProduktTyp = 'caje' | 'nadobi' | 'etnoshop'
```

Uprav `CajeCartItem` (řádek 156-162):

```ts
export interface CajeCartItem {
  localId: string
  caj: TeaRow
  produktTyp: ProduktTyp
  baleni: CajeBaleni
  kusu: number
  celkCena: number
}
```

- [ ] **Step 2: Zobecnit `api/teas.ts`**

Nahraď celý obsah `frontend/src/api/teas.ts`:

```ts
import { apiFetch } from './client'
import type { TeaRow, ProduktTyp } from '../types'

const PRODUKT_ENDPOINTS: Record<ProduktTyp, string> = {
  caje: 'teas',
  nadobi: 'nadobi',
  etnoshop: 'etnoshop',
}

export const getProdukty = (
  typ: ProduktTyp,
  params?: { search?: string; kategorie?: string; aktiv?: string },
): Promise<TeaRow[]> => {
  const q = new URLSearchParams()
  if (params?.search)    q.set('search', params.search)
  if (params?.kategorie) q.set('kategorie', params.kategorie)
  if (params?.aktiv !== undefined) q.set('aktiv', params.aktiv)
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<TeaRow[]>(`/${PRODUKT_ENDPOINTS[typ]}${qs}`)
}

export const getTeas = (params?: { search?: string; kategorie?: string; aktiv?: string }): Promise<TeaRow[]> =>
  getProdukty('caje', params)
```

- [ ] **Step 3: Rozšířit `CajePolozkaSend` v `api/cajovna.ts`**

V `frontend/src/api/cajovna.ts` uprav interface `CajePolozkaSend` (řádek 4-10):

```ts
export interface CajePolozkaSend {
  caje_kod: string
  produkt_typ: 'caje' | 'nadobi' | 'etnoshop'
  baleni: 1 | 2 | 3 | 4
  kusu: number
  jedn_cena: number
  celk_cena: number
}
```

- [ ] **Step 4: `syncFromSheets` přijímá typ produktu**

V `frontend/src/api/admin.ts` uprav `syncFromSheets` (aktuálně řádky 39-49):

```ts
export async function syncFromSheets(sheet: 'caje' | 'nadobi' | 'etnoshop' = 'caje'): Promise<SyncResult> {
  const res = await fetch(`${apiBase}/admin/sheets-sync?sheet=${sheet}`, {
    method: 'POST',
    headers: { ...authHeader() },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || 'Sync se nezdařil')
  }
  return (data as { synced: SyncResult }).synced
}
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: chyby na místech, kde `CajeCartItem` vzniká bez `produktTyp` (řeší Task 7) — to je v pořádku, potvrzuje že typový systém správně vynucuje doplnění nového pole. Pokud jsou i JINÉ chyby (mimo `useCajovnaPOS.ts`), zastavit a prošetřit.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/teas.ts frontend/src/api/cajovna.ts frontend/src/api/admin.ts
git commit -m "feat(types): ProduktTyp, CajeCartItem.produktTyp, getProdukty, sync s ?sheet="
```

---

### Task 7: Frontend — zobecnění `useCajovnaPOS`

**Files:**
- Modify: `frontend/src/hooks/useCajovnaPOS.ts`
- Test: `frontend/src/hooks/useCajovnaPOS.test.ts`

**Interfaces:**
- Consumes: `getProdukty` (Task 6), `ProduktTyp` (Task 6).
- Produces: `useCajovnaPOS()` vrací navíc `produktTyp: ProduktTyp`. `goToCategories(typ: ProduktTyp): void` (dřív bez parametru). Chování pro `typ === 'caje'` beze změny oproti dnešku.

- [ ] **Step 1: Napsat padající testy**

V `frontend/src/hooks/useCajovnaPOS.test.ts` uprav mock v `beforeEach` (aktuálně řádky 38-41) — nahraď mock `getTeas` mockem `getProdukty`:

```ts
const nadobiRow: TeaRow = {
  id: 101, KOD: 'ND-01', KATEGORIE: 'HRNKY', ZEME: null, AKTIV: 'x', NAZEV: 'Hrnek modrý',
  POZNAMKA: null, MN1: 1, CENA1: 250, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

beforeEach(() => {
  vi.mocked(teasApi.getProdukty).mockImplementation((typ: string) => {
    if (typ === 'nadobi') return Promise.resolve([nadobiRow])
    if (typ === 'etnoshop') return Promise.resolve([])
    return Promise.resolve(allRows)
  })
  vi.mocked(cajovnaApi.createCajovnaSale).mockResolvedValue({ prodej_id: 1, total: 130 })
})
```

(`nadobiRow` deklaruj vedle stávajících `row1`-`row5`, před `const allRows = [...]`.)

Na konec `describe('useCajovnaPOS', ...)` bloku (za poslední test `newSale resetuje košík...`) přidej:

```ts
  test('goToCategories(nadobi) přepne produktovou řadu a kategorie', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goToCategories('nadobi'))
    expect(result.current.view).toBe('categories')
    expect(result.current.categories).toEqual(['HRNKY'])
    expect(result.current.produktTyp).toBe('nadobi')
  })

  test('košík může obsahovat čaj i nádobí zároveň, každé se svým produktTyp', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.goToCategories('caje'))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))

    act(() => result.current.goToCategories('nadobi'))
    act(() => result.current.selectCategory('HRNKY'))
    act(() => result.current.selectTea(nadobiRow))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(2))

    expect(result.current.cart).toHaveLength(2)
    expect(result.current.cart[0].produktTyp).toBe('caje')
    expect(result.current.cart[1].produktTyp).toBe('nadobi')
  })

  test('confirmCheckout pošle produkt_typ pro každou položku', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goToCategories('nadobi'))
    act(() => result.current.selectCategory('HRNKY'))
    act(() => result.current.selectTea(nadobiRow))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(cajovnaApi.createCajovnaSale).toHaveBeenCalledWith([
      { caje_kod: 'ND-01', produkt_typ: 'nadobi', baleni: 1, kusu: 1, jedn_cena: 250, celk_cena: 250 },
    ])
  })
```

- [ ] **Step 2: Spustit testy a ověřit pád**

Run: `cd frontend && npx vitest run src/hooks/useCajovnaPOS.test.ts`
Expected: FAIL — `getProdukty` není exportováno z mocku (`teasApi.getProdukty` je `undefined`), `goToCategories` nepřijímá parametr, `produktTyp`/`cart[].produktTyp` neexistují.

- [ ] **Step 3: Implementovat zobecnění hooku**

V `frontend/src/hooks/useCajovnaPOS.ts` uprav import (řádek 3):

```ts
import { getProdukty } from '../api/teas'
```

Přidej import `ProduktTyp` do řádku 2:

```ts
import type { TeaRow, CajeBaleni, CajeCartItem, ProduktTyp } from '../types'
```

Uvnitř `useCajovnaPOS()` nahraď stav `allRows` (řádek 52) a `useEffect` pro načtení dat (řádky 68-79):

```ts
  const [produktTyp, setProduktTyp]         = useState<ProduktTyp>('caje')
  const [allRowsByTyp, setAllRowsByTyp]     = useState<Record<ProduktTyp, TeaRow[]>>({ caje: [], nadobi: [], etnoshop: [] })
```

(Nahrazuje `const [allRows, setAllRows] = useState<TeaRow[]>([])`.)

```ts
  useEffect(() => {
    Promise.all([getProdukty('caje'), getProdukty('nadobi'), getProdukty('etnoshop')])
      .then(([caje, nadobi, etnoshop]) => {
        setAllRowsByTyp({ caje, nadobi, etnoshop })
        setCategories(deriveCategories(caje))
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Chyba načítání dat')
        setLoading(false)
      })
  }, [])
```

Uprav `searchResults` (řádek 81-85), `filterTeas` (87-91) a `selectCategory` (93-104), ať pracují nad `allRowsByTyp[produktTyp]` místo `allRows`:

```ts
  const allRows = allRowsByTyp[produktTyp]

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length === 0) return []
    const q = normalizeSearch(searchQuery)
    return allRows.filter((r) => r.AKTIV === 'x' && r.NAZEV != null && normalizeSearch(r.NAZEV).includes(q))
  }, [allRows, searchQuery])

  function filterTeas(kategorie: string, zeme: string | null): TeaRow[] {
    return allRows.filter((r) =>
      r.AKTIV === 'x' && r.KATEGORIE === kategorie && (zeme === null || r.ZEME === zeme)
    )
  }

  function selectCategory(kategorie: string) {
    setSelectedCategory(kategorie)
    setSelectedZeme(null)
    const opts = deriveZeme(allRows, kategorie)
    setZemeOptions(opts)
    if (opts.length >= 2) {
      setView('countries')
    } else {
      setTeas(filterTeas(kategorie, null))
      setView('teas')
    }
  }
```

(Přidáním lokální `const allRows = allRowsByTyp[produktTyp]` na začátek funkce hooku zůstává zbytek těla — `filterTeas`, `selectCategory`, `searchResults` — beze změny logiky, jen čte z jiného zdroje.)

Uprav `goToCategories` (řádek 156):

```ts
  function goToCategories(typ: ProduktTyp) {
    setProduktTyp(typ)
    setCategories(deriveCategories(allRowsByTyp[typ]))
    setView('categories')
  }
```

Uprav `selectKusu` (řádky 127-141), ať do položky košíku uloží `produktTyp`:

```ts
  function selectKusu(n: number) {
    if (!selectedTea || !selectedBaleni) return
    const item: CajeCartItem = {
      localId: `${Date.now()}-${Math.random()}`,
      caj: selectedTea,
      produktTyp,
      baleni: selectedBaleni,
      kusu: n,
      celkCena: selectedBaleni.cena * n,
    }
    setCart((prev) => [...prev, item])
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setView('home')
  }
```

Uprav `confirmCheckout` (řádky 163-179), ať pošle `produkt_typ` za každou položku:

```ts
  async function confirmCheckout() {
    setCheckoutError(null)
    try {
      const polozky = cart.map((item) => ({
        caje_kod:    item.caj.KOD,
        produkt_typ: item.produktTyp,
        baleni:      item.baleni.cislo,
        kusu:        item.kusu,
        jedn_cena:   item.baleni.cena,
        celk_cena:   item.celkCena,
      }))
      const res = await createCajovnaSale(polozky)
      setLastTotal(res.total)
      newSale()
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    }
  }
```

V `return { ... }` (řádky 193-201) přidej `produktTyp` do vraceného objektu (za `view,`):

```ts
  return {
    view, produktTyp, categories, teas, baleniOptions, zemeOptions,
    selectedCategory, selectedZeme, selectedTea, selectedBaleni,
    cart, lastTotal, loading, error, checkoutError,
    searchQuery, searchResults, setSearchQuery,
    selectCategory, selectZeme, selectTea, selectBaleni, selectKusu,
    removeFromCart, goBack, goToCategories,
    startCheckout, confirmCheckout, newSale,
  }
```

- [ ] **Step 4: Spustit testy znovu — vše by mělo projít**

Run: `cd frontend && npx vitest run src/hooks/useCajovnaPOS.test.ts`
Expected: PASS, všechny testy včetně nových (existující testy volající `selectCategory` bez předchozího `goToCategories` fungují dál beze změny — `produktTyp` výchozí hodnota je `'caje'`, takže `allRowsByTyp['caje']` = stejná data jako dřívější `allRows`).

- [ ] **Step 5: Typecheck celého frontendu**

Run: `cd frontend && npx tsc -b`
Expected: bez chyb (Task 6 přidal `produktTyp` do `CajeCartItem`, tenhle task ho všude vyplňuje).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useCajovnaPOS.ts frontend/src/hooks/useCajovnaPOS.test.ts
git commit -m "feat(pos): useCajovnaPOS zobecnen pro caj/nadobi/etnoshop, sdileny kosik"
```

---

### Task 8: Frontend — 3 tlačítka na Home + generický placeholder

**Files:**
- Modify: `frontend/src/components/pos-cajovna/CajeHome.tsx`
- Modify: `frontend/src/components/pos-cajovna/CajeHome.module.css`
- Modify: `frontend/src/components/pos-cajovna/CajeCategories.tsx`
- Modify: `frontend/src/components/pos-cajovna/CajeCategories.test.tsx`

**Interfaces:**
- Consumes: `ProduktTyp` (Task 6), `pos.goToCategories(typ)` (Task 7).
- Produces: `CajeHome` prop `onAddItem: (typ: ProduktTyp) => void` (dřív `() => void`).

- [ ] **Step 1: Tři tlačítka v `CajeHome`**

V `frontend/src/components/pos-cajovna/CajeHome.tsx` uprav import a `Props` (řádky 1-9):

```tsx
import type { CajeCartItem, ProduktTyp } from '../../types'
import styles from './CajeHome.module.css'

interface Props {
  cart: CajeCartItem[]
  onAddItem: (typ: ProduktTyp) => void
  onCheckout: () => void
  onRemove: (localId: string) => void
}
```

Nahraď blok tlačítek (řádky 53-59):

```tsx
      <div className={styles.actions}>
        <div className={styles.addRow}>
          <button className={styles.addBtn} onClick={() => onAddItem('caje')}>+ Čaj</button>
          <button className={styles.addBtn} onClick={() => onAddItem('nadobi')}>+ Nádobí</button>
          <button className={styles.addBtn} onClick={() => onAddItem('etnoshop')}>+ Etnoshop</button>
        </div>
        {cart.length > 0 && (
          <button className={styles.checkoutBtn} onClick={onCheckout}>
            Zaúčtovat prodej →
          </button>
        )}
      </div>
```

- [ ] **Step 2: CSS pro řádek 3 tlačítek**

V `frontend/src/components/pos-cajovna/CajeHome.module.css` přidej za `.addBtn:active { transform: scale(0.985); }` (řádek 17):

```css
.addRow { display: flex; gap: 8px; }
.addRow .addBtn { flex: 1; padding: 12px 4px; font-size: 13px; }
```

- [ ] **Step 3: Generický placeholder v search boxu**

V `frontend/src/components/pos-cajovna/CajeCategories.tsx` uprav placeholder (řádek 23) z `"Hledat čaj podle názvu…"` na `"Hledat podle názvu…"`.

V `frontend/src/components/pos-cajovna/CajeCategories.test.tsx` uprav odpovídající `getByPlaceholderText('Hledat čaj podle názvu…')` (jediný výskyt) na `getByPlaceholderText('Hledat podle názvu…')`.

- [ ] **Step 4: Spustit testy**

Run: `cd frontend && npx vitest run src/components/pos-cajovna/CajeCategories.test.tsx`
Expected: PASS (5/5).

Run: `cd frontend && npx tsc -b`
Expected: bez chyb (`CajovnaPOS.tsx` předává `pos.goToCategories` do `onAddItem` — signatura `(typ: ProduktTyp) => void` teď sedí s `pos.goToCategories(typ: ProduktTyp): void` z Tasku 7, žádná úprava `CajovnaPOS.tsx` není potřeba).

- [ ] **Step 5: Manuální ověření**

`docker compose up -d`, `cd frontend && npm run dev`, přihlásit se jako `prodavacka`/`prodavacka` (lokálně dle `.env` seedu), otevřít `/cajovna`:
1. Na Home vidět 3 tlačítka: "+ Čaj", "+ Nádobí", "+ Etnoshop".
2. Klik na "+ Nádobí" → kategorie z `02_nadobi` (pokud je sync proveden, jinak prázdný seznam — to je OK pro tuhle kontrolu).
3. Klik na "+ Čaj" → chová se přesně jako dřív (regresní kontrola).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/pos-cajovna/CajeHome.tsx frontend/src/components/pos-cajovna/CajeHome.module.css frontend/src/components/pos-cajovna/CajeCategories.tsx frontend/src/components/pos-cajovna/CajeCategories.test.tsx
git commit -m "feat(pos): 3 tlacitka na Home (Caj/Nadobi/Etnoshop), genericky search placeholder"
```

---

### Task 9: Frontend — admin katalogy pro nádobí a etnoshop

**Files:**
- Modify: `frontend/src/pages/admin/Teas.tsx` → přejmenovat na `frontend/src/pages/admin/ProduktyAdmin.tsx`
- Create: `frontend/src/pages/admin/ProduktyAdmin.test.tsx`
- Modify: `frontend/src/router/AppRouter.tsx`
- Modify: `frontend/src/components/admin/AdminLayout.tsx`

**Interfaces:**
- Produces: komponenta `ProduktyAdmin` s props `{ produktTyp: ProduktTyp; nadpis: string }`, používaná 3× v routeru.

**Poznámka k pokrytí testy:** `Teas.tsx` dnes nemá vlastní test (na rozdíl od všech ostatních admin stránek — `Categories.test.tsx`, `Bags.test.tsx`, `Items.test.tsx` atd. existují). Generalizace je vhodná příležitost tuhle mezeru zavřít, ne ji přenést do nově vzniklého souboru.

- [ ] **Step 1: Zobecnit a přejmenovat admin stránku**

Smaž `frontend/src/pages/admin/Teas.tsx`, vytvoř `frontend/src/pages/admin/ProduktyAdmin.tsx`:

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

  const fmt = (v: number | null) => (v == null ? '' : String(v))

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
                <th colSpan={2} style={{ borderRight: '2px solid #444' }}>Standard</th>
                <th colSpan={2} style={{ borderRight: '2px solid #444' }}>Větší</th>
                <th colSpan={2} style={{ borderRight: '2px solid #444' }}>Největší</th>
                <th colSpan={2}>Čajovna</th>
              </tr>
              <tr>
                <th>Kód</th>
                <th>Kategorie</th>
                <th>Země</th>
                <th>Aktiv</th>
                <th>Název</th>
                <th style={{ borderRight: '2px solid #444' }}>Poznámka</th>
                <th>g</th>
                <th style={{ borderRight: '2px solid #444' }}>Kč</th>
                <th>g</th>
                <th style={{ borderRight: '2px solid #444' }}>Kč</th>
                <th>g</th>
                <th style={{ borderRight: '2px solid #444' }}>Kč</th>
                <th>g</th>
                <th>Kč</th>
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
                  <td style={{ borderRight: '2px solid #444' }}>{fmt(r.CENA1)}</td>
                  <td>{fmt(r.MN2)}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{fmt(r.CENA2)}</td>
                  <td>{fmt(r.MN3)}</td>
                  <td style={{ borderRight: '2px solid #444' }}>{fmt(r.CENA3)}</td>
                  <td>{fmt(r.MN4)}</td>
                  <td>{fmt(r.CENA4)}</td>
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

(Jediné změny oproti původnímu `Teas.tsx`: `getTeas()` → `getProdukty(produktTyp)`, `syncFromSheets()` → `syncFromSheets(produktTyp)`, nadpis parametrizovaný, nový `Props` interface. Zbytek — filtrování, tabulka — beze změny.)

- [ ] **Step 2: Napsat test pro `ProduktyAdmin`**

Vytvoř `frontend/src/pages/admin/ProduktyAdmin.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProduktyAdmin from './ProduktyAdmin'
import { renderWithToast } from '../../test/renderWithToast'
import * as teasApi from '../../api/teas'
import * as adminApi from '../../api/admin'
import type { TeaRow } from '../../types'

vi.mock('../../api/teas', () => ({
  getProdukty: vi.fn(),
}))
vi.mock('../../api/admin', () => ({
  syncFromSheets: vi.fn(),
}))

const ROW: TeaRow = {
  id: 1, KOD: 'ND-01', KATEGORIE: 'HRNKY', ZEME: 'ČR', AKTIV: 'x', NAZEV: 'Hrnek modrý',
  POZNAMKA: null, MN1: 1, CENA1: 250, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(teasApi.getProdukty).mockResolvedValue([ROW])
})

describe('ProduktyAdmin', () => {
  it('zobrazí nadpis podle props a načtená data pro daný produktTyp', async () => {
    renderWithToast(<ProduktyAdmin produktTyp="nadobi" nadpis="Nádobí" />)
    expect(await screen.findByText('Nádobí — import ze Sheets')).toBeInTheDocument()
    expect(screen.getByText('Hrnek modrý')).toBeInTheDocument()
    expect(teasApi.getProdukty).toHaveBeenCalledWith('nadobi')
  })

  it('klik na sync zavolá syncFromSheets s produktTyp a znovu načte data', async () => {
    vi.mocked(adminApi.syncFromSheets).mockResolvedValue({ synced: 5, vyrazeno: 1 })
    const user = userEvent.setup()
    renderWithToast(<ProduktyAdmin produktTyp="etnoshop" nadpis="Etnoshop" />)
    await screen.findByText('Hrnek modrý')
    await user.click(screen.getByRole('button', { name: /sync ze sheets/i }))
    await waitFor(() => expect(adminApi.syncFromSheets).toHaveBeenCalledWith('etnoshop'))
    expect(teasApi.getProdukty).toHaveBeenCalledTimes(2)
  })

  it('prázdná tabulka zobrazí hlášku o nutnosti syncu', async () => {
    vi.mocked(teasApi.getProdukty).mockResolvedValue([])
    renderWithToast(<ProduktyAdmin produktTyp="caje" nadpis="Čaje" />)
    expect(await screen.findByText(/tabulka je prázdná/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Spustit test**

Run: `cd frontend && npx vitest run src/pages/admin/ProduktyAdmin.test.tsx`
Expected: PASS (3/3). Komponenta z předchozího kroku je mechanickou parametrizací už fungujícího `Teas.tsx`, takže testy by měly projít napoprvé — pokud ne, značí to chybu v generalizaci (např. přehozené pořadí argumentů), ne chybějící funkčnost k dopsání.

- [ ] **Step 4: Router — 3 routy na jednu komponentu**

V `frontend/src/router/AppRouter.tsx` uprav lazy import (řádek 17):

```ts
const AdminProdukty = lazy(() => import('../pages/admin/ProduktyAdmin'))
```

Nahraď routu `teas` (řádek 65):

```tsx
          <Route path="teas" element={<AdminProdukty produktTyp="caje" nadpis="Čaje" />} />
          <Route path="nadobi" element={<AdminProdukty produktTyp="nadobi" nadpis="Nádobí" />} />
          <Route path="etnoshop" element={<AdminProdukty produktTyp="etnoshop" nadpis="Etnoshop" />} />
```

- [ ] **Step 5: Nav sidebar**

V `frontend/src/components/admin/AdminLayout.tsx` uprav `NAV_ITEMS` (řádky 5-11):

```ts
const NAV_ITEMS = [
  { to: '/admin', label: 'Přehled', end: true },
  { to: '/admin/sales', label: 'Tržby', end: false },
  { to: '/admin/teas', label: 'Čaje', end: false },
  { to: '/admin/nadobi', label: 'Nádobí', end: false },
  { to: '/admin/etnoshop', label: 'Etnoshop', end: false },
  { to: '/admin/kasa', label: 'Kasa', end: false },
  { to: '/admin/users', label: 'Uživatelé', end: false },
]
```

- [ ] **Step 6: Typecheck a testy**

Run: `cd frontend && npx tsc -b`
Expected: bez chyb.

Run: `cd frontend && npm run test`
Expected: PASS, celá sada (žádný existující test neederuje `pages/admin/Teas.tsx` přímo podle jména souboru — ověř grepem `grep -rn "admin/Teas" frontend/src` před smazáním, pro jistotu).

- [ ] **Step 7: Manuální ověření**

Přihlásit se jako admin, otevřít `/admin` — v nav vidět "Čaje", "Nádobí", "Etnoshop". Kliknout na "Nádobí" → vidět tabulku (prázdnou nebo naplněnou dle syncu) se sync tlačítkem. Kliknout na sync → zavolá `/api/admin/sheets-sync?sheet=nadobi`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/admin/ProduktyAdmin.tsx frontend/src/pages/admin/ProduktyAdmin.test.tsx frontend/src/router/AppRouter.tsx frontend/src/components/admin/AdminLayout.tsx
git rm frontend/src/pages/admin/Teas.tsx
git commit -m "feat(admin): ProduktyAdmin nahrazuje Teas, 3 routy pro caje/nadobi/etnoshop"
```

---

## Self-Review Checklist (pro implementátora, po dokončení všech tasků)

- Spec `docs/superpowers/specs/2026-07-08-nadobi-etnoshop-design.md` — pokryto: 2 nové tabulky beze změny `01_caje` (Task 1), zobecněný sync (Task 2-3), listovací endpointy (Task 4), zrušení FK + aplikační validace (Task 1, 5), 3 tlačítka na Home + sdílený košík (Task 7-8), admin katalogy se sync tlačítkem (Task 9). Dashboard/Tržby záměrně nedotčeny.
- Žádné `TODO`/placeholdery.
- Typová konzistence: `ProduktTyp` (Task 6) používaná shodně v `CajeCartItem.produktTyp`, `CajePolozkaSend.produkt_typ`, `useCajovnaPOS.produktTyp`, `goToCategories(typ)`, `CajeHome.onAddItem(typ)`, `PRODUKT_TABULKY` (PHP) — jména `produktTyp` (FE, camelCase) vs `PRODUKT_TYP`/`produkt_typ` (DB/API, jak je v projektu zvykem — `KATEGORIE`, `ZEME` apod. jsou také velkými písmeny v DB) jsou záměrně odlišná konvence mezi vrstvami, ne nekonzistence.
- Po Task 9 zkontrolovat, že nic jiného neederuje smazaný `frontend/src/pages/admin/Teas.tsx`.
