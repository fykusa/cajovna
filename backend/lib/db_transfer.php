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
