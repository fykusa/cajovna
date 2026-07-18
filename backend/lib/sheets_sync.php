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

// Sloupce, které musí obsahovat číslo. Google Sheets vzorce občas vrací
// chybu (#VALUE!, #DIV/0!) místo hodnoty — bereme to jako chybějící údaj
// (NULL), ne jako platnou hodnotu (jinak striktní MySQL INT/DECIMAL sloupec
// shodí celou sync transakci na jediné špatné buňce).
const NUMERIC_COL_NAMES = ['MN1', 'CENA1', 'MN2', 'CENA2', 'MN3', 'CENA3', 'MN4', 'CENA4',
                            'NAKUP1', 'NAKUP2', 'NAKUP3', 'NAKUP4'];

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
            if ($val !== '' && in_array($colName, NUMERIC_COL_NAMES, true) && !is_numeric($val)) {
                $val = '';
            }
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
