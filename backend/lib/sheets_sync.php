<?php
// Sync záložky CAJE z Google Sheets → tabulka `01_caje`.
require_once __DIR__ . '/db_transfer.php';

// Indexy sloupců v sheetu, které bereme (0-based, A=0). D = KOD (od 2026-07).
const SHEETS_COL_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 14, 15, 18, 19];
const SHEETS_COL_NAMES   = ['KATEGORIE', 'ZEME', 'AKTIV', 'KOD', 'NAZEV', 'POZNAMKA',
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
        if (isset($seen[$kod])) {
            throw new RuntimeException('Duplicitní KOD v sheetu: ' . $kod);
        }
        $seen[$kod] = true;
    }
}

/**
 * Upsert řádků do 01_caje podle KOD (UNIQUE klíč uq_kod).
 * Řádky chybějící v $rows zůstanou v DB s V_SHEETU = 0 (vyřazené ze sheetu).
 * Nikdy nemaže — 00_prodej_polozky.caje_kod má FK na 01_caje.KOD.
 * Vrací ['synced' => počet řádků v sheetu, 'vyrazeno' => počet V_SHEETU = 0 po syncu].
 */
function sheetsUpsertCaje(PDO $pdo, array $rows): array {
    if (empty($rows)) {
        throw new RuntimeException('Sheet neobsahuje žádné platné řádky — sync přerušen.');
    }

    $pdo->beginTransaction();
    try {
        $pdo->exec('UPDATE `01_caje` SET V_SHEETU = 0');

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

        $vyrazeno = (int) $pdo->query('SELECT COUNT(*) FROM `01_caje` WHERE V_SHEETU = 0')->fetchColumn();

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return ['synced' => count($rows), 'vyrazeno' => $vyrazeno];
}
