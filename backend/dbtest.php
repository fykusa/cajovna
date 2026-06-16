<?php
// Dočasný testovací skript — po ověření SMAZAT ze serveru!
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== DB TEST ===\n";
echo "Host:   " . DB_HOST . "\n";
echo "DB:     " . DB_NAME . "\n";
echo "User:   " . DB_USER . "\n\n";

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME),
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "Pripojeni: OK\n\n";

    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tabulky (" . count($tables) . "):\n";
    foreach ($tables as $t) {
        $count = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        echo "  $t — $count radku\n";
    }

} catch (PDOException $e) {
    echo "CHYBA: " . $e->getMessage() . "\n";
}
