<?php
// INSTALAČNÍ SKRIPT — po instalaci SMAZAT ze serveru!
require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');

$adminPassword = $_POST['admin_password'] ?? '';
$doInstall = $_SERVER['REQUEST_METHOD'] === 'POST' && $adminPassword !== '';
?>
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>TAO čajovna — instalace DB</title>
<style>
  body { font-family: monospace; background: #141a08; color: #e5e2ba; padding: 32px; }
  h1 { color: #9cba21; }
  .ok  { color: #9cba21; }
  .err { color: #f4a64a; }
  .box { background: #1e2b0e; border: 1px solid #3a4e1a; border-radius: 8px; padding: 24px; max-width: 560px; }
  input { background: #151c09; border: 1px solid #3a4e1a; color: #e5e2ba; padding: 8px 12px; font-size: 1rem; border-radius: 4px; width: 100%; box-sizing: border-box; }
  button { background: #9cba21; color: #141a08; border: none; padding: 10px 24px; font-size: 1rem; font-weight: 700; border-radius: 4px; cursor: pointer; margin-top: 8px; }
  pre { background: #151c09; padding: 16px; border-radius: 4px; line-height: 1.6; }
</style>
</head>
<body>
<h1>TAO čajovna — instalace databáze</h1>

<?php if (!$doInstall): ?>
<div class="box">
  <p>Skript vytvoří tabulky a admin účet. Spusť jen jednou na prázdné DB.</p>
  <form method="post">
    <label>Heslo pro admin účet:<br>
      <input type="password" name="admin_password" required minlength="8" placeholder="min. 8 znaků">
    </label><br>
    <button type="submit">Spustit instalaci</button>
  </form>
</div>

<?php else: ?>
<pre>
<?php

function ok($msg)  { echo '<span class="ok">✓ ' . htmlspecialchars($msg) . '</span>' . "\n"; }
function err($msg) { echo '<span class="err">✗ ' . htmlspecialchars($msg) . '</span>' . "\n"; }

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME),
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    ok('Připojení k DB: OK (' . DB_HOST . ' / ' . DB_NAME . ')');
} catch (PDOException $e) {
    err('Připojení selhalo: ' . $e->getMessage());
    echo '</pre></body></html>';
    exit;
}

echo "\n--- Vytváření tabulek ---\n\n";

$pdo->exec("SET NAMES utf8mb4");
$pdo->exec("SET foreign_key_checks = 0");

$tables = [

'users' => "CREATE TABLE IF NOT EXISTS `users` (
  `id`                  INT          NOT NULL AUTO_INCREMENT,
  `username`            VARCHAR(100) NOT NULL,
  `password_hash`       VARCHAR(255) NOT NULL,
  `role`                ENUM('prodavacka','admin') NOT NULL DEFAULT 'prodavacka',
  `active`              TINYINT      NOT NULL DEFAULT 1,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `password_changed_at` DATETIME     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

'tea_categories' => "CREATE TABLE IF NOT EXISTS `tea_categories` (
  `id`     INT          NOT NULL AUTO_INCREMENT,
  `name`   VARCHAR(100) NOT NULL,
  `active` TINYINT      NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_tea_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

'teas' => "CREATE TABLE IF NOT EXISTS `teas` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `category_id`     INT          NOT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `note`            TEXT         NULL DEFAULT NULL,
  `flag`            ENUM('active','discontinued','no_insert','eshop_only','trial') NOT NULL DEFAULT 'active',
  `origin`          VARCHAR(255) NULL DEFAULT NULL,
  `std_weight_g`    DECIMAL(8,1) NULL DEFAULT NULL,
  `std_price_moc`   INT          NULL DEFAULT NULL,
  `std_price_voc`   INT          NULL DEFAULT NULL,
  `std_margin_pct`  DECIMAL(5,1) NULL DEFAULT NULL,
  `pkg1_weight_g`   DECIMAL(8,1) NULL DEFAULT NULL,
  `pkg1_price_moc`  INT          NULL DEFAULT NULL,
  `pkg1_price_voc`  INT          NULL DEFAULT NULL,
  `pkg1_margin_pct` DECIMAL(5,1) NULL DEFAULT NULL,
  `pkg2_weight_g`   DECIMAL(8,1) NULL DEFAULT NULL,
  `pkg2_price_moc`  INT          NULL DEFAULT NULL,
  `pkg2_price_voc`  INT          NULL DEFAULT NULL,
  `pkg2_margin_pct` DECIMAL(5,1) NULL DEFAULT NULL,
  `stock_std_pcs`   INT          NOT NULL DEFAULT 0,
  `stock_pkg1_pcs`  INT          NOT NULL DEFAULT 0,
  `stock_pkg2_pcs`  INT          NOT NULL DEFAULT 0,
  `stock_kg`        DECIMAL(8,3) NOT NULL DEFAULT 0.000,
  `purchase_kg`     DECIMAL(8,3) NULL DEFAULT NULL,
  `tao_pct`         DECIMAL(5,1) NULL DEFAULT NULL,
  `trade_pct`       DECIMAL(5,1) NULL DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_teas_category_id` (`category_id`),
  KEY `idx_teas_name` (`name`),
  CONSTRAINT `fk_teas_category`
    FOREIGN KEY (`category_id`) REFERENCES `tea_categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

'bags' => "CREATE TABLE IF NOT EXISTS `bags` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `surface_type`    VARCHAR(50)   NOT NULL,
  `volume_ml`       INT           NOT NULL,
  `dimensions`      VARCHAR(100)  NULL DEFAULT NULL,
  `price_per_piece` DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  `active`          TINYINT       NOT NULL DEFAULT 1,
  `var1_qty`        INT           NULL DEFAULT NULL,
  `var1_price`      INT           NULL DEFAULT NULL,
  `var1_margin_pct` DECIMAL(5,1)  NULL DEFAULT NULL,
  `var2_qty`        INT           NULL DEFAULT NULL,
  `var2_price`      INT           NULL DEFAULT NULL,
  `var2_margin_pct` DECIMAL(5,1)  NULL DEFAULT NULL,
  `var3_qty`        INT           NULL DEFAULT NULL,
  `var3_price`      INT           NULL DEFAULT NULL,
  `var3_margin_pct` DECIMAL(5,1)  NULL DEFAULT NULL,
  `supplier_url`    TEXT          NULL DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bags_surface_type` (`surface_type`),
  KEY `idx_bags_volume_ml`    (`volume_ml`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

'sales' => "CREATE TABLE IF NOT EXISTS `sales` (
  `id`             INT           NOT NULL AUTO_INCREMENT,
  `user_id`        INT           NOT NULL,
  `payment_method` ENUM('cash','card') NOT NULL,
  `total_amount`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `note`           TEXT          NULL DEFAULT NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_user_id`    (`user_id`),
  KEY `idx_sales_created_at` (`created_at`),
  CONSTRAINT `fk_sales_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

'sale_items' => "CREATE TABLE IF NOT EXISTS `sale_items` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `sale_id`     INT           NOT NULL,
  `tea_id`      INT           NULL DEFAULT NULL,
  `bag_id`      INT           NULL DEFAULT NULL,
  `item_type`   ENUM('std','pkg1','pkg2','custom','bag') NOT NULL,
  `weight_g`    DECIMAL(8,1)  NULL DEFAULT NULL,
  `quantity`    INT           NOT NULL DEFAULT 1,
  `unit_price`  DECIMAL(8,2)  NOT NULL,
  `total_price` DECIMAL(8,2)  NOT NULL,
  `note`        TEXT          NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sale_items_sale_id` (`sale_id`),
  KEY `idx_sale_items_tea_id`  (`tea_id`),
  KEY `idx_sale_items_bag_id`  (`bag_id`),
  CONSTRAINT `fk_sale_items_sale`
    FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sale_items_tea`
    FOREIGN KEY (`tea_id`) REFERENCES `teas` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_sale_items_bag`
    FOREIGN KEY (`bag_id`) REFERENCES `bags` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

];

foreach ($tables as $name => $sql) {
    try {
        $pdo->exec($sql);
        ok("Tabulka `$name`");
    } catch (PDOException $e) {
        err("Tabulka `$name`: " . $e->getMessage());
    }
}

$pdo->exec("SET foreign_key_checks = 1");

echo "\n--- Admin účet ---\n\n";

$exists = $pdo->query("SELECT COUNT(*) FROM `users` WHERE `username` = 'admin'")->fetchColumn();
if ($exists) {
    echo '<span class="err">! Admin účet už existuje — heslo NEBYLO změněno.</span>' . "\n";
} else {
    $hash = password_hash($adminPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $pdo->prepare("INSERT INTO `users` (`username`, `password_hash`, `role`, `active`) VALUES ('admin', ?, 'admin', 1)");
    $stmt->execute([$hash]);
    ok('Admin účet vytvořen (login: admin)');
}

echo "\n--- Hotovo ---\n\n";
echo '<span class="ok">Instalace dokončena. SMAŽ tento soubor ze serveru!</span>' . "\n";
?>
</pre>
<?php endif; ?>
</body>
</html>
