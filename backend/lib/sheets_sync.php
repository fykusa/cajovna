<?php
// Sync záložky CAJE z Google Sheets → tabulka `01_caje`.
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

    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    $pdo->beginTransaction();
    try {
        $pdo->exec('TRUNCATE TABLE `01_caje`');
        $inserted = insertCajeRows($pdo, $allRows);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    } finally {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
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
        // Přeskočit řádky bez kategorie nebo bez názvu
        if ($row['KATEGORIE'] === null) continue;
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
