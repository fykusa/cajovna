# Ziskovost prodejů (ceníková cena vs. nákupní cena)

**Datum:** 2026-07-18
**Stav:** schváleno v brainstormingu

## Problém

Majitel chce v adminu vidět ziskovost podniku — kolik se vydělalo na rozdílu mezi ceníkovou cenou prodaných položek a jejich nákupní cenou (`01_caje.NAKUP1-4`, viz `2026-07-18-nakupni-ceny-caje-design.md`). Obě ceny (`CENA1-4` i `NAKUP1-4`) se ale mění syncem ze Sheets — počítat ziskovost „on the fly" JOINem na aktuální `01_caje` by u starších prodejů tiše přepočítávalo historii podle dnešních cen. Chceme historicky přesné číslo: cenu zamrazit v den prodeje.

## Řešení

### Datová vrstva

Dva nové sloupce na `00_prodej_polozky` (stejný typ jako existující `celk_cena`):

```sql
ALTER TABLE `00_prodej_polozky`
  ADD COLUMN `celk_cena_cenik` INT NULL,
  ADD COLUMN `celk_cena_nakup` INT NULL;
```

- `celk_cena_cenik` = ceníková cena (`CENA{baleni}` podle typu produktu) × `kusu`, zamrazená v okamžiku prodeje. Nezávisí na tom, za kolik se položka skutečně prodala (`celk_cena` může být upravená v kroku potvrzení ceny) — ziskovost se počítá vůči ceníku, ne vůči skutečně vybrané částce.
- `celk_cena_nakup` = nákupní cena (`NAKUP{baleni}`) × `kusu`, zamrazená stejně. `02_nadobi`/`03_etnoshop` zatím nemají sloupce `NAKUP1-4` (samostatný budoucí úkol) → u položek `PRODUKT_TYP != 'caje'` je `celk_cena_nakup` vždy `NULL`.
- Existující řádky (prodeje před touto migrací) mají oba sloupce `NULL` — žádný zpětný dopočet podle dnešních cen. Ziskovost je tedy dostupná a přesná jen od nasazení dál; starší prodeje ji nemají a do agregací se nezapočítají (viz níže).
- Pokud by v okamžiku prodeje `CENA{baleni}` byla `NULL` (nemělo by nastat běžným tokem POS, kde balení bez ceny nejde vybrat, ale pro jistotu), uloží se `celk_cena_cenik = NULL` — žádné tiché dosazení nuly.

### Zápis (`backend/api/cajovna.php::createProdej`)

Validace položek dnes běží ve smyčce, která pro každou položku spustí `SELECT 1 FROM \`$table\` WHERE KOD = ?` (ověření existence KODu). Tenhle dotaz se rozšíří na `SELECT CENA1,CENA2,CENA3,CENA4[,NAKUP1,NAKUP2,NAKUP3,NAKUP4 jen když $table === '01_caje'] FROM \`$table\` WHERE KOD = ?` — sloupcový seznam se skládá podle tabulky stejně jako `columnsForTable()` v syncu (`02_nadobi`/`03_etnoshop` nemají `NAKUP*` sloupce, dotaz na ně by spadl na "Unknown column").

Z vráceného řádku se podle `baleni` (1-4) vybere odpovídající `CENA{baleni}` a `NAKUP{baleni}` (u nádobí/etnoshopu `null`, sloupec neexistuje), vynásobí `kusu` a uloží do `celk_cena_cenik`/`celk_cena_nakup` při INSERTu do `00_prodej_polozky`. Žádná další validace navíc — pokud je `CENA{baleni}` `NULL`, `celk_cena_cenik` bude taky `NULL` (`NULL * cokoli` v PHP dopočtu se ošetří explicitně, ne spoléháním na SQL).

### Čtení (`backend/api/cajovna.php::listProdeje`)

Nové agregované pole na úrovni prodeje, počítané přímo ze zamrazených sloupců (žádný další JOIN na `01_caje`/`02_nadobi`/`03_etnoshop`):

```sql
(SELECT COALESCE(SUM(
    CASE WHEN pp.celk_cena_nakup IS NOT NULL
         THEN pp.celk_cena_cenik - pp.celk_cena_nakup ELSE 0 END
 ), 0) FROM `00_prodej_polozky` pp WHERE pp.prodej_id = p.id) AS zisk
```

Položky s neznámou nákupní cenou (nádobí/etnoshop, prodeje před nasazením) se do součtu `zisk` nezapočítávají vůbec — ne jako nulová marže, ale jako by v daném prodeji nebyly. `zisk` se vrací jako číslo (float po JSON encode, stejně jako `cenikova_cena` dnes).

### Frontend

- `frontend/src/types.ts`: `CajovnaProdej.zisk: number`.
- `Dashboard.tsx`: nová dlaždice „Zisk" ve stávajícím řádku statistik (`Tržby / Prodejů / Dýžko`), hodnota = součet `sale.zisk` přes `activeSales` (stejný vzorec jako dnešní `cenikSoucet`/`dyzko`, tedy respektuje filtr storna a vybraných prodavajících/kategorií).
- `Sales.tsx`: jedno souhrnné číslo „Zisk" za zvolené období (součet `zisk` přes `activeSales`), zobrazené jednou, bez rozpadu podle prodavající (ziskovost není vázaná na to, kdo prodával) — umístěno vedle stávajícího souhrnu celkových tržeb.

### Beze změny (mimo rozsah)

- Nádobí/etnoshop nákupní ceny — samostatný budoucí úkol (jiné sloupce, viz `2026-07-18-nakupni-ceny-caje-design.md`).
- Zpětný přepočet historických prodejů — vědomě vynechán, viz výše.
- Existující `cenikova_cena`/„Dýžko" (JOIN na aktuální `01_caje`, srovnání s potvrzenou tržbou) — zůstává beze změny, je to jiná metrika (dnešní ceníková cena vs. skutečně vybraná hotovost, ne ziskovost). Nepřepojuje se na nové zamrazené sloupce.
- Zobrazení ziskovosti na úrovni jednotlivé položky (`listPolozky`/`CajePolozkaSale`) — požadavek byl na souhrnné číslo v Dashboardu a na Tržbách, ne rozpad po položkách.

## Testy

- PHP CLI test pro `createProdej`: prodej čaje s platnou `NAKUP{baleni}` → `celk_cena_cenik`/`celk_cena_nakup` odpovídají `CENA{baleni}`/`NAKUP{baleni}` × `kusu`; prodej nádobí/etnoshopu → `celk_cena_nakup = NULL`, `celk_cena_cenik` vyplněné.
- PHP CLI test pro `listProdeje`: prodej se dvěma položkami (jedna se známou nákupní cenou, jedna bez) → `zisk` počítá jen tu první; prodej bez žádné položky se známou nákupní cenou → `zisk = 0`.
- Frontend testy: Dashboard dlaždice „Zisk" se součtem přes `activeSales` (respektuje storno), Sales.tsx souhrnné číslo „Zisk" za období.
