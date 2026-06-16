<?php
// Export dat kompatibilní s produkční strukturou.
// Lokálně: http://localhost:8080/export.php → stáhne export.sql
// NENAHRÁVAT na produkční server!

require_once __DIR__ . '/config.php';

$filename = 'export-' . date('Y-m-d') . '.sql';
header('Content-Type: text/plain; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$pdo = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME),
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

// Sloupce vynechané při exportu (neexistují na produkci)
$skipColumns = [
    'tea_categories' => ['parent_id', 'sort_order'],
];

// Pořadí respektuje FK závislosti
$tables = ['users', 'tea_categories', 'teas', 'bags', 'sales', 'sale_items'];

echo "-- TAO čajovna — export dat\n";
echo "-- Vygenerováno: " . date('Y-m-d H:i:s') . "\n";
echo "-- POZOR: pouze data (INSERT), ne struktura tabulek\n\n";
echo "SET NAMES utf8mb4;\n";
echo "SET foreign_key_checks = 0;\n\n";

foreach ($tables as $table) {
    // Zjisti dostupné sloupce
    $allCols = array_column(
        $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(),
        'Field'
    );

    $skip = $skipColumns[$table] ?? [];
    $cols = array_values(array_filter($allCols, fn($c) => !in_array($c, $skip)));
    $colList = implode(', ', array_map(fn($c) => "`$c`", $cols));

    $rows = $pdo->query("SELECT $colList FROM `$table` ORDER BY id")->fetchAll();

    echo "-- $table (" . count($rows) . " řádků)\n";

    if (empty($rows)) {
        echo "-- (prázdná tabulka)\n\n";
        continue;
    }

    foreach ($rows as $row) {
        $vals = array_map(function ($v) use ($pdo) {
            if ($v === null) return 'NULL';
            if (is_numeric($v)) return $v;
            return $pdo->quote($v);
        }, array_values($row));

        echo "INSERT INTO `$table` ($colList) VALUES (" . implode(', ', $vals) . ");\n";
    }

    echo "\n";
}

echo "SET foreign_key_checks = 1;\n";
echo "-- Konec exportu\n";
