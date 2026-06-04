<?php
// Ověří, že export+import je 1:1. Spuštění:
//   docker compose exec -T php php tools/verify_roundtrip.php <verify_db>
// Vytvoří/přepíše <verify_db>, naimportuje do ní export a porovná s ostrou DB.
require_once __DIR__ . '/../lib/db_transfer.php';

$verifyDb = $argv[1] ?? null;
if (!$verifyDb) {
    fwrite(STDERR, "Použití: verify_roundtrip.php <verify_db_name>\n");
    exit(2);
}

$src = getPDO();
$srcDbName = $src->query('SELECT DATABASE()')->fetchColumn();

// Připojení bez konkrétní DB (na vytvoření verify DB).
$root = new PDO(
    sprintf('mysql:host=%s;charset=%s', DB_HOST, DB_CHARSET),
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
);
$root->exec("DROP DATABASE IF EXISTS `$verifyDb`");
$root->exec("CREATE DATABASE `$verifyDb` CHARACTER SET utf8mb4");
$root->exec("USE `$verifyDb`");
// schéma (víc příkazů)
foreach (array_filter(array_map('trim', explode(';', file_get_contents(__DIR__ . '/../../db/schema.sql')))) as $stmt) {
    if ($stmt !== '') $root->exec($stmt);
}

// 1) export ostré DB
$zip = sys_get_temp_dir() . '/verify_' . uniqid() . '.zip';
dbtExportZip($src, $zip);

// 2) import VŠECH tabulek (vč. users) do verify DB
$verify = new PDO(
    sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, $verifyDb, DB_CHARSET),
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]
);
$dir = sys_get_temp_dir() . '/dbt_verify_' . uniqid();
mkdir($dir);
$z = new ZipArchive();
$z->open($zip);
$z->extractTo($dir);
$z->close();
dbtImportTables($verify, $dir, DBT_TABLES);
dbtCleanup($dir);
unlink($zip);

// 3) porovnání tabulek řádek po řádku
$diffs = 0;
foreach (DBT_TABLES as $table) {
    $a = $src->query("SELECT * FROM `$srcDbName`.`$table` ORDER BY `id`")->fetchAll();
    $b = $verify->query("SELECT * FROM `$table` ORDER BY `id`")->fetchAll();
    if ($a === $b) {
        echo "OK    $table (" . count($a) . " řádků)\n";
    } else {
        echo "DIFF  $table — zdroj " . count($a) . " vs verify " . count($b) . " řádků\n";
        $diffs++;
    }
}

echo $diffs === 0 ? "\n1:1 SHODA\n" : "\n$diffs TABULEK SE LIŠÍ\n";
exit($diffs === 0 ? 0 : 1);
