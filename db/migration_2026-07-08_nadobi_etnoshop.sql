-- Nové produktové řady Nádobí a Etnoshop — zrcadlí strukturu 01_caje.
-- 01_caje se NEMĚNÍ. 00_prodej_polozky dostává PRODUKT_TYP a ztrácí
-- pevnou FK na 01_caje (nahrazeno aplikační validací, viz cajovna.php).

CREATE TABLE IF NOT EXISTS `02_nadobi` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
  `KOD`       VARCHAR(32)   NOT NULL,
  `KATEGORIE` VARCHAR(100)  NULL,
  `ZEME`      VARCHAR(100)  NULL,
  `AKTIV`     VARCHAR(10)   NULL,
  `NAZEV`     VARCHAR(255)  NULL,
  `POZNAMKA`  TEXT          NULL,
  `MN1`       DECIMAL(8,1)  NULL,
  `CENA1`     INT           NULL,
  `MN2`       DECIMAL(8,1)  NULL,
  `CENA2`     INT           NULL,
  `MN3`       DECIMAL(8,1)  NULL,
  `CENA3`     INT           NULL,
  `MN4`       DECIMAL(8,1)  NULL,
  `CENA4`     INT           NULL,
  `V_SHEETU`  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kod` (`KOD`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `03_etnoshop` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
  `KOD`       VARCHAR(32)   NOT NULL,
  `KATEGORIE` VARCHAR(100)  NULL,
  `ZEME`      VARCHAR(100)  NULL,
  `AKTIV`     VARCHAR(10)   NULL,
  `NAZEV`     VARCHAR(255)  NULL,
  `POZNAMKA`  TEXT          NULL,
  `MN1`       DECIMAL(8,1)  NULL,
  `CENA1`     INT           NULL,
  `MN2`       DECIMAL(8,1)  NULL,
  `CENA2`     INT           NULL,
  `MN3`       DECIMAL(8,1)  NULL,
  `CENA3`     INT           NULL,
  `MN4`       DECIMAL(8,1)  NULL,
  `CENA4`     INT           NULL,
  `V_SHEETU`  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_kod` (`KOD`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `00_prodej_polozky`
  ADD COLUMN `PRODUKT_TYP` ENUM('caje','nadobi','etnoshop') NOT NULL DEFAULT 'caje' AFTER `caje_kod`;

-- Pozn.: pokud tenhle řádek spadne s chybou, že FK neexistuje ("check that
-- column/key exists" / "error in list of foreign keys"), FK už byla dřív
-- odstraněná — přeskoč tenhle příkaz a pokračuj dál, nic to nerozbije.
ALTER TABLE `00_prodej_polozky` DROP FOREIGN KEY `fk_polozky_kod`;
