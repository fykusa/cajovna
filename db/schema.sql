-- =============================================================
-- Cajovna – DB schema
-- MariaDB 10.1 kompatibilní (bez JSON, bez generated columns)
-- =============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- -------------------------------------------------------------
-- users
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          ENUM('prodavacka','admin') NOT NULL DEFAULT 'prodavacka',
  `active`        TINYINT      NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `password_changed_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- tea_categories
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tea_categories` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100) NOT NULL,
  `parent_id`  INT          NULL DEFAULT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  `active`     TINYINT      NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_tea_categories_parent_id` (`parent_id`),
  KEY `idx_tea_categories_name`      (`name`),
  CONSTRAINT `fk_tea_categories_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `tea_categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- teas
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `teas` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `category_id`     INT          NOT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `note`            TEXT         NULL DEFAULT NULL,
  `flag`            ENUM('active','discontinued','no_insert','eshop_only','trial') NOT NULL DEFAULT 'active',
  `origin`          VARCHAR(255) NULL DEFAULT NULL,

  -- Standardní balení
  `std_weight_g`    DECIMAL(8,1) NULL DEFAULT NULL,
  `std_price_moc`   INT          NULL DEFAULT NULL,
  `std_price_voc`   INT          NULL DEFAULT NULL,
  `std_margin_pct`  DECIMAL(5,1) NULL DEFAULT NULL,

  -- Balení 1
  `pkg1_weight_g`   DECIMAL(8,1) NULL DEFAULT NULL,
  `pkg1_price_moc`  INT          NULL DEFAULT NULL,
  `pkg1_price_voc`  INT          NULL DEFAULT NULL,
  `pkg1_margin_pct` DECIMAL(5,1) NULL DEFAULT NULL,

  -- Balení 2
  `pkg2_weight_g`   DECIMAL(8,1) NULL DEFAULT NULL,
  `pkg2_price_moc`  INT          NULL DEFAULT NULL,
  `pkg2_price_voc`  INT          NULL DEFAULT NULL,
  `pkg2_margin_pct` DECIMAL(5,1) NULL DEFAULT NULL,

  -- Sklad
  `stock_std_pcs`   INT          NOT NULL DEFAULT 0,
  `stock_pkg1_pcs`  INT          NOT NULL DEFAULT 0,
  `stock_pkg2_pcs`  INT          NOT NULL DEFAULT 0,

  -- Sklad v kg (sypaný/volná gramáž)
  `stock_kg`        DECIMAL(8,3) NOT NULL DEFAULT 0.000,

  -- Nákupní data
  `purchase_kg`     DECIMAL(8,3) NULL DEFAULT NULL,
  `tao_pct`         DECIMAL(5,1) NULL DEFAULT NULL,
  `trade_pct`       DECIMAL(5,1) NULL DEFAULT NULL,

  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_teas_category_id` (`category_id`),
  KEY `idx_teas_name`        (`name`),
  CONSTRAINT `fk_teas_category`
    FOREIGN KEY (`category_id`) REFERENCES `tea_categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- bags (pytlíky)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bags` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `surface_type`    VARCHAR(50)   NOT NULL,
  `volume_ml`       INT           NOT NULL,
  `dimensions`      VARCHAR(100)  NULL DEFAULT NULL,
  `price_per_piece` DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  `active`          TINYINT       NOT NULL DEFAULT 1,

  -- Nákupní varianta 1
  `var1_qty`        INT           NULL DEFAULT NULL,
  `var1_price`      INT           NULL DEFAULT NULL,
  `var1_margin_pct` DECIMAL(5,1)  NULL DEFAULT NULL,

  -- Nákupní varianta 2
  `var2_qty`        INT           NULL DEFAULT NULL,
  `var2_price`      INT           NULL DEFAULT NULL,
  `var2_margin_pct` DECIMAL(5,1)  NULL DEFAULT NULL,

  -- Nákupní varianta 3
  `var3_qty`        INT           NULL DEFAULT NULL,
  `var3_price`      INT           NULL DEFAULT NULL,
  `var3_margin_pct` DECIMAL(5,1)  NULL DEFAULT NULL,

  `supplier_url`    TEXT          NULL DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_bags_surface_type` (`surface_type`),
  KEY `idx_bags_volume_ml`    (`volume_ml`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- sales (prodeje – hlavička)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------
-- sale_items (položky prodeje)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_items` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET foreign_key_checks = 1;

-- =============================================================
-- Default admin uživatel
-- password_hash je placeholder – před nasazením nahradit
-- bcrypt hashem skutečného hesla (password_hash() v PHP)
-- =============================================================
INSERT INTO `users` (`username`, `password_hash`, `role`, `active`)
VALUES ('admin', '$2y$12$PLACEHOLDER_REPLACE_BEFORE_DEPLOY_XXXXXXXXXXXXXXXXXXXXX', 'admin', 1);
