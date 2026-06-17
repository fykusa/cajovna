-- Soft-delete columns for sale cancellations (storno)
-- cancelled_by is NOT a FK for simplicity; referential integrity enforced at app layer
-- Invariant: if cancelled_at IS NOT NULL, then cancelled_by IS NOT NULL (app layer)
ALTER TABLE `00_prodej`
  ADD COLUMN `cancelled_at` DATETIME NULL DEFAULT NULL,
  ADD COLUMN `cancelled_by` INT NULL DEFAULT NULL,
  ADD INDEX `idx_00_prodej_cancelled_at` (`cancelled_at`);
