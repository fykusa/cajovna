-- Migrace: přidání sloupce password_changed_at do users.
-- Aplikuje se na již běžící DB (schema.sql se spouští jen při init prázdné DB).
ALTER TABLE `users`
  ADD COLUMN `password_changed_at` DATETIME NULL DEFAULT NULL AFTER `created_at`;

-- Stávajícím uživatelům nastav „naposledy změněno" = datum vytvoření účtu.
UPDATE `users`
  SET `password_changed_at` = `created_at`
  WHERE `password_changed_at` IS NULL;
