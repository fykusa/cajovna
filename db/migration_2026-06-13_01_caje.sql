-- Tabulka pro import dat z Google Sheets (záložka CAJE).
-- Slouží jako read-only zdroj dat synchronizovaný ze Sheets.
-- Žádné FK vazby, sync = TRUNCATE + INSERT.

CREATE TABLE IF NOT EXISTS `01_caje` (
  `id`        INT           NOT NULL AUTO_INCREMENT,
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
