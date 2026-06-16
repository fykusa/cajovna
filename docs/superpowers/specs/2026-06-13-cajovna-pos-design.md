# Cajovna POS — Design Spec
_Datum: 2026-06-13_

## Kontext

Stávající `/pos` (MobilePOS) prodává čaje z tabulek `teas` + `tea_categories` a zahrnuje krok s výběrem obalu. Nový `/cajovna` POS prodává čaje přímo z `01_caje` (Google Sheets sync) bez obalů a zapisuje do nových tabulek `00_prodej` + `00_prodej_polozky`. Stávající `/pos` zůstává beze změny.

## Architektura

```
Google Sheets → 01_caje (sync)
                    ↓
           GET /api/teas  (existující)
                    ↓
         useCajovnaPOS hook
                    ↓
         CajovnaPOS stránka (/cajovna)
                    ↓
    POST /api/cajovna/prodej
                    ↓
    00_prodej + 00_prodej_polozky
```

## DB — nové tabulky

```sql
CREATE TABLE `00_prodej` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `user_id`    INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_kc`   INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `00_prodej_polozky` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `prodej_id` INT NOT NULL,
  `caje_id`   INT NOT NULL,
  `baleni`    TINYINT NOT NULL COMMENT '1=Standard 2=Větší 3=Největší 4=Čajovna',
  `kusu`      SMALLINT NOT NULL,
  `jedn_cena` INT NOT NULL,
  `celk_cena` INT NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`prodej_id`) REFERENCES `00_prodej`(`id`),
  FOREIGN KEY (`caje_id`) REFERENCES `01_caje`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Migrace starých prodejních dat se neprovádí — data v `00_prodej` začínají od nuly.

## Backend

### Soubory
| Soubor | Akce |
|---|---|
| `backend/api/cajovna.php` | CREATE — dva endpointy |
| `backend/.htaccess` | MODIFY — přidat route `api/cajovna` |
| `db/migration_2026-06-13_cajovna_prodej.sql` | CREATE — migrace dvou tabulek |

### Endpointy

**`POST /api/cajovna/prodej`** — vytvoří prodej (vyžaduje roli `prodavacka` nebo `admin`)

Request:
```json
{
  "polozky": [
    { "caje_id": 5, "baleni": 1, "kusu": 2, "jedn_cena": 130, "celk_cena": 260 }
  ]
}
```

Response:
```json
{ "prodej_id": 42, "total": 260 }
```

Logika: atomická transakce — INSERT do `00_prodej`, pak batch INSERT do `00_prodej_polozky`.

Chybové stavy: prázdné `polozky` → 400; neexistující `caje_id` → 400; DB chyba → 500.

**`GET /api/cajovna/prodeje`** — seznam prodejů pro historii (vyžaduje `prodavacka` nebo `admin`)

Response: pole `{ id, created_at, total_kc, username }` seřazené od nejnovějšího, limit 50.

## Frontend — typy

Nové typy přidat do `frontend/src/types.ts`:

```typescript
export interface CajeCategory {
  kategorie: string
  zeme: string | null
}

export interface CajeBaleni {
  cislo: 1 | 2 | 3 | 4
  label: 'Standard' | 'Větší' | 'Největší' | 'Čajovna'
  mn: number    // gramáž
  cena: number  // MOC v Kč
}

export interface CajeCartItem {
  localId: string
  caj: TeaRow
  baleni: CajeBaleni
  kusu: number
  celkCena: number
}

export interface CajovnaProdej {
  id: number
  created_at: string
  total_kc: number
  username: string
}
```

## Frontend — hook `useCajovnaPOS.ts`

Soubor: `frontend/src/hooks/useCajovnaPOS.ts`

**Datový zdroj:** načítá `TeaRow[]` přes existující `getTeas()`.

**Odvození kategorií:** z aktivních čajů (`AKTIV === 'x'`), unikátní páry `(KATEGORIE, ZEME)`, seřazené abecedně podle KATEGORIE.

**Flow (bez bags):**
```
home → categories → teas → packaging → quantity → checkout → success
```

**Balení:** z `TeaRow` se sestaví jen ty `CajeBaleni` kde MN+CENA nejsou null:
- `MN1+CENA1` → `{ cislo: 1, label: 'Standard', ... }`
- `MN2+CENA2` → `{ cislo: 2, label: 'Větší', ... }`
- `MN3+CENA3` → `{ cislo: 3, label: 'Největší', ... }`
- `MN4+CENA4` → `{ cislo: 4, label: 'Čajovna', ... }`

**goBack:** stejná logika jako v MobilePOS (krok zpět v pořadí views).

**confirmCheckout:** POST na `/api/cajovna/prodej`, sestaví payload z `CajeCartItem[]`.

## Frontend — komponenty

### Znovu použité beze změny
`MobileTopBar`, `MobileHeader`, `MobileProgressBar`, `MobileSuccess`, `MobileCheckout`, `MobileTeas`, `MobileQuantity`, `MobileHome`

> `MobileTeas` přijímá `{ id, name, note }[]` — `TeaRow` má `id` a `NAZEV`, proto přidáme adaptér v hooku: `{ id: r.id, name: r.NAZEV ?? '', note: r.POZNAMKA ?? null }`.

> `MobileCheckout` a `MobileHome` pracují s polem položek — potřebují dostat `CajeCartItem[]` přizpůsobené jejich props (label = NAZEV + label balení + kusy).

### Nové komponenty
| Soubor | Popis |
|---|---|
| `CajeCategories.tsx` + `.module.css` | Tlačítka kategorie ve formátu „BÍLÝ — Čína" |
| `CajePackaging.tsx` + `.module.css` | Tlačítka balení (Standard/Větší/Největší/Čajovna + gramáž + cena) |
| `CajeHistory.tsx` + `.module.css` | Seznam prodejů z `00_prodej` (kopie MobileHistory) |

### Nová stránka
`frontend/src/pages/CajovnaPOS.tsx` — kopie struktury `MobilePOS.tsx`, používá `useCajovnaPOS`.

## Frontend — API

Nový soubor `frontend/src/api/cajovna.ts`:
- `createCajovnaSale(polozky)` → POST /api/cajovna/prodej
- `getCajovnaProdeje()` → GET /api/cajovna/prodeje

## Router

`AppRouter.tsx` — přidat route:
```tsx
<Route path="/cajovna" element={
  <ProtectedRoute requiredRole="prodavacka">
    <CajovnaPOS />
  </ProtectedRoute>
} />
```

## Co se nemění

- `/pos` (MobilePOS) a `/pos-desktop` (POS) — beze změny
- Tabulky `teas`, `tea_categories`, `sales`, `sale_items` — beze změny
- Stávající `useMobilePOS.ts` — beze změny

## Testování

- Vitest: nový `useCajovnaPOS.test.ts` — odvození kategorií, sestavení balení, goBack flow
- Manuální: přihlásit se jako prodavacka, projít celý flow `/cajovna`, ověřit zápis v DB
