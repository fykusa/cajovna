-- Nákupní ceny čaje pro 4 balení (standart/větší/největší/čajovna),
-- párují se 1:1 s CENA1-4. Zdroj: sloupce W-Z Google Sheetu CAJE.
-- Týká se jen 01_caje — 02_nadobi/03_etnoshop se nemění.

ALTER TABLE `01_caje`
  ADD COLUMN `NAKUP1` INT NULL AFTER `CENA4`,
  ADD COLUMN `NAKUP2` INT NULL AFTER `NAKUP1`,
  ADD COLUMN `NAKUP3` INT NULL AFTER `NAKUP2`,
  ADD COLUMN `NAKUP4` INT NULL AFTER `NAKUP3`;
