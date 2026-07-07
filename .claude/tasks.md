# Tasks — Cajovna (čekající)

- [ ] [2026-07-07] **Sync — case-insensitive kolize KOD**: `assertUniqueKod` porovnává case-sensitive, ale `uq_kod` (utf8mb4 ci kolace) ne — kódy lišící se jen velikostí písmen by se tiše sloučily upsertem. Fix: normalizace `mb_strtoupper` v `assertUniqueKod`. (Nález z final review 2026-07-04.)
- [ ] [2026-07-07] **Zkontrolovat Apps Script po změně sync API**: `/api/admin/sheets-sync` nově vrací `synced` jako objekt `{synced, vyrazeno}` (dřív `{inserted}`). Pokud Apps Script odpověď parsuje, upravit; pokud fire-and-forget, jen ověřit a odškrtnout.
- [ ] [2026-07-07] **Deploy KOD + POS země na produkci**: 1) migrace `db/migration_2026-07-03_kod_polozky.sql`, 2) upload celé složky `backend/` na FTP, 3) FE build + upload, 4) spustit sync ze Sheets. Sheet už kódy má.

