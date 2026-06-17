<?php
// Jednorázový migrační skript — přidá tabulky kasy do existující DB.
// Po úspěšném spuštění SMAZAT ze serveru!
require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');

$adminPassword = $_POST['admin_password'] ?? '';
$doMigrate = $_SERVER['REQUEST_METHOD'] === 'POST' && $adminPassword !== '';
?>
<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Migrace kasa</title>
<style>body{font-family:monospace;background:#141a08;color:#e5e2ba;padding:32px}
.ok{color:#9cba21}.err{color:#f4a64a}pre{background:#1e2b0e;padding:16px;border-radius:8px}
input[type=password]{background:#1e2b0e;color:#e5e2ba;border:1px solid #9cba21;padding:8px;font-family:monospace;font-size:1em}
button{background:#9cba21;color:#141a08;border:none;padding:8px 20px;font-family:monospace;font-size:1em;cursor:pointer;margin-top:8px}</style>
</head><body><h1>Migrace kasa</h1>
<?php if (!$doMigrate): ?>
<form method="post">
  <label>Admin heslo: <input type="password" name="admin_password" autofocus></label><br>
  <button type="submit">Spustit migraci</button>
</form>
<?php else: ?>
<pre>
<?php
function ok($m) { echo '<span class="ok">✓ '.htmlspecialchars($m).'</span>'."\n"; }
function err($m){ echo '<span class="err">✗ '.htmlspecialchars($m).'</span>'."\n"; }

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME),
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("SET NAMES utf8mb4");
    ok('DB spojení OK');
} catch (PDOException $e) { err($e->getMessage()); exit; }

$pdo->exec("SET foreign_key_checks = 0");

$tables = [
'90_cashflow' => "CREATE TABLE IF NOT EXISTS `90_cashflow` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `date`        DATE          NOT NULL,
  `amount`      DECIMAL(10,2) NOT NULL,
  `note`        TEXT          NOT NULL,
  `created_by`  INT           NOT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cashflow_date` (`date`),
  CONSTRAINT `fk_cashflow_user`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

'91_zaverka' => "CREATE TABLE IF NOT EXISTS `91_zaverka` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `date`                DATE          NOT NULL,
  `calculated_balance`  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `confirmed_balance`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `note`                TEXT          NULL DEFAULT NULL,
  `created_by`          INT           NOT NULL,
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_zaverka_date` (`date`),
  CONSTRAINT `fk_zaverka_user`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

foreach ($tables as $name => $sql) {
    try { $pdo->exec($sql); ok("Tabulka `$name`"); }
    catch (PDOException $e) { err("Tabulka `$name`: ".$e->getMessage()); }
}

$pdo->exec("SET foreign_key_checks = 1");
echo "\n";
ok('Hotovo. SMAŽ tento soubor ze serveru!');
?>
</pre>
<?php endif; ?>
</body></html>
