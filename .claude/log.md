# Log — Cajovna (nejnovější nahoře)

- [2026-07-18 10:22] Nákupní ceny čaje (NAKUP1-4) hotové na masteru (commity `d5156e7`/`98523b1`/`9503ba8`) — DB migrace, per-tabulková sync struktura (jen 01_caje dostává sloupce W-Z), zobrazení "Kč nákup" v ProduktyAdmin. Subagent-driven-development, final review "Ready to merge: Yes". Deploy na /testovaci zatím neproběhl, viz `tasks.md` (pořadí migrace→kód je závazné).
- [2026-07-18 00:35] Commit `3da5ae2` pushnut a nasazen na /testovaci (frontend build + backend cajovna.php/kasa.php).
- [2026-07-18 00:25] Admin Kasa + Dashboard přepracovány: sekce „Dnešní stav" má nové dlaždice „Dnes prodáno (ceník. ceny)" a přejmenované „Potvrzená tržba"/„Očekávaný zůstatek", „Dýžko / Manko" teď = Potvrzená tržba − ceníková cena (dřív rozdíl confirmed/calculated balance z uzávěrky), zobrazuje se vždy. Dashboard „Dýžko" sjednoceno se stejnou logikou (nový sloupec `cenikova_cena` v `listProdeje`), zrušena závislost na `getKasaClosings`. Dashboard: nové filtry období Dnes/Tento týden (jen tam, sdílený `PERIODS` pro Tržby nedotčen), výchozí filtr Dnes, titulek Přehled na vlastním řádku, odstraněno tlačítko Import DB (handler zůstal). Kasa: odstraněn titulek „Potvrzený zůstatek (Kč)" u uzávěrky.
- [2026-07-17 23:10] Oprava problikávání (commit `e2c56ce`) nasazena na /testovaci přes `deploy-testovaci.sh`.
- [2026-07-17 23:05] Oprava problikávání při přechodu mezi kroky POS (`CajovnaPOS.tsx`) — slide animační třída se počítala v `useEffect` (o krok pozadu za renderem), teď se počítá přímo v render těle přes ref. Commit `e2c56ce`.
- [2026-07-17 22:35] Storno prodeje v POS historii teď vyžaduje potvrzení (Ano/Zpět), dřív se stornovalo hned po kliknutí na tlačítko.
- [2026-07-17 22:20] Přehled prodejů v POS historii teď u položky zobrazuje i ceníkovou cenu v závorce (nové pole `cenik_cena` z `CENA1`–`CENA4`, backend `listPolozky`) — vidět rozdíl proti skutečně účtované ceně po editaci v confirm kroku.
- [2026-07-17 22:10] Drobečková navigace (kategorie — země — čaj) v hlavičce POS teď i na krocích balení, množství a ceny položky (dřív jen na výběru čaje).
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
