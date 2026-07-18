-- Zamrazená ceníková a nákupní cena položky prodeje v okamžiku prodeje,
-- pro historicky přesný výpočet ziskovosti (nezávisle na pozdějším
-- syncu ze Sheets, který CENA1-4/NAKUP1-4 přepisuje). Staré řádky
-- zůstávají NULL — žádný zpětný dopočet.

ALTER TABLE `00_prodej_polozky`
  ADD COLUMN `celk_cena_cenik` INT NULL,
  ADD COLUMN `celk_cena_nakup` INT NULL;
