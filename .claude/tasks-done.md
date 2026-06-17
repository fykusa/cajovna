# Tasks — Cajovna (hotovo)

- [x] [2026-06-17] **POS Desktop — přístup na /pos-desktop** (#4): Desktop POS je dostupný přímo přes URL `/pos-desktop`. Prodavačka se po přihlášení routuje na `/cajovna`. Žádná select obrazovka.

- [x] [2026-06-17] **Google Sheets → DB Sync (fáze 2 — sync logika)** (#3): Záložka CAJE v Google Sheets → tabulka `01_caje` v DB. Sync logika implementována, merge do masteru.

- [x] [2026-06-17] **Fáze 4 — Deploy** (#2): Build, upload na Forpsi, .htaccess, import DB, test live. Produkce funkční.

- [x] [2026-06-13] **DB migrace — spustit `01_caje`**: Hotovo lokálně (2026-06-13). Na produkci spustit po deployi.

- [x] [2026-06-05] **POS — 3-panel redesign: Balení → Množství → Pytlík**: Nový krok `configure` nahradil sekvenční `quantity→bag_yn→bag_material→bag_volume`. Tři vertikální panely vedle sebe, ArrowLeft/Right přepíná aktivní panel, ArrowUp/Down naviguje uvnitř. Nová komponenta `ConfigurePanel.tsx`. Odstraněny `QuantityModal`, `QuantitySelector`, `BagSelector`. Helper funkce `getPackagingOptions` + `getBagList` exportovány z `usePOS.ts`. 152/152 testů. Merge `e02e26e`.

- [x] [2026-06-05] **Úprava History panelu — tabulkový přehled**: Přepracován HistoryPanel z jednoduchého seznamu na tabulkový přehled s 6 sloupci. 146/146 testů. Commity: `c7dbb47`–`7da8b85`.

- [x] [2026-06-05] **POS — Scroll do viditelnosti**: Šipky navigaci scrollují aktivní prvek do viditelnosti. `requestAnimationFrame` + `scrollIntoView`. 140/140 testů. Commit: `23c811c`.

- [x] [2026-06-05] **POS — Historia bug fixnuta (Forbidden)**: getSales a getSaleItems vyžadují `requireAuth()` místo `requireAdmin()`. Commity: `21ceab2`, `38bf9d1`.

- [x] [2026-06-05] **POS — Panel s historií dnešních prodejů**: Dvousloupcový layout levého POS panelu, HistoryPanel + SaleDetailView komponenty, keyboard navigace. 140/140 testů.

- [x] [2026-06-05] **POS — Escape zruší rozpracovanou položku**: CANCEL_ITEM reducer akce, Escape před INPUT guardem. 133/133 testů.

- [x] [2026-06-05] **POS — cena pytlíku v košíku**: Sdílený helper `cartTotals.ts`, pytlík jako vlastní řádek v košíku, total zahrnuje obal. 129/129 testů.

- [x] [2026-06-05] **Tržby — přepracování + Dashboard graf úpravy** (merge `1fcf851`): Denní/měsíční pivot, souhrn, HBarChart, fmtKc, periodRange. 127/127 testů.

- [x] [2026-06-05] **Dashboard — graf tržeb v čase** (merge `f096520`): RevenueChart SVG, revenueBuckets, nulové intervaly šedě.

- [x] [2026-06-05] **Dashboard — multi-select filtr kategorií a čajů** (merge `9cd7954`): Set místo jedné hodnoty, backend bere category_ids/tea_ids.

- [x] [2026-06-05] **Fix akce řádku po editaci** (merge `10fac7d`): merge `{ ...row, ...updated }` místo nahrazení.

- [x] [2026-06-05] **Export / Import celé DB** (merge `adbf961`): ZIP export, selektivní import, db_transfer.php, CSV s desetinnou čárkou, iconv autodetekce.

- [x] [2026-06-02] **Edit kategorií/pytlíků + EditableGrid + toasty** (merge `7e810da`): CRUD, FK-guard 409, dvoukrokové mazání, sdílený EditableGrid, toast notifikace. 109/109 testů.

- [x] [2026-05-31] **Admin Layout Redesign**: Horizontální header místo sidebaru. 81/81 testů. Commit: `345d0ed`.

- [x] [2026-05-29] **Fáze 3 — Admin KOMPLETNÍ**: Dashboard, Users, Products, Bags, Sales. 81 testů.

- [x] [2026-05-31] **Admin: Správa uživatelů**: Users.tsx, 5 testů. Commit: `4143b47`.

- [x] [2026-05-29] **Fáze 2 — POS KOMPLETNÍ**: usePOS hook, 7 komponent, keyboard handler, 5 E2E testů.

- [x] [2026-05-31] **Playwright E2E**: 5 testů POS flow. Commit: `f65005d`.

- [x] [2026-05-29] **POS stránka**: POS.tsx, keyboard handler, CheckoutDialog. Commit: `3da9b32`.

- [x] [2026-05-27] **Fáze 0 — Docker prostředí**: docker-compose.yml (PHP 7.4 + MySQL 5.7 + phpMyAdmin).

- [x] [2026-05-27] **DB schema**: schema.sql — users, tea_categories, teas, bags, sales, sale_items.

- [x] [2026-05-27] **PHP backend**: db.php, middleware.php (JWT), auth.php, products.php, bags.php, sales.php, stock.php.

- [x] [2026-05-28] **Seed import**: 294 čajů, 18 pytlíků, 30 kategorií z CSV.

- [x] [2026-05-28] **Fáze 2 — Foundation**: Scaffold, apiFetch, Zustand auth store, Login, ProtectedRoute+AppRouter. 21 testů.

- [x] [2026-05-28] **Task 0 — Vite scaffold + tooling**: Vite + React + TS, Vitest, Zustand, react-router-dom.
