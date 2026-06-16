<?php
// IMPORTNÍ SKRIPT — po importu SMAZAT ze serveru!
require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');
$doImport = $_SERVER['REQUEST_METHOD'] === 'POST';
?>
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>TAO čajovna — import dat</title>
<style>
  body { font-family: monospace; background: #141a08; color: #e5e2ba; padding: 32px; }
  h1 { color: #9cba21; }
  .ok  { color: #9cba21; }
  .err { color: #f4a64a; }
  .box { background: #1e2b0e; border: 1px solid #3a4e1a; border-radius: 8px; padding: 24px; max-width: 560px; }
  button { background: #9cba21; color: #141a08; border: none; padding: 10px 24px; font-size: 1rem; font-weight: 700; border-radius: 4px; cursor: pointer; margin-top: 8px; }
  pre { background: #151c09; padding: 16px; border-radius: 4px; line-height: 1.7; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  .warn { color: #f4a64a; border: 1px solid #f4a64a; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>TAO čajovna — import dat</h1>
<p>PHP: <?= phpversion() ?> | DB: <?= DB_HOST ?>/<?= DB_NAME ?></p>

<?php if (!$doImport): ?>
<div class="box">
  <div class="warn">⚠ Importuje data do <strong><?= htmlspecialchars(DB_NAME) ?></strong>.<br>
  Existující záznamy se přepíší pokud mají stejné ID.</div>
  <p>Soubor <code>export.sql</code> musí být ve stejném adresáři jako tento skript.</p>
  <form method="post">
    <button type="submit">Spustit import</button>
  </form>
</div>

<?php else: ?>
<pre>
<?php
flush();

function p_ok($msg)  { echo '<span class="ok">✓ ' . htmlspecialchars($msg) . '</span>' . "\n"; flush(); }
function p_err($msg) { echo '<span class="err">✗ ' . htmlspecialchars($msg) . '</span>' . "\n"; flush(); }

// Připojení
try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME),
        DB_USER, DB_PASS,
        array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
    );
    p_ok('Připojení k DB: OK');
} catch (PDOException $e) {
    p_err('Připojení selhalo: ' . $e->getMessage());
    echo '</pre></body></html>';
    exit;
}

// Načti SQL soubor
$file = __DIR__ . '/export.sql';
if (!file_exists($file)) {
    p_err('Soubor export.sql nenalezen v ' . __DIR__);
    echo '</pre></body></html>';
    exit;
}
$size = round(filesize($file) / 1024, 1);
p_ok("Soubor export.sql nalezen ({$size} kB)");
echo "\n";

$sql = file_get_contents($file);

// Rozdělení na příkazy — jednoduché: split na ";\n"
$raw = explode(";\n", $sql);
$statements = array();
foreach ($raw as $s) {
    $s = trim($s);
    // Přeskoč komentáře a prázdné řádky
    if ($s === '' || $s[0] === '-') continue;
    $statements[] = $s . ';';
}

p_ok('Příkazů k provedení: ' . count($statements));
echo "\n";

$ok = 0;
$errors = 0;
$inserts = 0;

foreach ($statements as $stmt) {
    try {
        $pdo->exec($stmt);
        $upper = strtoupper(substr(ltrim($stmt), 0, 6));
        if ($upper === 'INSERT') {
            $inserts++;
        } else {
            p_ok(substr($stmt, 0, 70));
        }
        $ok++;
    } catch (PDOException $e) {
        p_err(substr($stmt, 0, 100));
        p_err('  → ' . $e->getMessage());
        $errors++;
    }
}

echo "\n";
p_ok("INSERT řádků importováno: $inserts");

if ($errors === 0) {
    echo "\n<span class=\"ok\">✓ Import dokončen bez chyb. SMAŽ tento soubor a export.sql ze serveru!</span>\n";
} else {
    echo "\n<span class=\"err\">Import dokončen s $errors chybami. Zkontroluj výstup výše.</span>\n";
}
?>
</pre>
<?php endif; ?>
</body>
</html>
