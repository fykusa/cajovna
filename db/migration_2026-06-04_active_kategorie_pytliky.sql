-- Migrace: přidání sloupce `active` do tea_categories a bags.
-- Umožní deaktivaci (soft delete) místo hard delete u použitých položek.
-- Aplikuje se na již běžící DB (schema.sql se spouští jen při init prázdné DB).
ALTER TABLE `tea_categories`
  ADD COLUMN `active` TINYINT NOT NULL DEFAULT 1 AFTER `sort_order`;

ALTER TABLE `bags`
  ADD COLUMN `active` TINYINT NOT NULL DEFAULT 1 AFTER `price_per_piece`;
