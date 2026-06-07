# TAO čajovna — pokladní systém

Pokladní a evidenční systém pro čajovnu. Mobilní POS pro obsluhu, admin rozhraní pro přehled tržeb a správu dat.

**Live ukázka:** [taocajovna.cz/testovaci](https://taocajovna.cz/testovaci)

---

## Co aplikace umí

**POS (pokladna)**
- Výběr čaje podle kategorie nebo vyhledáváním
- Konfigurace balení a pytlíku (obalu) v jednom kroku
- Košík s cenami včetně obalů, pokladní tlačítko
- Historie dnešních prodejů přímo v POS
- Plně ovladatelné klávesnicí i dotykem (mobilní layout)

**Admin**
- Přehled tržeb s filtry (období, kategorie, prodavač), sloupcový graf
- Stránka Tržby: denní a měsíční pivot podle prodavačů, grafický souhrn
- Správa čajů (294 položek), kategorií (30), obalů, uživatelů — inline editace
- Export prodejů do CSV, export/import celé DB jako ZIP

---

## Technický stack

| Vrstva | Technologie |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, Zustand |
| Backend | PHP 7.4, PDO, vlastní JWT (bez knihoven) |
| Databáze | MySQL 5.7 |
| Testy | Vitest (152 unit testů), Playwright (6 E2E testů) |
| Lokální dev | Docker Compose (PHP + MySQL + phpMyAdmin) |

---

## Lokální spuštění

**Požadavky:** Docker Desktop, Node.js 18+

```bash
# 1. Backend (PHP + MySQL)
docker compose up -d
# API běží na http://localhost:8080

# 2. Frontend
cd frontend
npm install
npm run dev
# App běží na http://localhost:5173
```

**Přihlašovací údaje (lokálně):**
- `admin` / `admin` → `/admin`
- `prodavacka` / `prodavacka123` → `/pos`

---

## Struktura projektu

```
backend/
  api/          # PHP endpointy (auth, products, sales, bags, …)
  lib/          # sdílené utility (db_transfer pro export/import)
  config.php    # DB připojení a JWT secret (NENÍ v gitu)
  db.php        # PDO helper
  middleware.php# JWT autentizace
  install.php   # jednorázový instalační skript
frontend/
  src/
    api/        # fetch klienti pro každý endpoint
    components/ # sdílené komponenty (EditableGrid, Toast, …)
    pages/      # stránky (POS, admin/Dashboard, Sales, Items, …)
    router/     # AppRouter, ProtectedRoute
    store/      # Zustand auth store
db/
  schema.sql    # DDL — tabulky users, teas, bags, sales, …
docker-compose.yml
```

---

## Nasazení (Apache / Forpsi)

Build pro podsložku `testovaci`:
```bash
cd frontend
npm run build          # → dist/ s base /testovaci/
```

Build pro root domény:
```bash
npm run build:production   # → dist/ s base /
```

**Struktura na serveru** (obsah `dist/` + PHP backend):
```
testovaci/
  index.html, .htaccess, assets/   ← z dist/
  config.php                        ← backend/config_Forpsi.php (přejmenovat!)
  db.php, middleware.php            ← backend/
  lib/                              ← backend/lib/
  api/                              ← backend/api/
```

Při první instalaci nahraj `backend/install.php` → spusť v prohlížeči → smaž.

---

## Testy

```bash
cd frontend
npm run test          # Vitest unit testy
npx playwright test   # E2E testy (vyžaduje běžící docker + dev server)
```
