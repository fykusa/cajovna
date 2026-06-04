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
