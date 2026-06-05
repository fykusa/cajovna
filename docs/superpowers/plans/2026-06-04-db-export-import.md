# Export / Import kompletní DB — Implementation Plan

> ✅ **DOKONČENO (2026-06-05, zmergováno do master, merge `adbf961`).** Všech 8 tasků hotovo. Navíc oproti plánu (na žádost uživatele): lidsky čitelný/editovatelný CSV formát (desetinná čárka u číselných sloupců, prázdné buňky místo `\N`), autodetekce kódování Windows-1250→UTF-8 přes `iconv`, tolerance českých/Excel formátů data při importu, kontrola struktury místo počtu řádků proti manifestu (umožní ruční přidávání/mazání řádků), kontextové chybové hlášky. Self-test rozšířen na 29 kontrol. Viz `.claude/tasks.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin může z Přehledu exportovat celou DB do ZIPu (CSV na tabulku) a selektivně ji importovat zpět s transakční bezpečností a kontrolou integrity FK.

**Architecture:** Čisté PHP přes PDO (bez `exec`/`mysqldump`). Sdílené jádro `backend/lib/db_transfer.php` používá HTTP endpoint (`backend/api/admin.php`) i CLI ověřovací skript. Frontend volá dva endpointy přes `fetch` (blob download / multipart upload), import přes `ImportDialog`.

**Tech Stack:** PHP 7.4, MySQL 5.7, PDO, `ZipArchive`; React 19 + TS, CSS Modules, vitest. PHP testy = spustitelné CLI assert-skripty v `backend/tools/` (projekt nemá PHPUnit).

**Spec:** `docs/superpowers/specs/2026-06-04-db-export-import-design.md`

---

## File Structure

- `backend/lib/db_transfer.php` — **nový.** Jádro: konstanty tabulek/skupin, čisté CSV funkce (serializace/parsování), čtení sloupců z DB, export do ZIP, import s transakcí a FK kontrolou. Bez HTTP/echo — jen funkce + výjimky.
- `backend/api/admin.php` — **nový.** HTTP routing `/api/admin/export` (stream ZIP) a `/api/admin/import` (multipart). `requireAdmin()`.
- `backend/.htaccess` — **úprava.** Přidat rewrite pro `api/admin`.
- `backend/tools/test_db_transfer.php` — **nový.** CLI assert-test čistých CSV funkcí (NULL `\N`, prázdný string, escaping). Bez DB.
- `backend/tools/verify_roundtrip.php` — **nový.** CLI: export → import do oddělené DB (vč. `users`) → porovnání tabulek 1:1.
- `frontend/src/api/admin.ts` — **nový.** `exportDatabase()`, `importDatabase(file, tables)`.
- `frontend/src/components/admin/ImportDialog.tsx` (+ `.module.css`) — **nový.** Modal importu.
- `frontend/src/components/admin/ImportDialog.test.tsx` — **nový.** Gating test.
- `frontend/src/pages/admin/Dashboard.tsx` — **úprava.** Dvě tlačítka + napojení.
- `frontend/src/pages/admin/Dashboard.module.css` — **úprava.** Styl tlačítek.

---

## Task 1: CSV serializace — čisté funkce + PHP self-test

**Files:**
- Create: `backend/lib/db_transfer.php`
- Create: `backend/tools/test_db_transfer.php`

- [ ] **Step 1: Vytvoř `backend/lib/db_transfer.php` se základem a čistými CSV funkcemi**

```php
<?php
// Jádro export/import DB. Pouze funkce + výjimky, žádné HTTP/echo.
require_once __DIR__ . '/../db.php';

// Kanonické pořadí tabulek (kvůli FK při importu).
const DBT_TABLES = ['users', 'tea_categories', 'teas', 'bags', 'sales', 'sale_items'];

// Logické skupiny pro selektivní import (users zde NIKDY není).
const DBT_GROUPS = [
    'categories' => ['tea_categories'],
    'teas'       => ['teas'],
    'bags'       => ['bags'],
    'sales'      => ['sales', 'sale_items'],
];

// NULL ↔ marker. Prázdný string zůstává "".
function dbtEncode($value): string {
    return $value === null ? '\\N' : (string) $value;
}
function dbtDecode(string $value) {
    return $value === '\\N' ? null : $value;
}

// Serializace řádků do CSV stringu (BOM + ;). escape='' → standardní CSV
// (zdvojení uvozovek), aby round-trip přes fgetcsv seděl.
function dbtRowsToCsv(array $cols, array $rows): string {
    $fh = fopen('php://temp', 'r+');
    fwrite($fh, "\xEF\xBB\xBF");
    fputcsv($fh, $cols, ';', '"', '');
    foreach ($rows as $row) {
        $line = [];
        foreach ($cols as $c) {
            $line[] = dbtEncode(array_key_exists($c, $row) ? $row[$c] : null);
        }
        fputcsv($fh, $line, ';', '"', '');
    }
    rewind($fh);
    $out = stream_get_contents($fh);
    fclose($fh);
    return $out;
}

// Parsování CSV stringu → [header[], rows[][]] (řádky jako poziční pole).
function dbtParseCsv(string $csv): array {
    $fh = fopen('php://temp', 'r+');
    fwrite($fh, $csv);
    rewind($fh);
    $header = fgetcsv($fh, 0, ';', '"', '');
    if ($header && isset($header[0])) {
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // strip BOM
    }
    $rows = [];
    while (($line = fgetcsv($fh, 0, ';', '"', '')) !== false) {
        if ($line === [null] || $line === false) continue; // prázdný řádek
        $rows[] = $line;
    }
    fclose($fh);
    return [$header ?: [], $rows];
}
```

- [ ] **Step 2: Vytvoř `backend/tools/test_db_transfer.php`**

```php
<?php
require_once __DIR__ . '/../lib/db_transfer.php';

$failed = 0;
function check(string $name, bool $cond): void {
    global $failed;
    echo ($cond ? "PASS" : "FAIL") . " — $name\n";
    if (!$cond) $failed++;
}

// encode/decode
check('encode null → \\N', dbtEncode(null) === '\\N');
check('encode "" → ""', dbtEncode('') === '');
check('decode \\N → null', dbtDecode('\\N') === null);
check('decode "" → ""', dbtDecode('') === '');

// round-trip s NULL, prázdným stringem a speciálními znaky
$cols = ['id', 'name', 'note'];
$rows = [
    ['id' => '1', 'name' => 'Bílý čaj', 'note' => null],
    ['id' => '2', 'name' => '', 'note' => 'a;b "c"' . "\n" . 'd'],
];
$csv = dbtRowsToCsv($cols, $rows);
[$h, $r] = dbtParseCsv($csv);

check('header sedí', $h === ['id', 'name', 'note']);
check('řádek 1: note je \\N v CSV → decode null', dbtDecode($r[0][2]) === null);
check('řádek 2: prázdné name zůstává ""', dbtDecode($r[1][1]) === '');
check('řádek 2: escaping ; " newline', dbtDecode($r[1][2]) === 'a;b "c"' . "\n" . 'd');
check('počet řádků 2', count($r) === 2);

echo $failed === 0 ? "\nVŠE OK\n" : "\n$failed SELHALO\n";
exit($failed === 0 ? 0 : 1);
```

- [ ] **Step 3: Spusť test — musí projít**

Run: `docker compose exec -T php php tools/test_db_transfer.php`
Expected: výpis `PASS …` pro všech 9 kontrol a `VŠE OK`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/lib/db_transfer.php backend/tools/test_db_transfer.php
git commit -m "feat(backend): CSV serializace pro export/import DB + self-test"
```

---

## Task 2: DB čtení sloupců + export do ZIP

**Files:**
- Modify: `backend/lib/db_transfer.php`

- [ ] **Step 1: Přidej čtení sloupců a zápis CSV tabulky z DB**

Přidej do `backend/lib/db_transfer.php`:

```php
// Názvy sloupců tabulky v pořadí dle schématu (přežije přidání sloupce).
function dbtColumns(PDO $pdo, string $table): array {
    $stmt = $pdo->prepare(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION'
    );
    $stmt->execute([$table]);
    return array_column($stmt->fetchAll(), 'COLUMN_NAME');
}

// CSV jedné tabulky z DB (řazeno dle id pro determinismus). Vrací [csv, count].
function dbtTableCsv(PDO $pdo, string $table): array {
    $cols = dbtColumns($pdo, $table);
    $rows = $pdo->query('SELECT * FROM `' . $table . '` ORDER BY `id`')->fetchAll();
    return [dbtRowsToCsv($cols, $rows), count($rows)];
}
```

- [ ] **Step 2: Přidej export do ZIP**

Přidej do `backend/lib/db_transfer.php`:

```php
// Vytvoří ZIP se všemi tabulkami + manifest.json. Vrací manifest pole.
function dbtExportZip(PDO $pdo, string $zipPath): array {
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Nelze vytvořit ZIP soubor.');
    }
    $counts = [];
    foreach (DBT_TABLES as $table) {
        [$csv, $n] = dbtTableCsv($pdo, $table);
        $zip->addFromString($table . '.csv', $csv);
        $counts[$table] = $n;
    }
    $manifest = [
        'format_version' => 1,
        'exported_at'    => date('Y-m-d H:i:s'),
        'db_name'        => $pdo->query('SELECT DATABASE()')->fetchColumn(),
        'row_counts'     => $counts,
    ];
    $zip->addFromString(
        'manifest.json',
        json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );
    $zip->close();
    return $manifest;
}
```

- [ ] **Step 2b: Smoke-test exportu proti živé DB**

Run:
```bash
docker compose exec -T php php -r 'require "lib/db_transfer.php"; $m = dbtExportZip(getPDO(), "/tmp/exp.zip"); echo json_encode($m["row_counts"]), "\n"; echo filesize("/tmp/exp.zip"), " bytes\n";'
```
Expected: JSON s počty řádků (např. `{"users":5,"teas":294,...}`) a nenulová velikost ZIPu.

- [ ] **Step 3: Commit**

```bash
git add backend/lib/db_transfer.php
git commit -m "feat(backend): export celé DB do ZIP (CSV na tabulku + manifest)"
```

---

## Task 3: Import — validace, transakce, kontrola integrity

**Files:**
- Modify: `backend/lib/db_transfer.php`

- [ ] **Step 1: Přidej pomocné funkce (úklid, insert, integrita)**

Přidej do `backend/lib/db_transfer.php`:

```php
function dbtCleanup(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') continue;
        unlink($dir . '/' . $f);
    }
    rmdir($dir);
}

// Vloží řádky (poziční pole dle $header) do tabulky. \N → NULL, explicitní id.
function dbtInsertRows(PDO $pdo, string $table, array $header, array $rows): int {
    if (empty($rows)) return 0;
    $colList = '`' . implode('`,`', $header) . '`';
    $ph = '(' . implode(',', array_fill(0, count($header), '?')) . ')';
    $stmt = $pdo->prepare("INSERT INTO `$table` ($colList) VALUES $ph");
    foreach ($rows as $row) {
        $stmt->execute(array_map('dbtDecode', $row));
    }
    return count($rows);
}

// Ověří, že žádná FK vazba není osiřelá. Při nálezu vyhodí výjimku.
function dbtCheckIntegrity(PDO $pdo): void {
    // [dítě, fk sloupec, rodič, pk, nullable]
    $checks = [
        ['teas',           'category_id', 'tea_categories', 'id', false],
        ['sale_items',     'tea_id',      'teas',           'id', true],
        ['sale_items',     'bag_id',      'bags',           'id', true],
        ['sale_items',     'sale_id',     'sales',          'id', false],
        ['sales',          'user_id',     'users',          'id', false],
        ['tea_categories', 'parent_id',   'tea_categories', 'id', true],
    ];
    foreach ($checks as [$child, $fk, $parent, $pk, $nullable]) {
        $nullClause = $nullable ? "c.`$fk` IS NOT NULL AND " : '';
        $sql = "SELECT c.`$fk` FROM `$child` c
                LEFT JOIN `$parent` p ON c.`$fk` = p.`$pk`
                WHERE {$nullClause}p.`$pk` IS NULL LIMIT 1";
        $orphan = $pdo->query($sql)->fetchColumn();
        if ($orphan !== false) {
            throw new RuntimeException(
                "Narušená integrita: `$child` odkazuje na neexistující `$fk` $orphan."
            );
        }
    }
}
```

- [ ] **Step 2: Přidej hlavní import (po tabulkách) + mapování skupin**

Přidej do `backend/lib/db_transfer.php`:

```php
// Import konkrétního seznamu tabulek z rozbaleného adresáře. Sdílí HTTP i CLI.
function dbtImportTables(PDO $pdo, string $dir, array $tables): array {
    // seřaď dle kanonického pořadí
    $tables = array_values(array_filter(DBT_TABLES, fn($t) => in_array($t, $tables, true)));
    if (empty($tables)) {
        throw new RuntimeException('Nevybrána žádná data k importu.');
    }

    $manifestPath = $dir . '/manifest.json';
    if (!is_file($manifestPath)) {
        throw new RuntimeException('V archivu chybí manifest.json.');
    }
    $manifest = json_decode(file_get_contents($manifestPath), true);
    if (!is_array($manifest)) {
        throw new RuntimeException('Neplatný manifest.json.');
    }

    // VALIDACE (před jakýmkoli zápisem)
    $parsed = [];
    foreach ($tables as $table) {
        $csvPath = $dir . '/' . $table . '.csv';
        if (!is_file($csvPath)) {
            throw new RuntimeException("V archivu chybí $table.csv.");
        }
        [$header, $rows] = dbtParseCsv(file_get_contents($csvPath));
        $dbCols = dbtColumns($pdo, $table);
        if (array_diff($header, $dbCols) || array_diff($dbCols, $header)) {
            throw new RuntimeException("Sloupce v $table.csv neodpovídají databázi.");
        }
        $expected = $manifest['row_counts'][$table] ?? null;
        if ($expected !== null && count($rows) !== (int) $expected) {
            throw new RuntimeException("$table.csv: počet řádků nesedí s manifestem.");
        }
        $parsed[$table] = [$header, $rows];
    }

    // TRANSAKCE
    $imported = [];
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->beginTransaction();
    try {
        foreach (array_reverse($tables) as $table) {
            $pdo->exec('DELETE FROM `' . $table . '`');
        }
        foreach ($tables as $table) {
            [$header, $rows] = $parsed[$table];
            $imported[$table] = dbtInsertRows($pdo, $table, $header, $rows);
        }
        dbtCheckIntegrity($pdo);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    } finally {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
    return $imported;
}

// Import z nahraného ZIPu podle vybraných skupin (users se ignoruje).
function dbtImportZip(PDO $pdo, string $zipPath, array $groups): array {
    $tables = [];
    foreach ($groups as $g) {
        foreach (DBT_GROUPS[$g] ?? [] as $t) {
            $tables[] = $t;
        }
    }
    if (empty($tables)) {
        throw new RuntimeException('Nevybrána žádná data k importu.');
    }

    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) {
        throw new RuntimeException('Soubor není platný ZIP archiv.');
    }
    $dir = sys_get_temp_dir() . '/dbt_' . uniqid();
    mkdir($dir);
    $zip->extractTo($dir);
    $zip->close();

    try {
        return dbtImportTables($pdo, $dir, $tables);
    } finally {
        dbtCleanup($dir);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/lib/db_transfer.php
git commit -m "feat(backend): selektivní import DB s transakcí a kontrolou integrity FK"
```

---

## Task 4: Round-trip ověřovací CLI skript

**Files:**
- Create: `backend/tools/verify_roundtrip.php`

- [ ] **Step 1: Vytvoř `backend/tools/verify_roundtrip.php`**

```php
<?php
// Ověří, že export+import je 1:1. Spuštění:
//   docker compose exec -T php php tools/verify_roundtrip.php <verify_db>
// Vytvoří/přepíše <verify_db>, naimportuje do ní export a porovná s ostrou DB.
require_once __DIR__ . '/../lib/db_transfer.php';

$verifyDb = $argv[1] ?? null;
if (!$verifyDb) {
    fwrite(STDERR, "Použití: verify_roundtrip.php <verify_db_name>\n");
    exit(2);
}

$src = getPDO();
$srcDbName = $src->query('SELECT DATABASE()')->fetchColumn();

// Připojení bez konkrétní DB (na vytvoření verify DB).
$root = new PDO(
    sprintf('mysql:host=%s;charset=%s', DB_HOST, DB_CHARSET),
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);
$root->exec("DROP DATABASE IF EXISTS `$verifyDb`");
$root->exec("CREATE DATABASE `$verifyDb` CHARACTER SET utf8mb4");
$root->exec("USE `$verifyDb`");
// schéma (víc příkazů)
foreach (array_filter(array_map('trim', explode(';', file_get_contents(__DIR__ . '/../../db/schema.sql')))) as $stmt) {
    if ($stmt !== '') $root->exec($stmt);
}

// 1) export ostré DB
$zip = sys_get_temp_dir() . '/verify_' . uniqid() . '.zip';
dbtExportZip($src, $zip);

// 2) import VŠECH tabulek (vč. users) do verify DB
$verify = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, $verifyDb, DB_CHARSET),
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);
$dir = sys_get_temp_dir() . '/dbt_verify_' . uniqid();
mkdir($dir);
$z = new ZipArchive();
$z->open($zip);
$z->extractTo($dir);
$z->close();
dbtImportTables($verify, $dir, DBT_TABLES);
dbtCleanup($dir);
unlink($zip);

// 3) porovnání tabulek řádek po řádku
$diffs = 0;
foreach (DBT_TABLES as $table) {
    $a = $src->query("SELECT * FROM `$srcDbName`.`$table` ORDER BY `id`")->fetchAll();
    $b = $verify->query("SELECT * FROM `$table` ORDER BY `id`")->fetchAll();
    if ($a === $b) {
        echo "OK    $table (" . count($a) . " řádků)\n";
    } else {
        echo "DIFF  $table — zdroj " . count($a) . " vs verify " . count($b) . " řádků\n";
        $diffs++;
    }
}

echo $diffs === 0 ? "\n1:1 SHODA\n" : "\n$diffs TABULEK SE LIŠÍ\n";
exit($diffs === 0 ? 0 : 1);
```

- [ ] **Step 2: Spusť ověření proti živé DB**

Run: `docker compose exec -T php php tools/verify_roundtrip.php verify_tmp`
Expected: `OK …` pro všech 6 tabulek a `1:1 SHODA`, exit 0.

> Pozn.: `verify_tmp` se DROP+CREATE pokaždé. Pokud DB uživatel nemá právo
> `CREATE DATABASE`, spusť skript s rootem (`mysql -uroot`) nebo verify DB
> vytvoř ručně předem a v skriptu vynech `DROP/CREATE DATABASE`.

- [ ] **Step 3: Commit**

```bash
git add backend/tools/verify_roundtrip.php
git commit -m "test(backend): round-trip ověření export/import 1:1 (CLI)"
```

---

## Task 5: HTTP endpointy + routing

**Files:**
- Create: `backend/api/admin.php`
- Modify: `backend/.htaccess`

- [ ] **Step 1: Vytvoř `backend/api/admin.php`**

```php
<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../lib/db_transfer.php';

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(204);
    exit;
}

requireAdmin();

if ($method === 'GET' && preg_match('#/api/admin/export$#', $path)) {
    handleExport();
} elseif ($method === 'POST' && preg_match('#/api/admin/import$#', $path)) {
    handleImport();
} else {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function handleExport(): void {
    $zipPath = tempnam(sys_get_temp_dir(), 'exp');
    try {
        dbtExportZip(getPDO(), $zipPath);
        $name = 'cajovna-zaloha-' . date('Y-m-d') . '.zip';
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Content-Length: ' . filesize($zipPath));
        readfile($zipPath);
    } finally {
        @unlink($zipPath);
    }
}

function handleImport(): void {
    header('Content-Type: application/json; charset=utf-8');
    if (empty($_FILES['file']['tmp_name']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí nahraný soubor.']);
        return;
    }
    $groups = json_decode($_POST['tables'] ?? '[]', true);
    if (!is_array($groups)) $groups = [];
    // 'users' není mezi DBT_GROUPS → nelze ho importovat ani omylem.
    try {
        $imported = dbtImportZip(getPDO(), $_FILES['file']['tmp_name'], $groups);
        echo json_encode(['imported' => $imported]);
    } catch (Throwable $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
```

- [ ] **Step 2: Přidej rewrite do `backend/.htaccess`**

Najdi blok s `RewriteRule` pro ostatní api (např. `^api/categories…`) a přidej **před** obecný/catch-all řádek:

```apache
RewriteRule ^api/admin(/.*)?$ api/admin.php [QSA,L]
```

- [ ] **Step 3: Ověř export endpoint (vrací ZIP)**

Run (token nahraď reálným admin JWT z DevTools → Application → Local Storage):
```bash
docker compose exec -T php sh -c 'echo "ručně otestovat z prohlížeče/Postmanu"'
```
Ruční ověření: v prohlížeči přihlášený jako admin otevři `http://localhost:8080/api/admin/export` s hlavičkou Authorization — nebo to ověříme až z UI v Tasku 8. Expected: stáhne se `cajovna-zaloha-*.zip`.

- [ ] **Step 4: Commit**

```bash
git add backend/api/admin.php backend/.htaccess
git commit -m "feat(backend): HTTP endpointy /api/admin/export a /import"
```

---

## Task 6: Frontend API klient

**Files:**
- Create: `frontend/src/api/admin.ts`

- [ ] **Step 1: Zjisti, jak se čte token**

Otevři `frontend/src/api/client.ts` a najdi, odkud `apiFetch` bere JWT (z `useAuthStore`/`localStorage`). Použij stejný zdroj. V tomto projektu je token v zustand store persistovaném do `localStorage` pod klíčem auth storu.

- [ ] **Step 2: Vytvoř `frontend/src/api/admin.ts`**

```ts
import { useAuthStore } from '../store/authStore'
import { ApiError } from './client'

export interface ImportResult {
  imported: Record<string, number>
}

function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Stáhne ZIP zálohy celé DB. */
export async function exportDatabase(): Promise<void> {
  const res = await fetch('/api/admin/export', { headers: { ...authHeader() } })
  if (!res.ok) {
    throw new ApiError(res.status, 'Export se nezdařil')
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const m = cd.match(/filename="([^"]+)"/)
  const name = m ? m[1] : `cajovna-zaloha-${new Date().toISOString().slice(0, 10)}.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Nahraje ZIP a naimportuje vybrané skupiny (categories|teas|bags|sales). */
export async function importDatabase(file: File, tables: string[]): Promise<ImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('tables', JSON.stringify(tables))
  const res = await fetch('/api/admin/import', {
    method: 'POST',
    headers: { ...authHeader() }, // bez Content-Type → browser nastaví multipart boundary
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Import se nezdařil')
  }
  return data as ImportResult
}
```

- [ ] **Step 3: Ověř, že `useAuthStore.getState().token` existuje**

Run: `cd frontend && npx tsc --noEmit`
Expected: žádné chyby (pokud má store jiný název pole pro token, oprav `authHeader`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat(frontend): API klient pro export/import DB"
```

---

## Task 7: ImportDialog komponenta + test

**Files:**
- Create: `frontend/src/components/admin/ImportDialog.tsx`
- Create: `frontend/src/components/admin/ImportDialog.module.css`
- Create: `frontend/src/components/admin/ImportDialog.test.tsx`

- [ ] **Step 1: Napiš failing test `ImportDialog.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportDialog from './ImportDialog'
import * as adminApi from '../../api/admin'

vi.mock('../../api/admin', () => ({ importDatabase: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

function selectFile(input: HTMLInputElement, user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['x'], 'zaloha.zip', { type: 'application/zip' })
  return user.upload(input, file)
}

describe('ImportDialog', () => {
  it('Importovat je disabled bez souboru a bez potvrzení', () => {
    render(<ImportDialog onClose={() => {}} onDone={() => {}} />)
    expect(screen.getByRole('button', { name: 'Importovat' })).toBeDisabled()
  })

  it('users checkbox neexistuje', () => {
    render(<ImportDialog onClose={() => {}} onDone={() => {}} />)
    expect(screen.queryByLabelText(/uživatel/i)).not.toBeInTheDocument()
  })

  it('po vybrání souboru a napsání NAHRADIT zavolá importDatabase s vybranými skupinami', async () => {
    vi.mocked(adminApi.importDatabase).mockResolvedValueOnce({ imported: { teas: 1 } })
    const onDone = vi.fn()
    const user = userEvent.setup()
    render(<ImportDialog onClose={() => {}} onDone={onDone} />)

    await selectFile(screen.getByTestId('import-file') as HTMLInputElement, user)
    await user.type(screen.getByPlaceholderText('NAHRADIT'), 'NAHRADIT')
    await user.click(screen.getByRole('button', { name: 'Importovat' }))

    expect(adminApi.importDatabase).toHaveBeenCalledWith(
      expect.any(File),
      ['categories', 'teas', 'bags'] // default zaškrtnuté, prodeje vypnuté
    )
  })
})
```

- [ ] **Step 2: Spusť test — musí selhat**

Run: `cd frontend && npm run test -- --run ImportDialog`
Expected: FAIL (komponenta neexistuje).

- [ ] **Step 3: Vytvoř `ImportDialog.module.css`**

```css
.form { display: flex; flex-direction: column; gap: 14px; }
.group { display: flex; flex-direction: column; gap: 8px; }
.check { display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 0.95rem; cursor: pointer; }
.warn { color: #e0b050; font-size: 0.85rem; background: #3a2f15; padding: 8px 10px; border-radius: 4px; }
.error { color: #f87171; font-size: 0.9rem; }
.confirm { padding: 8px 12px; background: #333; border: 1px solid #555; border-radius: 4px; color: #eee; font-size: 1rem; }
.actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
.submitBtn { padding: 9px 20px; background: #c0524f; color: #fff; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; }
.submitBtn:disabled { opacity: 0.5; cursor: not-allowed; }
.cancelBtn { padding: 9px 18px; background: #444; color: #eee; border: none; border-radius: 4px; cursor: pointer; }
```

- [ ] **Step 4: Vytvoř `ImportDialog.tsx`**

```tsx
import { useState } from 'react'
import Modal from '../Modal'
import { importDatabase } from '../../api/admin'
import { useToast } from '../toast/useToast'
import styles from './ImportDialog.module.css'

interface Props {
  onClose: () => void
  onDone: () => void
}

const GROUPS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'categories', label: 'Kategorie', defaultOn: true },
  { key: 'teas', label: 'Čaje', defaultOn: true },
  { key: 'bags', label: 'Pytlíky', defaultOn: true },
  { key: 'sales', label: 'Prodeje (restore)', defaultOn: false },
]

export default function ImportDialog({ onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(GROUPS.filter((g) => g.defaultOn).map((g) => g.key))
  )
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const tables = GROUPS.filter((g) => selected.has(g.key)).map((g) => g.key)
  const canSubmit = !!file && confirm === 'NAHRADIT' && tables.length > 0 && !busy

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const res = await importDatabase(file, tables)
      const summary = Object.entries(res.imported)
        .map(([t, n]) => `${t}: ${n}`)
        .join(', ')
      toast.success(`Import dokončen — ${summary}`)
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import se nezdařil')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Import databáze" onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.warn}>
          Import přepíše vybrané tabulky daty ze souboru. Uživatelé se neimportují.
          Prodeje obnovuj jen pokud odpovídající uživatelé v databázi existují.
        </p>

        <input
          data-testid="import-file"
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className={styles.group}>
          {GROUPS.map((g) => (
            <label key={g.key} className={styles.check}>
              <input
                type="checkbox"
                checked={selected.has(g.key)}
                onChange={() => toggle(g.key)}
              />
              {g.label}
            </label>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <input
          className={styles.confirm}
          placeholder="NAHRADIT"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            Importovat
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Zrušit
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 5: Spusť test — musí projít**

Run: `cd frontend && npm run test -- --run ImportDialog`
Expected: 3 testy PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/ImportDialog.tsx frontend/src/components/admin/ImportDialog.module.css frontend/src/components/admin/ImportDialog.test.tsx
git commit -m "feat(frontend): ImportDialog s výběrem dat a potvrzením NAHRADIT"
```

---

## Task 8: Napojení do Dashboardu

**Files:**
- Modify: `frontend/src/pages/admin/Dashboard.tsx`
- Modify: `frontend/src/pages/admin/Dashboard.module.css`

- [ ] **Step 1: Přidej import, stav a handlery do `Dashboard.tsx`**

Na začátek importů přidej:

```tsx
import ImportDialog from '../../components/admin/ImportDialog'
import { exportDatabase } from '../../api/admin'
```

V komponentě `AdminDashboard` přidej vedle ostatních `useState`:

```tsx
const [showImport, setShowImport] = useState(false)
```

A handler exportu (vedle `handleExport`):

```tsx
async function handleExportDb() {
  try {
    await exportDatabase()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export se nezdařil')
  }
}
```

- [ ] **Step 2: Přidej tlačítka do hlavičky a modal na konec**

V `<form className={styles.rangeForm}>` za `Export CSV` tlačítko přidej:

```tsx
          <button type="button" className={styles.dbBtn} onClick={handleExportDb}>Export DB</button>
          <button type="button" className={styles.dbBtn} onClick={() => setShowImport(true)}>Import DB</button>
```

Před uzavírací `</div>` celé stránky (poslední řádek `return`u) přidej:

```tsx
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onDone={() => load(from, to, selectedCategory, selectedTea)}
        />
      )}
```

- [ ] **Step 3: Přidej styl `.dbBtn` do `Dashboard.module.css`**

```css
.dbBtn {
  padding: 6px 14px;
  background: #3a3a3a;
  color: #ddd;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.dbBtn:hover { background: #454545; }
```

- [ ] **Step 4: Ověř typy a testy**

Run: `cd frontend && npx tsc --noEmit && npm run test -- --run`
Expected: tsc bez chyb, všechny testy PASS.

- [ ] **Step 5: Ruční ověření v prohlížeči**

Přihlaš se jako admin → Přehled → **Export DB** stáhne ZIP. **Import DB** otevře dialog; vyber stažený ZIP, nech zaškrtnuté kmenové tabulky, napiš `NAHRADIT`, Importovat → success toast, data se znovu načtou.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Dashboard.tsx frontend/src/pages/admin/Dashboard.module.css
git commit -m "feat(admin): tlačítka Export DB / Import DB v Přehledu"
```

---

## Závěrečné kroky

- [ ] Spusť `backend/tools/verify_roundtrip.php verify_tmp` ještě jednou na finální shodu 1:1.
- [ ] Spusť celou frontend sadu: `cd frontend && npm run test -- --run` (vše zelené).
- [ ] Aktualizuj `.claude/tasks.md` — přesuň úkol do Hotovo.
- [ ] Použij superpowers:finishing-a-development-branch.

## Poznámky k nasazení (mimo tento plán, pro deploy)

- Na ostrém hostingu ověř `upload_max_filesize`/`post_max_size` ≥ 16 MB a `memory_limit` ≥ 128 MB.
- `verify_roundtrip.php` vyžaduje právo `CREATE DATABASE` — na sdíleném hostingu spusť proti ručně vytvořené prázdné verify DB (vynech `DROP/CREATE DATABASE`).
