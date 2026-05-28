# Tasks — Cajovna

## Čekající

- [ ] [2026-05-28] **Fáze 2 — React frontend**: Vite + React + TS scaffold, Login stránka, základní routing (role-based), POS rozhraní s klávesnicovým ovládáním, košík, dokončení prodeje.
- [ ] [2026-05-28] **Fáze 3 — Admin**: Správa uživatelů, čajů, skladu, pytlíků, statistiky.
- [ ] [2026-05-28] **Fáze 4 — Deploy**: Build, upload na Forpsi, .htaccess, import DB, test live.

## Hotovo

- [x] [2026-05-27] **Fáze 0 — Docker prostředí**: docker-compose.yml (PHP 7.4 + MySQL 5.7 + phpMyAdmin), ověřena funkčnost.
- [x] [2026-05-27] **DB schema**: schema.sql — tabulky users, tea_categories, teas, bags, sales, sale_items.
- [x] [2026-05-27] **PHP backend**: db.php, config.php, middleware.php (JWT), auth.php, users.php, products.php, bags.php, sales.php, stock.php, .htaccess.
- [x] [2026-05-28] **Seed import**: seed.php — 294 čajů, 18 pytlíků, 30 kategorií importováno z CSV. db_reset.php pro reset dat.
