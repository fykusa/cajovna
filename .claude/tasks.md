# Tasks — Cajovna (čekající)

- [ ] #1 [2026-06-02] **Storno prodejů**: Admin může stornovat (a) **konkrétní položku** v prodeji (`sale_items`) i (b) **celý prodej** (`sales`). DB příprava: přidat sloupec pro storno — návrh `cancelled_at DATETIME NULL` na `sale_items` i `sales` (kdo/proč případně `cancel_reason`/`cancelled_by`). Backend: admin-only endpointy pro storno položky a prodeje. Rozhodnout: (1) zda storno **vrací zboží na sklad** (`stock_*`/`stock_kg`); (2) jak se stornované položky/prodeje promítnou do tržeb (Dashboard/Sales) — vyloučit z součtů, zobrazit přeškrtnuté/zvlášť. UI: akce „Stornovat" u položky i u prodeje (s potvrzením). Udělat jako featuru: brainstorm → spec → plán.

- [ ] #2 [2026-05-28] **Fáze 4 — Deploy**: Build, upload na Forpsi, .htaccess, import DB, test live.

- [ ] #3 [2026-06-13] **Google Sheets → DB Sync (fáze 2 — sync logika)**: Záložka `CAJE` v Google Sheets (soubor „TEST zapisu", ID: `1CP55uYVmfyx8hL0SCdjKHQ2-00Yn0Uhfr-LY6Ige18E`) → tabulka `01_caje` v DB. Spec: `docs/superpowers/specs/2026-06-08-google-sheets-sync-design.md`. Plán: `docs/superpowers/plans/2026-06-13-sheets-sync.md` (8 tasků — pokračovat od Task 1). **Fáze 1 hotová**: tabulka `01_caje` + backend `GET /api/teas` + frontend stránka TEAs v adminu.

- [ ] #4 [2026-06-07] **POS Desktop — přístup na /pos-desktop**: Stránka `/pos-desktop` (klávesnicový POS) je v routeru definována, ale není odkaz v navigaci ani jasný způsob jak se tam dostat. Vyřešit přístup — buď přidat odkaz v POS menu / admin panelu, nebo jinak zpřístupnit pro obsluhu.
