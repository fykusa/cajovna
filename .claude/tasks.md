# Tasks — Cajovna (čekající)

- [ ] [2026-07-07] **Sync — case-insensitive kolize KOD**: `assertUniqueKod` porovnává case-sensitive, ale `uq_kod` (utf8mb4 ci kolace) ne — kódy lišící se jen velikostí písmen by se tiše sloučily upsertem. Fix: normalizace `mb_strtoupper` v `assertUniqueKod`. (Nález z final review 2026-07-04.)
- [ ] [2026-07-07] **Zkontrolovat Apps Script po změně sync API**: `/api/admin/sheets-sync` nově vrací `synced` jako objekt `{synced, vyrazeno}` (dřív `{inserted}`). Pokud Apps Script odpověď parsuje, upravit; pokud fire-and-forget, jen ověřit a odškrtnout.
- [ ] [2026-07-08] **Skutečné překlopení na ostrou produkci (kořen domény)**: `/testovaci/` se prozatím bere jako produkce. Až přijde na řadu opravdový root `taocajovna.cz`: ověřit, jestli tamní `.htaccess` už má `CGIPassAuth On` (možná ano, viz starší incident s 403 na `/kasa/close`, kdy Authorization evidentně procházela), zopakovat migraci `db/migration_2026-07-03_kod_polozky.sql` (DB je sdílená s testovaci, takže tohle už možná není potřeba — ověřit), upload `backend/` + FE produkční build (`npm run build:production`) tam.

## Hotovo

- [x] [2026-07-07] **Deploy KOD + POS země na testovaci (bráno prozatím jako produkce)**: Migrace `db/migration_2026-07-03_kod_polozky.sql` proběhla (přes potíže s `PREPARE/EXECUTE` v phpMyAdmin a osiřelý index `fk_polozky_kod` po předchozím částečném pokusu — vyřešeno `DROP FOREIGN KEY` + opětovné `ADD CONSTRAINT`). Cestou se objevil a vyřešil samostatný bug: live `.htaccess` na Forpsi (běží jako `cgi-fcgi`) vůbec nepředával `Authorization` hlavičku do PHP → `CGIPassAuth On` přidáno přímo do live souboru (repo `backend/.htaccess` NENÍ to, co běží na serveru, viz [[production-deploy]]). Backend + FE (`npm run build`, testovaci mode) nahráno, sync ze Sheets proběhl, appka funguje.

