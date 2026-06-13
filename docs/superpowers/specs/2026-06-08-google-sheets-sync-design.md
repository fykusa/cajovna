# Google Sheets → DB Sync — Design Spec
_Datum: 2026-06-08, aktualizováno 2026-06-13_

## Kontext

Google Sheets je source of truth pro produktová data (kategorie, čaje). Aplikace (cajovna POS, e-shop, …) čtou z MySQL DB na Forpsi. Sync přenáší změny ze Sheets do DB jednosměrně.

## Architektura (pull on ping)

```
Google Sheets (edit)
  → Apps Script onChange trigger
      → POST /api/admin/sheets-sync  (ping, bez dat)
          → PHP fetchne CSV URL záložky CAJE z Google
              → parse + upsert + soft-delete
                  → MySQL
```

Totéž volá manuální tlačítko „Synchronizovat" v Admin Dashboard.

## Google Sheets soubor

**Soubor:** „TEST zapisu" (ID: `1CP55uYVmfyx8hL0SCdjKHQ2-00Yn0Uhfr-LY6Ige18E`, vlastník: taocajovna@gmail.com)

**Záložky:** `caje_puvodni` (archiv, nečteme), `CAJE` (sync), `OBALY` (zatím nereší)

Záložka `CAJE` je publikovaná přes **Soubor → Sdílet → Publikovat na webu** jako CSV. URL se uloží do PHP konfigurace.

## Mapování sloupců — záložka CAJE

| Sloupec v sheetu | Popis | DB cíl |
|---|---|---|
| A — KATEGORIE | textový název kategorie | `tea_categories.name` (lookup → category_id) |
| B — ZEMĚ | země původu kategorie | `tea_categories.zeme` (nový sloupec) |
| C — AKTIV | `x` = aktivní, prázdné = neaktivní | `teas.flag`: `x`→`active`, prázdné→`discontinued` |
| D — NÁZEV | název čaje | `teas.name` (přirozený klíč) |
| E — POZNÁMKA | poznámka | `teas.note` |
| F — std množství (g) | standardní balení gramáž | `teas.std_weight_g` |
| G — std MOC | standardní balení MOC | `teas.std_price_moc` |
| H, I | std VOC, std % | **ignorovat** |
| J — větší množství (g) | větší balení gramáž | `teas.pkg1_weight_g` |
| K — větší MOC | větší balení MOC | `teas.pkg1_price_moc` |
| L, M | větší VOC, větší % | **ignorovat** |
| N — největší množství (g) | největší balení gramáž | `teas.pkg2_weight_g` |
| O — největší MOC | největší balení MOC | `teas.pkg2_price_moc` |
| P+ | V čajovně, NÁKUP, … | **ignorovat** |

> VOC, marže a nákupní data se ze sheetu neberou — zůstávají v DB beze změny.
> Skladové sloupce (`stock_*`) jsou mimo sync — mění se při prodeji.

## Sync logika (PHP)

Pořadí: kategorie → čaje (FK závislost).

### 1. Kategorie (z CAJE záložky)

Z každého řádku extrahuj unikátní páry `(KATEGORIE, ZEMĚ)`:

```sql
INSERT INTO tea_categories (name, zeme, active)
VALUES (?, ?, 1)
ON DUPLICATE KEY UPDATE zeme = VALUES(zeme), active = 1
```

Unique key: `name`.

Soft-delete kategorií, které v sheetu chybí a nemají aktivní čaje:
```sql
UPDATE tea_categories SET active = 0
WHERE name NOT IN (...) AND id NOT IN (
    SELECT DISTINCT category_id FROM teas WHERE flag = 'active'
)
```

### 2. Čaje

Pro každý řádek sheetu:

```sql
INSERT INTO teas (category_id, name, note, flag, std_weight_g, std_price_moc,
                  pkg1_weight_g, pkg1_price_moc, pkg2_weight_g, pkg2_price_moc)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  note = VALUES(note),
  flag = VALUES(flag),
  std_weight_g = VALUES(std_weight_g),
  std_price_moc = VALUES(std_price_moc),
  pkg1_weight_g = VALUES(pkg1_weight_g),
  pkg1_price_moc = VALUES(pkg1_price_moc),
  pkg2_weight_g = VALUES(pkg2_weight_g),
  pkg2_price_moc = VALUES(pkg2_price_moc)
```

Unique key: `name`.

Soft-delete čajů v DB, které v sheetu chybí:
```sql
UPDATE teas SET flag = 'discontinued' WHERE name NOT IN (...)
```

### Chybové chování

- Fetch CSV selže → abort, DB se nemění
- Neznámá kategorie u čaje → přeskočit řádek, zalogovat
- Chyby: `{ "ok": false, "error": "..." }`
- Úspěch: `{ "ok": true, "synced": { "categories": {upserted, deactivated}, "teas": {upserted, discontinued} } }`

## Databázové migrace

| Migrace | SQL |
|---|---|
| `tea_categories`: přidat `zeme` | `ALTER TABLE tea_categories ADD COLUMN zeme VARCHAR(100) NULL AFTER name;` |
| `tea_categories`: UNIQUE KEY na `name` | `ALTER TABLE tea_categories ADD UNIQUE KEY uq_tea_categories_name (name);` |
| `teas`: UNIQUE KEY na `name` | `ALTER TABLE teas ADD UNIQUE KEY uq_teas_name (name);` |

Soubor: `db/migration_2026-06-13_sheets_sync.sql`

## Google Apps Script

Umístění: **Extensions → Apps Script** v Google Sheets souboru.

```js
const SYNC_URL   = 'https://taocajovna.cz/api/admin/sheets-sync';
const SYNC_TOKEN = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');

function onSheetChange(e) {
  UrlFetchApp.fetch(SYNC_URL, {
    method: 'post',
    headers: { 'X-Sync-Token': SYNC_TOKEN },
    muteHttpExceptions: true,
  });
}

function setupTrigger() {
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();
}
```

`SYNC_TOKEN` se nastaví v **Project Settings → Script Properties** — neukládá se do kódu.

## Konfigurace na serveru

`backend/config/sheets.php` (přidat do `.gitignore`):

```php
<?php
return [
    'sync_token' => 'REPLACE_WITH_SECRET',
    'csv_urls'   => [
        'caje' => 'https://docs.google.com/spreadsheets/d/1CP55uYVmfyx8hL0SCdjKHQ2-00Yn0Uhfr-LY6Ige18E/pub?gid=CAJE_GID&single=true&output=csv',
    ],
];
```

> `gid` konkrétní záložky CAJE zjistit z URL při publikování.

## Autentizace endpointu

Endpoint `POST /api/admin/sheets-sync` přijímá dvě formy auth:
- **Apps Script (automatický sync):** hlavička `X-Sync-Token: <secret>`
- **Manuální sync z Dashboardu:** standardní admin session (`requireAdmin`)

Obě větve volají stejnou sync funkci.

## Frontend

- Tlačítko **„Synchronizovat ze Sheets"** v Admin Dashboard (vedle Export/Import DB)
- Volá `POST /api/admin/sheets-sync` přes `apiFetch`
- Toast: úspěch s počty (upsertováno X čajů, Y kategorií) / chyba s textem

## Soubory k vytvoření/upravení

| Soubor | Akce |
|---|---|
| `db/migration_2026-06-13_sheets_sync.sql` | nový — migrace (zeme, unique keys) |
| `backend/config/sheets.php` | nový — CSV URL + token (gitignore) |
| `backend/lib/sheets_sync.php` | nový — sync logika |
| `backend/api/admin.php` | upravit — přidat route `sheets-sync` |
| Apps Script | v Google Sheets, mimo repo |
| `frontend/src/api/admin.ts` | upravit — přidat `syncFromSheets()` |
| `frontend/src/pages/admin/Dashboard.tsx` | upravit — tlačítko + toast |

## Scope mimo tuto featuru

- Záložka OBALY — implementovat až bude finální struktura
- VOC, marže, nákupní data — zůstávají jen v DB, sheet je neřídí
- Sync log v DB — nice to have, ne v první verzi
