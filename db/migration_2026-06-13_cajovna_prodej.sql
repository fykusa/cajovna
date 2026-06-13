-- Nové tabulky pro Cajovna POS (01_caje → prodeje bez obalů)

CREATE TABLE IF NOT EXISTS `00_prodej` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `user_id`    INT          NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_kc`   INT          NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `00_prodej_polozky` (
  `id`        INT      NOT NULL AUTO_INCREMENT,
  `prodej_id` INT      NOT NULL,
  `caje_id`   INT      NOT NULL,
  `baleni`    TINYINT  NOT NULL COMMENT '1=Standard 2=Větší 3=Největší 4=Čajovna',
  `kusu`      SMALLINT NOT NULL,
  `jedn_cena` INT      NOT NULL,
  `celk_cena` INT      NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`prodej_id`) REFERENCES `00_prodej`(`id`),
  FOREIGN KEY (`caje_id`)   REFERENCES `01_caje`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
