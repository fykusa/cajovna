# KOD položky jako business klíč číselníku čajů

**Datum:** 2026-07-03
**Stav:** schváleno v brainstormingu, čeká na implementační plán

## Problém

Zdrojový Google Sheet (záložka CAJE) dostal nový sloupec **D = KOD** — jednoznačný, ručně přidělovaný kód položky (pattern `YYMM-K-DRUH-ZEME-C`, např. `2606-C-BILY-TAWN-01`; K: C=čaje, N=nádobí, E=ethnoshop). Staré nepoužívané položky se budou ze sheetu časem mazat.

Současný stav to nesnese: `01_caje` se synchronizuje přes TRUNCATE + INSERT s AUTO_INCREMENT `id`, takže **id není stabilní mezi syncy**. `00_prodej_polozky.caje_id` na něj přesto odkazuje (bez FK) a historie prodejů se přes něj JOINuje na název. Smazání řádku uprostřed sheetu posune všechna id pod ním → historické prodeje ukážou jiné čaje.

## Řešení (varianta A — schváleno)

`KOD` se stane business klíčem `01_caje`. Sync přejde z TRUNCATE + INSERT na **UPSERT podle KOD**; položky odstraněné ze sheetu zůstávají v DB označené `V_SHEETU = 0`. Prodeje odkazují na `caje_kod` s obnoveným FK. DB je trvalý akumulující číselník, sheet zůstává štíhlý zdroj aktuálního sortimentu.

Zamítnutá varianta B (TRUNCATE zachovat, snapshot názvu do prodeje): řeší jen zobrazení historie, ne identitu položek; duplikuje data a smazané položky by z DB zmizely úplně.

### Garance kódu

- Přiděluje ručně uživatel, je unikátní a u existující položky se nikdy nemění; po smazání se nikdy nepoužije pro jinou položku.
- Před nasazením budou mít kód vyplněný všechny řádky sheetu.
- Změna ostatních sloupců (název, ceny) u existujícího KOD = update atributů; historické prodeje pak ukazují nový název (záměr, ne bug).

## 1. DB schéma

Nová migrace `db/migration_2026-07-03_kod_polozky.sql`:

```sql
-- 01_caje: sync tabulka, data doteče z prvního syncu po nasazení
TRUNCATE TABLE `01_caje`;
ALTER TABLE `01_caje`
  ADD COLUMN `KOD` VARCHAR(32) NOT NULL AFTER `id`,
  ADD COLUMN `V_SHEETU` TINYINT(1) NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uq_kod` (`KOD`);

-- 00_prodej_polozky: jen test data, reálné prodeje neexistují
-- (TRUNCATE nelze na 00_prodej — míří na ni FK z polozek → DELETE + reset AI)
TRUNCATE TABLE `00_prodej_polozky`;
DELETE FROM `00_prodej`;
ALTER TABLE `00_prodej` AUTO_INCREMENT = 1;
ALTER TABLE `00_prodej_polozky`
  DROP COLUMN `caje_id`,
  ADD COLUMN `caje_kod` VARCHAR(32) NOT NULL AFTER `prodej_id`,
  ADD CONSTRAINT `fk_polozky_kod` FOREIGN KEY (`caje_kod`) REFERENCES `01_caje`(`KOD`);
```

- `id` zůstává interní PK (navenek ho nic nepoužívá), `KOD` je business klíč.
- `V_SHEETU = 1` → položka je aktuálně v sheetu; POS a číselník ukazují jen tyto. Historické JOINy vidí vše.
- FK se vrací (drop v `migration_2026-06-13_02_drop_caje_fk.sql` byl nutný kvůli TRUNCATE syncu, který končí). FK zároveň brání prodeji neexistujícího kódu.
- Pozn. k pořadí: `TRUNCATE 01_caje` proběhne dřív, než na ni vznikne nový FK (vzniká až posledním ALTERem), takže projde. Na `00_prodej` TRUNCATE nelze kvůli FK z položek — proto `DELETE` + reset AUTO_INCREMENT.

## 2. Sync (`backend/lib/sheets_sync.php`)

Nové mapování sloupců (vložení D posunulo vše od NAZEV o +1):

| DB sloupec | Sheet | Index (0-based) |
|---|---|---|
| KATEGORIE | A | 0 |
| ZEME | B | 1 |
| AKTIV | C | 2 |
| **KOD** | **D** | **3** |
| NAZEV | E | 4 |
| POZNAMKA | F | 5 |
| MN1 / CENA1 | G / H | 6 / 7 |
| MN2 / CENA2 | K / L | 10 / 11 |
| MN3 / CENA3 | O / P | 14 / 15 |
| MN4 / CENA4 | S / T | 18 / 19 |

Algoritmus `sheetsSyncCaje`:

1. Stáhnout a parsovat CSV (řádky 1–2 hlavička, beze změny).
2. Přeskočit řádky bez KATEGORIE, NAZEV **nebo KOD** (rozšíření stávající logiky).
3. Duplicitní KOD mezi parsovanými řádky → `RuntimeException` s konkrétním kódem v hlášce; sync spadne, transakce rollback, stará data netknutá.
4. V transakci: `UPDATE 01_caje SET V_SHEETU = 0`, pak per řádek `INSERT … ON DUPLICATE KEY UPDATE` (všechny datové sloupce + `V_SHEETU = 1`). Co v sheetu není, zůstane `V_SHEETU = 0`.
5. Bez TRUNCATE a bez vypínání `FOREIGN_KEY_CHECKS`.
6. Návratová hodnota `['synced' => N, 'vyrazeno' => M]` (M = počet řádků s `V_SHEETU = 0` po syncu).

## 3. Backend API

**`backend/api/cajovna.php`:**

- `createProdej`: položky nesou `caje_kod` (string) místo `caje_id`; validace `isset` upravena. Porušení FK (neznámý kód) → 400 „Neznámý kód položky" místo generické 500.
- `listPolozky`: `LEFT JOIN 01_caje c ON c.KOD = pp.caje_kod`; odpověď obsahuje `caje_kod`. LEFT JOIN zůstává jako levná pojistka, i když FK existenci garantuje.
- `listProdeje`: EXISTS filtry kategorie/země JOINují přes `c.KOD = pp.caje_kod`.
- `listKategorie`: přidat `AND V_SHEETU = 1`.

**`backend/api/teas.php`:** `listTeas` filtruje `WHERE V_SHEETU = 1` jako základ (POS i admin číselník = jen aktuální sortiment). `SELECT *` vrátí i `KOD`.

## 4. Frontend

- `types.ts`: `TeaRow.KOD: string`; položka prodeje `caje_id: number` → `caje_kod: string` (dtto `api/cajovna.ts`).
- `hooks/useCajovnaPOS.ts`: identita položky v košíku a payload `createProdej` přes `item.caj.KOD`.
- Fallback zobrazení v historii (`components/pos-cajovna/CajeHistory.tsx`, `pages/admin/Dashboard.tsx`): `it.nazev ?? it.caje_kod` (kód je čitelný, `Čaj #42` končí).
- Testy a mocky (`useCajovnaPOS.test.ts` aj.) dle mock patternu se statickým importem.

## 5. Test data a testy

- `backend/seed_testdata.php`: výběr čajů včetně `KOD`, insert prodejů přes `caje_kod`. Poskytne nová test data.
- Backend CLI test v `tools/` (styl `test_db_transfer.php`): parse nového mapování, duplicitní KOD → výjimka, upsert + označení vyřazených (`V_SHEETU`).
- Frontend: stávající unit testy upravené na `caje_kod`, vše zeleně.

## 6. Nasazení (pořadí)

1. Uživatel doplní kódy všem řádkům sheetu.
2. Migrace DB (lokálně i produkce).
3. Upload backendu + frontendu na FTP — **celá složka `backend/`**.
4. Spustit sync (naplní `01_caje` včetně KOD).
5. Lokálně seed test dat.

## Mimo rozsah

- Kategorie kódů N (nádobí) a E (ethnoshop) — připraveno formátem kódu, žádná logika teď.
- Migrace historických prodejů — nejsou reálné prodeje, tabulky se truncatují.
- Validace formátu kódu (pattern) při syncu — kód je ručně spravovaný, hlídá se jen unikátnost a přítomnost.
