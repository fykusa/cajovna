<?php
// Sync produktových záložek z Google Sheets → tabulky 01_caje / 02_nadobi / 03_etnoshop.
require_once __DIR__ . '/db_transfer.php';
require_once __DIR__ . '/produkt_typy.php';

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
function sheetsUpsertProdukty(PDO $pdo, array $rows, string $tableName): array {
    if (!in_array($tableName, PRODUKT_TABULKY, true)) {
        throw new InvalidArgumentException('Neznámá tabulka pro sync: ' . $tableName);
    }
    if (empty($rows)) {
        throw new RuntimeException('Sheet neobsahuje žádné platné řádky — sync přerušen.');
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

/** Zpětně kompatibilní wrapper pro čaje. */
function sheetsUpsertCaje(PDO $pdo, array $rows): array {
    return sheetsUpsertProdukty($pdo, $rows, '01_caje');
}
