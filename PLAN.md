# Cajovna Web App – Plán

## Cíl
Webová aplikace pro provoz čajovny. Provoz na Forpsi sdíleném hostingu (Apache + PHP 7.4 + MySQL 5.7). Frontend jako React SPA, backend PHP REST API.

---

## Stack
- **Frontend:** React + TypeScript (Vite) → statický build
- **Backend:** PHP REST API (`/api/` složka)
- **DB:** MySQL 5.7 (Forpsi)
- **Auth:** JWT (PHP generuje, React ukládá v localStorage)
- **Lokální vývoj:** Docker (PHP + MariaDB kontejnery)

---

## Fáze vývoje

### Fáze 0 – Docker prostředí ✅
- [x] Nainstalovat Docker Desktop
- [x] Vytvořit `docker-compose.yml` (PHP 7.4 + MySQL 5.7 + phpMyAdmin)
- [x] Ověřit funkčnost: spustit schema.sql, otestovat PHP připojení k DB

### Fáze 1 – Základ (DB + Auth) ✅
- [x] schema.sql – všechny tabulky
- [x] seed skript – import dat z CSV do DB (294 čajů, 18 pytlíků, 30 kategorií)
- [x] PHP: db.php, middleware.php (JWT), config.php
- [x] PHP: auth.php (login/logout), users.php, products.php, bags.php, sales.php, stock.php
- [x] .htaccess – API routing + Authorization header fix
- [ ] React: Login stránka
- [ ] React: základní routing (role-based)

### Fáze 2 – Prodejní POS
- [ ] PHP: products.php, bags.php (GET endpointy)
- [ ] React POS: klávesnicová navigace kategorie → čaj → množství → pytlík → materiál → objem
- [ ] React POS: live fulltext search (psaní kdykoli přepne do search módu)
- [ ] React POS: košík (vždy viditelný, Tab = focus, Delete = smazat položku)
- [ ] React POS: dokončení prodeje (Enter na prázdném vstupu → sumarizace → Enter = zaplaceno)
- [ ] PHP: sales.php (POST nová tržba, payment_method default cash)
- [ ] Automatická úprava skladu po prodeji (kusy pro std/pkg1/pkg2, kg pro custom)

### Fáze 3 – Admin
- [ ] Správa uživatelů (CRUD prodavaček)
- [ ] Správa čajů (editace dat, ceny)
- [ ] Správa skladu (přičíst množství nebo nastavit přesně)
- [ ] Správa pytlíků (ceník obalů)
- [ ] Statistiky: denní/měsíční/roční tržby, tržby per prodavačka, nejprodávanější položky za období

### Fáze 4 – Deploy
- [ ] Build frontendu (npm run build)
- [ ] Upload na Wedos (FTP/SFTP)
- [ ] Nastavení .htaccess (SPA routing + API)
- [ ] Import DB na Wedos
- [ ] Test live

---

## Rizika a otevřené otázky
- **PHP na Forpsi** – PHP 7.4, MySQL 5.7 ověřeno, Docker image shodný s produkcí
- **CORS** – Vite dev server vs PHP API → nastavit Access-Control-Allow-Origin
- **.htaccess** – React SPA potřebuje fallback na index.html pro všechny routy
- **JWT bez composer** – pokud Wedos nemá composer, použít lightweight JWT helper bez dependencies
- **Import CSV** – data jsou nestrukturovaná (header řádky se opakují, prázdné řádky) → seed skript bude potřebovat filtrování
- **flag eshop_only** – zatím neimplementováno, sloupec v CSV bude upraven majitelem

---

## DB Schéma

### `users`
| sloupec | typ | popis |
|---|---|---|
| id | INT PK AI | |
| username | VARCHAR(100) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| role | ENUM('prodavacka','admin') | |
| active | TINYINT | 1/0 |
| created_at | DATETIME | |

---

### `tea_categories`
| sloupec | typ | popis |
|---|---|---|
| id | INT PK AI | |
| name | VARCHAR(100) | např. "BÍLÉ", "ZELENÉ" |
| parent_id | INT FK NULL | pro podkategorie (JAPONSKÉ, ČÍNSKÉ...) |
| sort_order | INT | řazení |

---

### `teas` (čaje)
| sloupec | typ | popis |
|---|---|---|
| id | INT PK AI | |
| category_id | INT FK | |
| name | VARCHAR(255) | |
| note | TEXT NULL | poznámka (např. "posledních 10ks", "skladem 2kg") |
| flag | ENUM('active','discontinued','no_insert','eshop_only','trial') | status |
| origin | VARCHAR(255) NULL | původ (Li Shan, Alishan...) |
| **Standardní balení** | | |
| std_weight_g | DECIMAL(8,1) NULL | |
| std_price_moc | INT NULL | MOC v Kč |
| std_price_voc | INT NULL | VOC v Kč (interní) |
| std_margin_pct | DECIMAL(5,1) NULL | % marže |
| **Balení 1** | | |
| pkg1_weight_g | DECIMAL(8,1) NULL | |
| pkg1_price_moc | INT NULL | |
| pkg1_price_voc | INT NULL | |
| pkg1_margin_pct | DECIMAL(5,1) NULL | |
| **Balení 2** | | |
| pkg2_weight_g | DECIMAL(8,1) NULL | |
| pkg2_price_moc | INT NULL | |
| pkg2_price_voc | INT NULL | |
| pkg2_margin_pct | DECIMAL(5,1) NULL | |
| **Sklad** | | |
| stock_std_pcs | INT DEFAULT 0 | počet ks standardní balení |
| stock_pkg1_pcs | INT DEFAULT 0 | |
| stock_pkg2_pcs | INT DEFAULT 0 | |
| stock_kg | DECIMAL(8,3) DEFAULT 0 | sklad v kg (sypaný/volná gramáž) |
| purchase_kg | DECIMAL(8,3) NULL | nákupní množství kg |
| tao_pct | DECIMAL(5,1) NULL | TAO % |
| trade_pct | DECIMAL(5,1) NULL | obch. % |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

### `bags` (pytlíky/sáčky) — pouze ceník, sklad se neeviduje
| sloupec | typ | popis |
|---|---|---|
| id | INT PK AI | |
| surface_type | VARCHAR(50) | PAPÍR, BÍLÝ MATNÝ, ČERNÝ MATNÝ, TRANSPARENTNÍ |
| volume_ml | INT | 100, 250, 500, 750, 1000 |
| dimensions | VARCHAR(100) NULL | rozměr string |
| price_per_piece | DECIMAL(8,2) | cena za 1ks |
| var1_qty | INT NULL | varianta 1 – počet ks |
| var1_price | INT NULL | cena celkem |
| var1_margin_pct | DECIMAL(5,1) NULL | |
| var2_qty | INT NULL | |
| var2_price | INT NULL | |
| var2_margin_pct | DECIMAL(5,1) NULL | |
| var3_qty | INT NULL | |
| var3_price | INT NULL | |
| var3_margin_pct | DECIMAL(5,1) NULL | |
| supplier_url | TEXT NULL | odkaz na dodavatele |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

### `sales` (prodeje – hlavička)
| sloupec | typ | popis |
|---|---|---|
| id | INT PK AI | |
| user_id | INT FK | kdo prodával |
| payment_method | ENUM('cash','card') DEFAULT 'cash' | neřeší se, vždy cash |
| total_amount | DECIMAL(10,2) | |
| note | TEXT NULL | |
| created_at | DATETIME | |

---

### `sale_items` (položky prodeje)
| sloupec | typ | popis |
|---|---|---|
| id | INT PK AI | |
| sale_id | INT FK | |
| tea_id | INT FK NULL | NULL pro bag položku |
| bag_id | INT FK NULL | vybraný pytlík (NULL = vlastní obal zákazníka) |
| item_type | ENUM('std','pkg1','pkg2','custom','bag') | bag = samostatný řádek pytlíku |
| weight_g | DECIMAL(8,1) NULL | pro custom: navážené množství |
| quantity | INT DEFAULT 1 | počet ks (pro předbalené) |
| unit_price | DECIMAL(8,2) | MOC za kus nebo za gram |
| total_price | DECIMAL(8,2) | |
| note | TEXT NULL | |

---

## POS UX — klávesnicové ovládání

Hlavní flow (vše šipkami + Enter):
1. **Výběr kategorie** — šipky nahoru/dolů, Enter potvrdí
2. **Výběr čaje** — šipky, Enter potvrdí
3. **Množství** — výchozí 1, šipky ±1, nebo přepsat číslem, Enter potvrdí
4. **Pytlík ano/ne** — výchozí Ano, šipky, Enter
5. **Materiál pytlíku** — šipky, Enter
6. **Objem pytlíku** — šipky, Enter
7. Položka (+ případný pytlík) se přidá do košíku → focus zpět na krok 1

**Search mód:** kdykoli prodavačka začne psát písmeno, zobrazí se live fulltext search přes celý sortiment. Výsledky procházet šipkami, Enter vybere čaj.

**Košík:** vždy viditelný. Tab přepne focus do košíku, šipky vyberou položku, Delete smaže.

**Dokončení prodeje:** Enter na prázdném vstupu (při neprázdném košíku) → sumarizační dialog → Enter = Zaplaceno → transakce se zapíše, sklad se odečte, košík se vyprázdní.

**Odečet skladu:** std/pkg1/pkg2 → kusy (`stock_*_pcs`), custom → kg (`stock_kg`).

**Zobrazuje se pouze MOC** (maloobchodní cena).

---

## Struktura projektu (lokální vývoj)

```
cajovna/
  frontend/          ← Vite + React + TS
    src/
      pages/
        Login.tsx
        POS.tsx          ← prodejní rozhraní
        Admin/
          Dashboard.tsx
          Products.tsx
          Bags.tsx
          Sales.tsx
          Users.tsx
      components/
      api/             ← fetch wrappery
    dist/              ← build → upload na hosting

  backend/            ← PHP API
    api/
      auth.php         ← POST /api/auth/login, /logout
      products.php     ← GET/POST/PUT/DELETE /api/products
      bags.php
      sales.php
      users.php
      stock.php        ← úpravy skladu
    config.php         ← DB přihlašovací údaje (NIKDY do gitu)
    middleware.php     ← JWT validace
    db.php             ← PDO wrapper

  db/
    schema.sql         ← CREATE TABLE skripty
    seed_csv.php       ← jednorázový import z CSV

  docker-compose.yml   ← lokální vývojové prostředí

  .gitignore           ← config.php, .env, node_modules, dist
```

---

## Poznámky k datům z CSV
- Kategorie jsou víceúrovňové (ZELENÉ > JAPONSKÉ/ČÍNSKÉ/VIETNAMSKÉ/NEPÁLSKÉ)
- Sloupce pro balení jsou nullable – ne každý čaj má všechny varianty
- Flag v 1. sloupci bude upraven — každý řádek bude mít příslušnou kategorii
- Některé řádky jsou čistě header (opakují se), ty seed skript přeskočí
- Sortiment: ~300+ aktivních položek (čaje, yerba maté, rooibos, bylinky)
