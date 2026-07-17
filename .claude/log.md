# Log — Cajovna (nejnovější nahoře)

- [2026-07-17 21:45] Zrušen `/pos` a `/pos-desktop`, zůstává jen `/cajovna`. Smazáno 44 souborů, 3 sdílené (`MobileHeader`, `MobileTopBar`, přejmenovaný `CajovnaPOS.module.css`) zachovány. 184/184 testů, tsc čistý.
- [2026-07-17 21:35] Přidán krok potvrzení/editace ceny položky v /cajovna pokladně (nový view 'confirm', `CajeConfirmPrice.tsx`), TDD, 258/258 testů zelených. Rozhodnuto: `/pos` + `/pos-desktop` se v budoucnu zruší, zůstane jen `/cajovna` (samostatný task v tasks.md).

Jednořádkové záznamy toho, co se stalo/rozhodlo — timeline napříč sessions.
Otevřené úkoly viz `tasks.md`, hluboký detail/proč viz `memory/` (mimo repo, jen pro Claude).

- [2026-07-17 20:33] Vyřešeny 3 čekající tasky (mimo produkční deploy): case-insensitive fix `assertUniqueKod` (mb_strtoupper), ověřen Apps Script (fire-and-forget, žádná úprava netřeba), dead code cleanup (`backend/index.php`, `getTeas()`). Testy zelené (24 backend + 252 frontend).
- [2026-07-17 18:24] Založen tenhle log — na začátku session čti posledních ~30 řádků, do hloubky jen na vyžádání.
- [2026-07-09] Editovatelná zaplacená částka v CajeCheckout (default = dopočtená suma) + fix UTC/lokální datum bugu v CajeHistory, nasazeno na testovaci.
- [2026-07-09] Minimální délka hesla snížena z 6 na 4 znaky (požadavek majitele), nasazeno.
- [2026-07-09] Bezpečnostní úklid živého /testovaci — smazány nechráněné dev/CLI skripty (db_reset.php, seed*.php, install.php, tools/*, aj.) přímo dostupné přes URL.
- [2026-07-09] Deploy skript opraven — živý server má PLOCHOU strukturu (žádný backend/ podadresář); `deploy/deploy-testovaci.sh` vytvořen a zprovozněn (curl-based FTP, whitelist).
- [2026-07-09] Nádobí + Etnoshop feature nasazena na testovaci (merge `036ace3`, migrace spuštěna přes phpMyAdmin, sync ověřen end-to-end).
- [2026-07-08] Nádobí + Etnoshop feature dokončena (9 tasků + final review, subagent-driven-development), branch feat/nadobi-etnoshop.
- [2026-07-07] Deploy KOD položky + POS výběr zemí na testovaci, `CGIPassAuth On` fix pro cgi-fcgi Authorization header.
- [2026-07-07] Search box čajů v CajeCategories (bez diakritiky, case-insensitive), přímo na master.
