# Log — Cajovna (nejnovější nahoře)

Jednořádkové záznamy toho, co se stalo/rozhodlo — timeline napříč sessions.
Otevřené úkoly viz `tasks.md`, hluboký detail/proč viz `memory/` (mimo repo, jen pro Claude).

- [2026-07-17 18:24] Založen tenhle log — na začátku session čti posledních ~30 řádků, do hloubky jen na vyžádání.
- [2026-07-09] Editovatelná zaplacená částka v CajeCheckout (default = dopočtená suma) + fix UTC/lokální datum bugu v CajeHistory, nasazeno na testovaci.
- [2026-07-09] Minimální délka hesla snížena z 6 na 4 znaky (požadavek majitele), nasazeno.
- [2026-07-09] Bezpečnostní úklid živého /testovaci — smazány nechráněné dev/CLI skripty (db_reset.php, seed*.php, install.php, tools/*, aj.) přímo dostupné přes URL.
- [2026-07-09] Deploy skript opraven — živý server má PLOCHOU strukturu (žádný backend/ podadresář); `deploy/deploy-testovaci.sh` vytvořen a zprovozněn (curl-based FTP, whitelist).
- [2026-07-09] Nádobí + Etnoshop feature nasazena na testovaci (merge `036ace3`, migrace spuštěna přes phpMyAdmin, sync ověřen end-to-end).
- [2026-07-08] Nádobí + Etnoshop feature dokončena (9 tasků + final review, subagent-driven-development), branch feat/nadobi-etnoshop.
- [2026-07-07] Deploy KOD položky + POS výběr zemí na testovaci, `CGIPassAuth On` fix pro cgi-fcgi Authorization header.
- [2026-07-07] Search box čajů v CajeCategories (bez diakritiky, case-insensitive), přímo na master.
