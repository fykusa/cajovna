# Tasks — Cajovna

## Čekající

- [ ] [2026-05-28] **Fáze 4 — Deploy**: Build, upload na Forpsi, .htaccess, import DB, test live.

## Hotovo

- [x] [2026-05-31] **Task 18 — Admin Layout Redesign**: AdminLayout změněno z vertikálního sidebaru na horizontální header. Menu items běží vedle "Čajovna Admin" nahoře. CSS refactor (flexbox layout). TypeScript fixes (import type, removed erasableSyntaxOnly, created vitest.config.ts). Všechny testy: 81/81 pass. Commit: 345d0ed.

- [x] [2026-05-29] **Fáze 3 — Admin KOMPLETNÍ**: AdminLayout+Dashboard, Users (inline confirm delete), Products+Stock, Bags, Sales. 81 unit testů. Commity: cc684a3→fb36820.

- [x] [2026-05-31] **Task 17 — Admin: Správa uživatelů**: Users.tsx (tabulka + add form + delete), Users.module.css, 5 unit testů (5/5 passed). Opraven mock ordering bug v deleteUser testu. Commit: 4143b47.

- [x] [2026-05-29] **Fáze 2 — POS KOMPLETNÍ**: usePOS hook, 7 komponent, POS stránka s keyboard handlerem, 5 Playwright E2E testů. 67 unit testů + 5 E2E. Commity: 0bfe46f→e1cd0a1.
- [x] [2026-05-31] **Task 15 — Playwright E2E**: 5 testů pro POS flow — kategorie, navigace, vyhledávání, kompletní prodej bez pytlíku. Opraveny value imports na `import type` (Vite ESM bug). DB uživatel `prodavacka` přidán. Commit: f65005d.

- [x] [2026-05-29] **Task 14 — POS stránka**: POS.tsx sestavena z usePOS + 7 komponent, keyboard handler (ArrowUp/Down/Enter/Escape/Backspace/znaky), CheckoutDialog integrace. POS.module.css layout. 3 testy, 67 celkem passed. Commit: 3da9b32.

- [x] [2026-05-27] **Fáze 0 — Docker prostředí**: docker-compose.yml (PHP 7.4 + MySQL 5.7 + phpMyAdmin), ověřena funkčnost.
- [x] [2026-05-27] **DB schema**: schema.sql — tabulky users, tea_categories, teas, bags, sales, sale_items.
- [x] [2026-05-27] **PHP backend**: db.php, config.php, middleware.php (JWT), auth.php, users.php, products.php, bags.php, sales.php, stock.php, .htaccess.
- [x] [2026-05-28] **Seed import**: seed.php — 294 čajů, 18 pytlíků, 30 kategorií importováno z CSV. db_reset.php pro reset dat.
- [x] [2026-05-28] **Fáze 2 — Foundation**: Scaffold, API client (apiFetch+ApiError+všechny moduly), Zustand auth store, Login stránka, role-based routing (ProtectedRoute+AppRouter). 21 testů. Commity: 2e0e181→73ddd1b.
- [x] [2026-05-28] **Task 0 — Vite scaffold + tooling**: Vite + React + TS, Vitest, Zustand, react-router-dom, proxy /api→8080, placeholder AppRouter. Commit: feat: vite + react + ts scaffold s vitest a zustand.
