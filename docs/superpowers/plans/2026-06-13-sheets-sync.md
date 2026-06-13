# Google Sheets → DB Sync (Fáze 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Záložka CAJE v Google Sheets se při každé editaci automaticky synchronizuje do tabulky `01_caje` v MySQL přes PHP endpoint, který může zavolat jak Apps Script (token), tak admin ručně (tlačítko v Dashboardu).

**Architecture:** Apps Script onEdit → POST `/api/admin/sheets-sync` s `X-Sync-Token`; PHP endpoint stáhne CSV záložky CAJE (published URL), přeskočí hlavičkové řádky 1+2, extrahuje 13 sloupců (A,B,C,D,E,F,G,J,K,N,O,R,S), provede TRUNCATE + batch INSERT do `01_caje`. Manuální tlačítko v Dashboardu volá stejný endpoint přes admin session.

**Tech Stack:** PHP 7.4 (no Composer), MySQL 5.7 (InnoDB), React/TypeScript (Vite), Vitest, Google Apps Script

---

## Soubory

| Soubor | Akce |
|---|---|
| `backend/config/sheets.php` | CREATE — CSV URL + sync token (gitignore) |
| `backend/config/sheets.example.php` | CREATE — šablona bez citlivých dat (do gitu) |
| `backend/lib/sheets_sync.php` | CREATE — sync logika |
| `backend/api/admin.php` | MODIFY — přidat route sheets-sync před requireAdmin() |
| `tools/test_sheets_sync.php` | CREATE — CLI test sync logiky |
| `frontend/src/api/admin.ts` | MODIFY — přidat syncFromSheets() |
| `frontend/src/pages/admin/Dashboard.tsx` | MODIFY — přidat tlačítko + stav |
| `.gitignore` (backend) | MODIFY — přidat config/sheets.php |

---

## Task 1: Konfigurační soubor + gitignore

**Files:**
- Create: `backend/config/sheets.php`
- Create: `backend/config/sheets.example.php`
- Modify: `backend/.gitignore` (nebo root `.gitignore`)

- [ ] **Zkontroluj zda existuje `backend/.gitignore`**

```bash
ls backend/.gitignore 2>/dev/null || echo "neexistuje"
```

- [ ] **Přidej `config/sheets.php` do gitignore**

Pokud `backend/.gitignore` neexistuje, přidej řádek do kořenového `.gitignore`. Pokud kořenový `.gitignore` nezná backend adresář, přidej:
```
backend/config/sheets.php
```

- [ ] **Vytvoř `backend/config/sheets.example.php`**

```php
<?php
// Zkopíruj tento soubor na config/sheets.php a vyplň hodnoty.
// config/sheets.php NESMÍ být v gitu (je v .gitignore).
return [
    // Sdílené tajemství mezi Apps Script a serverem.
    // Nastav stejnou hodnotu v Apps Script Project Settings → Script Properties → SYNC_TOKEN.
    'sync_token' => 'REPLACE_WITH_RANDOM_SECRET',

    // URL záložky CAJE publikované jako CSV.
    // Google Sheets → Soubor → Sdílet → Publikovat na webu → záložka CAJE → CSV → Publikovat.
    'caje_csv_url' => 'https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub?gid=GID&single=true&output=csv',
];
```

- [ ] **Vytvoř `backend/config/sheets.php`** (lokálně, s reálnými hodnotami)

```php
<?php
return [
    'sync_token'   => 'VYGENERUJ_NAHODNY_RETEZEC_MIN_32_ZNAKU',
    'caje_csv_url' => '',  // vyplnit po publikování záložky v Google Sheets
];
```

> **Jak vygenerovat token:** `php -r "echo bin2hex(random_bytes(24));"`

- [ ] **Commitni příklad konfigurace (sheets.php se NEcommituje)**

```bash
git add backend/config/sheets.example.php .gitignore
git commit -m "config: přidat šablonu konfigurace pro Google Sheets sync"
```

---

## Task 2: PHP sync logika — `backend/lib/sheets_sync.php`

**Files:**
- Create: `backend/lib/sheets_sync.php`

Logika: stáhni CSV → přeskočí řádky 1+2 → extrahuj sloupce → TRUNCATE + INSERT.

**Indexy sloupců v sheetu (0-based):**
`A=0, B=1, C=2, D=3, E=4, F=5, G=6, J=9, K=10, N=13, O=14, R=17, S=18`

- [ ] **Vytvoř `backend/lib/sheets_sync.php`**

```php
<?php
// Sync záložky CAJE z Google Sheets → tabulka `01_caje`.
// Používá dbtToUtf8 a dbtParseCsv z db_transfer.php.
require_once __DIR__ . '/db_transfer.php';

// Indexy sloupců v sheetu, které bereme (0-based, A=0).
const SHEETS_COL_INDICES = [0, 1, 2, 3, 4, 5, 6, 9, 10, 13, 14, 17, 18];
const SHEETS_COL_NAMES   = ['KATEGORIE', 'ZEME', 'AKTIV', 'NAZEV', 'POZNAMKA',
                             'MN1', 'CENA1', 'MN2', 'CENA2', 'MN3', 'CENA3', 'MN4', 'CENA4'];

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
 * Hlavní sync: stáhne CSV, parsuje, TRUNCATE + INSERT do 01_caje.
 * Vrací ['inserted' => N].
 */
function sheetsSyncCaje(PDO $pdo, string $csvUrl): array {
    $raw = sheetsFetchCsv($csvUrl);
    $utf = dbtToUtf8($raw);

    [$allRows] = parseCajeRows($utf);

    $pdo->beginTransaction();
    try {
        $pdo->exec('TRUNCATE TABLE `01_caje`');
        $inserted = insertCajeRows($pdo, $allRows);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return ['inserted' => $inserted];
}

/**
 * Parsuje CSV string záložky CAJE.
 * Řádek 1 = zobrazovací hlavička (přeskočit).
 * Řádek 2 = DB názvy sloupců (přeskočit).
 * Řádky 3+ = data.
 * Vrací [rows] kde každý row je asociativní pole dle SHEETS_COL_NAMES.
 */
function parseCajeRows(string $csvUtf8): array {
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
        foreach (SHEETS_COL_INDICES as $i => $colIdx) {
            $colName = SHEETS_COL_NAMES[$i];
            $val     = isset($line[$colIdx]) ? trim($line[$colIdx]) : '';
            $row[$colName] = $val === '' ? null : $val;
        }
        // Přeskočit řádky bez názvu (NAZEV je prázdné)
        if ($row['NAZEV'] === null) continue;

        $rows[] = $row;
    }
    fclose($fh);
    return [$rows];
}

/**
 * Vloží řádky do 01_caje. Vrací počet vložených.
 */
function insertCajeRows(PDO $pdo, array $rows): int {
    if (empty($rows)) return 0;

    $cols = SHEETS_COL_NAMES;
    $ph   = '(' . implode(',', array_fill(0, count($cols), '?')) . ')';
    $sql  = 'INSERT INTO `01_caje` (`' . implode('`,`', $cols) . '`) VALUES ' . $ph;
    $stmt = $pdo->prepare($sql);

    foreach ($rows as $row) {
        $vals = array_map(fn($c) => $row[$c] ?? null, $cols);
        $stmt->execute($vals);
    }
    return count($rows);
}
```

- [ ] **Commitni**

```bash
git add backend/lib/sheets_sync.php
git commit -m "feat(sheets): PHP sync logika pro záložku CAJE"
```

---

## Task 3: CLI test sync logiky

**Files:**
- Create: `tools/test_sheets_sync.php`

Test ověří parsování CSV s lokálním vzorkem (bez volání Googlu).

- [ ] **Vytvoř `tools/test_sheets_sync.php`**

```php
<?php
require_once __DIR__ . '/../backend/lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// --- Testovací CSV (simuluje záložku CAJE) ---
// Řádek 1: zobrazovací hlavičky (18+ sloupců)
// Řádek 2: DB názvy sloupců
// Řádek 3+: data
//
// Sloupce A-S (0-based): bereme 0,1,2,3,4,5,6,9,10,13,14,17,18
// Vyplníme všechny sloupce 0-18, ostatní dáme jako prázdné.

function makeCsvLine(array $vals, int $totalCols = 19): string {
    $padded = array_pad($vals, $totalCols, '');
    return implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $padded));
}

$header1 = makeCsvLine(['Standart','','','','','','','','','Větší','','','','Největší','','','','V čajovně','']);
$header2 = makeCsvLine(['KATEGORIE','ZEME','AKTIV','NAZEV','POZNAMKA','MN1','CENA1','','','MN2','CENA2','','','MN3','CENA3','','','MN4','CENA4']);

// Řádek 3: plný řádek
$data1 = makeCsvLine(['BÍLÝ','ČÍNA','x','Show Mee','','30','130','','','200','700','','','500','1680','','','7','98']);
// Řádek 4: bez NAZEV → má být přeskočen
$data2 = makeCsvLine(['','','','','','','','','','','','','','','','','','','']);
// Řádek 5: aktivní=prázdné (neaktivní)
$data3 = makeCsvLine(['ZELENÉ','JAPONSKO','','Gyokuro','Poznámka test','40','200','','','200','800','','','','','','','20','150']);

$csv = implode("\n", [$header1, $header2, $data1, $data2, $data3]);

// --- Testy ---
[$rows] = parseCajeRows($csv);

ok('parsuje 2 řádky (prázdný přeskočen)', count($rows) === 2);

$r1 = $rows[0];
ok('KATEGORIE = BÍLÝ',    $r1['KATEGORIE'] === 'BÍLÝ');
ok('ZEME = ČÍNA',         $r1['ZEME'] === 'ČÍNA');
ok('AKTIV = x',           $r1['AKTIV'] === 'x');
ok('NAZEV = Show Mee',    $r1['NAZEV'] === 'Show Mee');
ok('POZNAMKA = null',     $r1['POZNAMKA'] === null);
ok('MN1 = 30',            $r1['MN1'] === '30');
ok('CENA1 = 130',         $r1['CENA1'] === '130');
ok('MN2 = 200 (sloupec J)', $r1['MN2'] === '200');
ok('CENA2 = 700 (sloupec K)', $r1['CENA2'] === '700');
ok('MN3 = 500 (sloupec N)', $r1['MN3'] === '500');
ok('CENA3 = 1680 (sloupec O)', $r1['CENA3'] === '1680');
ok('MN4 = 7 (sloupec R)', $r1['MN4'] === '7');
ok('CENA4 = 98 (sloupec S)', $r1['CENA4'] === '98');

$r2 = $rows[1];
ok('řádek 2 NAZEV = Gyokuro', $r2['NAZEV'] === 'Gyokuro');
ok('řádek 2 AKTIV = null (neaktivní)', $r2['AKTIV'] === null);
ok('řádek 2 POZNAMKA = Poznámka test', $r2['POZNAMKA'] === 'Poznámka test');
ok('řádek 2 MN3 = null (prázdné)', $r2['MN3'] === null);

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
```

- [ ] **Spusť test a ověř, že vše projde**

```bash
php tools/test_sheets_sync.php
```

Očekávaný výstup:
```
PASS: parsuje 2 řádky (prázdný přeskočen)
PASS: KATEGORIE = BÍLÝ
...
17 passed, 0 failed
```

- [ ] **Commitni**

```bash
git add tools/test_sheets_sync.php
git commit -m "test(sheets): CLI test parsování CSV záložky CAJE"
```

---

## Task 4: Backend endpoint — `backend/api/admin.php`

**Files:**
- Modify: `backend/api/admin.php`

Nová route `POST /api/admin/sheets-sync` musí být vyřízena **před** voláním `requireAdmin()`, protože Apps Script posílá token místo session.

- [ ] **Přidej require sheets_sync.php a novou route do `backend/api/admin.php`**

Za řádek `require_once __DIR__ . '/../lib/db_transfer.php';` přidej:
```php
require_once __DIR__ . '/../lib/sheets_sync.php';
```

Za `if ($method === 'OPTIONS') { ... exit; }` a PŘED `requireAdmin();` přidej:

```php
// Sheets sync — vlastní auth (token NEBO admin session)
if ($method === 'POST' && preg_match('#/api/admin/sheets-sync$#', $path)) {
    header('Content-Type: application/json; charset=utf-8');
    handleSheetsSync();
    exit;
}
```

- [ ] **Přidej funkci `handleSheetsSync()`** na konec souboru:

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

    $url = $config['caje_csv_url'] ?? '';
    if ($url === '') {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'CSV URL není nakonfigurována.']);
        return;
    }

    try {
        $result = sheetsSyncCaje(getPDO(), $url);
        echo json_encode(['ok' => true, 'synced' => $result]);
    } catch (Throwable $e) {
        error_log('Sheets sync error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}
```

- [ ] **Otestuj endpoint ručně (lokálně, admin session)**

Frontend musí běžet, backend na :8080. Přihlaš se jako admin, pak z konzole:
```js
fetch('/api/admin/sheets-sync', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
}).then(r => r.json()).then(console.log)
```

Očekáváš `{ ok: false, error: 'CSV URL není nakonfigurována.' }` (config je prázdný, to je OK).

- [ ] **Commitni**

```bash
git add backend/api/admin.php
git commit -m "feat(sheets): POST /api/admin/sheets-sync endpoint"
```

---

## Task 5: Frontend — `syncFromSheets()` v `api/admin.ts`

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Přidej `syncFromSheets()` do `frontend/src/api/admin.ts`**

Za existující `importDatabase` funkci přidej:

```typescript
export interface SyncResult {
  inserted: number
}

/** Spustí sync záložky CAJE ze Google Sheets → 01_caje v DB. */
export async function syncFromSheets(): Promise<SyncResult> {
  const res = await fetch(`${apiBase}/admin/sheets-sync`, {
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

- [ ] **Ověř TypeScript — žádné chyby**

```bash
cd frontend && npx tsc --noEmit
```

Očekáváno: žádný výstup (0 chyb).

- [ ] **Commitni**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat(sheets): syncFromSheets() v api/admin.ts"
```

---

## Task 6: Frontend — tlačítko sync v Dashboardu

**Files:**
- Modify: `frontend/src/pages/admin/Dashboard.tsx`

- [ ] **Přidej import `syncFromSheets`**

Za řádek `import { exportDatabase } from '../../api/admin'` přidej:
```typescript
import { exportDatabase, syncFromSheets } from '../../api/admin'
```

- [ ] **Přidej stav `syncing`** do `AdminDashboard` komponenty, za ostatní useState:

```typescript
const [syncing, setSyncing] = useState(false)
```

- [ ] **Přidej handler `handleSheetsSync`** za existující funkce v komponentě (před `return`):

```typescript
async function handleSheetsSync() {
  setSyncing(true)
  try {
    const result = await syncFromSheets()
    toast.success(`Sync hotový — ${result.inserted} záznamů`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Sync se nezdařil')
  } finally {
    setSyncing(false)
  }
}
```

- [ ] **Najdi v JSX sekci s Export/Import tlačítky** a přidej tlačítko Sync vedle nich.

Hledej v Dashboard.tsx řádek s textem `Exportovat DB` nebo `Export` a přidej vedle:

```tsx
<button
  onClick={handleSheetsSync}
  disabled={syncing}
  className={styles.actionBtn}
  style={{ background: '#4a90d9' }}
>
  {syncing ? 'Synchronizuji…' : '↻ Sync ze Sheets'}
</button>
```

> Pokud `styles.actionBtn` neexistuje v `Dashboard.module.css`, použij inline styl:
> ```tsx
> style={{ padding: '8px 16px', background: '#4a90d9', color: '#fff', border: 'none',
>          borderRadius: 4, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1 }}
> ```

- [ ] **Ověř TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Commitni**

```bash
git add frontend/src/pages/admin/Dashboard.tsx
git commit -m "feat(sheets): tlačítko Sync ze Sheets v Dashboardu"
```

---

## Task 7: Google Sheets — publikovat záložku + nastavit Apps Script

Tento task se nedělá v kódu, ale v Google Sheets a aplikaci. Proveď manuálně:

- [ ] **Publikuj záložku CAJE jako CSV**

1. Otevři Google Sheets „TEST zapisu"
2. **Soubor → Sdílet → Publikovat na webu**
3. Vyber záložku **CAJE** (ne celý dokument)
4. Formát: **Hodnoty oddělené čárkami (.csv)**
5. Klikni **Publikovat**
6. Zkopíruj výslednou URL (vypadá jako `https://docs.google.com/spreadsheets/d/.../pub?gid=...&single=true&output=csv`)
7. Vlož URL do `backend/config/sheets.php` → klíč `caje_csv_url`

- [ ] **Otestuj CSV URL v prohlížeči** — měl by se stáhnout CSV soubor s daty z CAJE záložky

- [ ] **Nastav Apps Script**

1. V Google Sheets: **Extensions → Apps Script**
2. Smaž výchozí kód a vlož:

```javascript
const SYNC_URL   = 'https://taocajovna.cz/api/admin/sheets-sync';
const SYNC_TOKEN = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');

function onSheetChange(e) {
  if (!SYNC_TOKEN) return; // ochrana — pokud token není nastaven, nic nevolej
  UrlFetchApp.fetch(SYNC_URL, {
    method: 'post',
    headers: { 'X-Sync-Token': SYNC_TOKEN },
    muteHttpExceptions: true,
  });
}

function setupTrigger() {
  // Smaž staré triggery aby neduplikovaly
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();
}
```

3. **Project Settings → Script Properties → Add property:**
   - Key: `SYNC_TOKEN`
   - Value: stejný řetězec jako v `backend/config/sheets.php` → `sync_token`

4. Spusť funkci **`setupTrigger`** (klikni Run) — nastaví onChange trigger

- [ ] **Otestuj end-to-end lokálně**

Pokud je lokální server přístupný zvenčí (ngrok / nebo přes produkci po deployi), uprav `SYNC_URL` a edituj cell v CAJE záložce. V logu Apps Script by měl být `200 OK`.

---

## Task 8: Ověření celého flow lokálně

- [ ] **Spusť backend a frontend**

```bash
docker compose up -d
cd frontend && npm run dev
```

- [ ] **Přihlaš se jako admin, jdi do Dashboardu**

- [ ] **Klikni „↻ Sync ze Sheets"** — měl by se objevit toast s výsledkem

Pokud `caje_csv_url` je prázdná, uvidíš chybu `CSV URL není nakonfigurována.` — to je správné.

Po vyplnění URL v `sheets.php`: klikni znovu. Měl by se zobrazit toast `Sync hotový — N záznamů`.

- [ ] **Zkontroluj data v TEAs sekci adminu** (`/admin/teas`) — měly by být vidět záznamy z CAJE záložky

- [ ] **Spusť existující testy — nesmí být regrese**

```bash
cd frontend && npm run test
```

Očekáváno: všechny testy projdou (aktuálně 127+).

---

## Poznámky k nasazení (Deploy)

1. Nahrát `backend/config/sheets.php` na Forpsi FTP (NENÍ v gitu — ručně)
2. Spustit migraci `db/migration_2026-06-13_01_caje.sql` na produkční DB
3. V Apps Script přepnout `SYNC_URL` na `https://taocajovna.cz/api/admin/sheets-sync`
