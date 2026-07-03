-- KOD položky jako business klíč číselníku čajů.
-- 01_caje: sync tabulka — data doteče z prvního syncu po nasazení.
-- 00_prodej_polozky: obsahuje jen test data, reálné prodeje neexistují.
-- Pořadí: TRUNCATE 01_caje musí proběhnout dřív, než na ni vznikne FK.
-- TRUNCATE nelze na 00_prodej (míří na ni FK z položek) → DELETE + reset AI.

TRUNCATE TABLE `01_caje`;
ALTER TABLE `01_caje`
  ADD COLUMN `KOD` VARCHAR(32) NOT NULL AFTER `id`,
  ADD COLUMN `V_SHEETU` TINYINT(1) NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uq_kod` (`KOD`);

TRUNCATE TABLE `00_prodej_polozky`;
DELETE FROM `00_prodej`;
ALTER TABLE `00_prodej` AUTO_INCREMENT = 1;

ALTER TABLE `00_prodej_polozky`
  DROP COLUMN `caje_id`,
  ADD COLUMN `caje_kod` VARCHAR(32) NOT NULL AFTER `prodej_id`,
  ADD CONSTRAINT `fk_polozky_kod` FOREIGN KEY (`caje_kod`) REFERENCES `01_caje`(`KOD`);
