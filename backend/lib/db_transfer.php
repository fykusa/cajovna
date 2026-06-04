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
        if ($line === [null]) continue; // prázdný řádek (fgetcsv vrací [null])
        $rows[] = $line;
    }
    fclose($fh);
    return [$header ?: [], $rows];
}

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

// Vytvoří ZIP se všemi tabulkami + manifest.json. Vrací manifest pole.
function dbtExportZip(PDO $pdo, string $zipPath): array {
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('Nelze vytvořit ZIP soubor.');
    }
    try {
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
    } finally {
        // ZIP vždy uzavřít, ať se při chybě uprostřed nenechá otevřený handle.
        $zip->close();
    }
    return $manifest;
}

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
    $pdo->beginTransaction();
    try {
        // FK_CHECKS je session var (nerolbackuje se) → vypnout až uvnitř try,
        // aby případná výjimka z beginTransaction nenechala checks vypnuté.
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
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
    if (!mkdir($dir, 0700)) {
        $zip->close();
        throw new RuntimeException('Nelze vytvořit dočasný adresář.');
    }
    $zip->extractTo($dir);
    $zip->close();

    try {
        return dbtImportTables($pdo, $dir, $tables);
    } finally {
        dbtCleanup($dir);
    }
}
