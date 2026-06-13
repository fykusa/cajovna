-- Odstraní FK z 00_prodej_polozky.caje_id → 01_caje.id
-- 01_caje je sync tabulka (TRUNCATE při každém syncu), FK na ni nelze mít.
-- Constraint name generuje MySQL automaticky jako 00_prodej_polozky_ibfk_2.

ALTER TABLE `00_prodej_polozky` DROP FOREIGN KEY `00_prodej_polozky_ibfk_2`;
