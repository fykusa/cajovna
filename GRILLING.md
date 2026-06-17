# Cajovna – Detailní poznámky z grill session (2026-05-27)

## Uživatelé a role

- Dvě role: `prodavacka` a `admin`
- Prodavačka stojí u pultu, používá tablet nebo notebook
- POS musí být rychlé — celý průchod jedním prodejem do 30 sekund

---

## Košík a průběh prodeje

- Košík s více položkami je běžný stav, ne výjimka
- Zákazníci typicky kupují více čajů najednou

---

## item_type a typy položek

- `sample` (vzorek) zrušen — nebyl ani v schema.sql, byl jen v plánovacím dokumentu omylem
- Platné typy: `std`, `pkg1`, `pkg2`, `custom`, `bag`
- `bag` je samostatný řádek v košíku (pytlík jako položka zvlášť od čaje)

---

## Custom položka (volná gramáž)

- Zákazník si donese vlastní obal
- Čaj se na místě odváží
- Cena se počítá z gramáže (cena/g)
- `bag_id` je v tomto případě NULL

---

## Pytlíky (bags)

- Tabulka `bags` slouží pouze jako ceník obalů
- Sklad pytlíků se **neeviduje** — jsou spotřební materiál
- Pytlík je v košíku samostatná položka (`item_type = 'bag'`)
- Flow výběru pytlíku je součástí hlavního POS flow po výběru množství čaje

---

## Sklad

- Předbalené čaje (std/pkg1/pkg2): sklad v kusech — `stock_std_pcs`, `stock_pkg1_pcs`, `stock_pkg2_pcs`
- Sypaný/volná gramáž (custom): sklad v kg — `stock_kg` (přidáno, v původním schématu chybělo)
- `purchase_kg` je nákupní množství (historická data), **není** aktuální stav skladu
- Naskladnění v admin sekci: dvě operace:
  - **Přičíst** — běžné po nákupu zboží
  - **Nastavit přesně** — pro inventuru

---

## Flag / status čaje

- `eshop_only` zatím neimplementovat — sloupec v CSV bude majitelem upraven
- `trial` (na zkoušku) — zobrazení v POS bude konfigurovatelné (checkbox v nastavení aplikace)
- V POS se zobrazují pouze čaje s `flag = 'active'` (a případně `trial` dle konfigurace)
- Čaje s `discontinued`, `no_insert`, `eshop_only` se v POS nezobrazí

---

## Sortiment

- ~300+ aktivních položek celkem (čaje, yerba maté, rooibos, bylinky)
- Kategorie jsou víceúrovňové: např. ZELENÉ > JAPONSKÉ > konkrétní čaje
- Sloupec 1 v CSV (flag) bude upraven — každý řádek bude mít příslušnou kategorii

---

## POS UX — klávesnicové ovládání (detailně)

### Hlavní flow
1. **Výběr kategorie** — šipky nahoru/dolů, Enter potvrdí
2. **Výběr čaje ze seznamu** — šipky, Enter potvrdí
3. **Množství** — výchozí hodnota 1, šipky ±1, nebo přepsat číslem rovnou; Enter potvrdí
4. **Pytlík ano/ne** — výchozí Ano, šipky, Enter
5. **Materiál pytlíku** — šipky, Enter (PAPÍR / BÍLÝ MATNÝ / ČERNÝ MATNÝ / TRANSPARENTNÍ)
6. **Objem pytlíku** — šipky, Enter (100 / 250 / 500 / 750 / 1000 ml)
7. Položky (čaj + pytlík) se přidají do košíku → focus se vrátí na krok 1

### Search mód
- Kdykoli prodavačka začne psát písmeno, okamžitě se zobrazí live fulltext search přes celý sortiment
- Výsledky procházet šipkami, Enter vybere čaj a pokračuje krokem 3 (množství)
- Search mód je dostupný v jakémkoli kroku hlavního flow

### Košík
- Vždy viditelný (pravá část obrazovky)
- Tab přepne focus do košíku
- Šipky vyberou položku v košíku
- Delete smaže vybranou položku
- Tab zpět přepne focus na výběr čaje

### Dokončení prodeje
- Enter na prázdném vstupu **při neprázdném košíku** → sumarizační dialog
- Sumarizační dialog: přehled košíku + celková cena
- Druhý Enter (s podtextem "Zaplaceno") → transakce se zapíše do DB, sklad se odečte, košík se vyprázdní
- Systém je okamžitě připraven na nový prodej
- Způsob platby se neeviduje (vždy `cash` jako default, žádná platební brána)

### Zobrazení cen
- V POS se zobrazuje **pouze MOC** (maloobchodní cena)
- VOC (velkoobchodní/interní cena) je pouze v admin sekci

---

## Admin sekce — pořadí implementace

1. **Správa uživatelů** — první, aby bylo možné vytvořit prodavačky
2. **Editace DB čajů** — CRUD čajů, ceny, množství ve skladu
3. **Statistiky** — až nakonec

---

---

# Přehled kasy (cash register overview) — 2026-06-16

## 1. Uzávěrka dne

**Rozhodnutí:** Uzávěrka je explicitní akce prováděná Adminem (ne automatická o půlnoci).

**Jak probíhá:** Systém navrhne vypočítaný zůstatek (poslední uzávěrka + dnešní tržby + dnešní pohyby). Admin ho může před uložením přepsat — např. po fyzickém přepočítání kasičky.

**Jeden záznam na den, přepsatelný:** Pokud admin potřebuje opravu (pozdní prodej, chyba), může uzávěrku téhož dne přepsat. Předchozí verze se nepamátuje.

**Proč ne automatika:** Bez explicitní akce nelze zjistit „co bylo v kasičce ráno" — někdo to musí zadat.

---

## 2. Pohyby kasy

**Co je pohyb:** Libovolný intradenní příjem nebo výdej hotovosti — kladná nebo záporná částka + povinná textová poznámka. Bez kategorií.

**Neměnné:** Pohyby nelze smazat ani editovat. Chybu admin opraví protipohybem. Čistý audit trail.

**Pouze dnešní den:** Admin zadává pohyby vždy pro aktuální den. Backdating není možný.

**Proč bez kategorií:** Pro malou provozovnu je volná poznámka dostatečná a flexibilnější než číselník.

---

## 3. Stav kasy — výpočet

```
Stav kasy = poslední Uzávěrka před dneškem (confirmed_balance)
          + SUM(sales.total_amount) WHERE DATE(created_at) = dnes
          + SUM(cash_movements.amount) WHERE date = dnes
```

Kasa je **globální** (jedna pro celou provozovnu) — tržby se počítají ze všech prodavaček dohromady.

**První den (bez uzávěrky):** Stav kasy zobrazí „—" jako výchozí zůstatek + tržby dnes + pohyby dnes. Admin zadá reálný stav při první uzávěrce.

---

## 4. Zobrazení pro prodavačku (POS záložka „Pokladna")

Nová záložka v `MobileTopBar` vedle „Prodej" a „Přehled".

Prodavačka vidí:
- Uzávěrka (poslední před dneškem): X Kč
- Tržby dnes: Y Kč
- Pohyby dnes: Z Kč (součet)
- **Aktuální stav: X + Y + Z Kč**
- Tabulka dnešních pohybů (čas, částka, poznámka) — read-only

Prodavačka nic neupravuje.

---

## 5. Záložka „Kasa" v admin sekci

Přidá se do `AdminLayout` nav jako nová položka.

Stránka má tři sekce:

1. **Dnešní stav** — hlavička: uzávěrka včera, tržby dnes, pohyby dnes, aktuální stav
2. **Pohyby** — tabulka pohybů za dnešek (čas, částka, poznámka) + tlačítko „Přidat pohyb" (dialog: částka + poznámka)
3. **Uzavření dne** — předvyplněný vypočítaný zůstatek, admin může upravit, tlačítko „Uzavřít den"

Dole: tabulka historických uzávěrek (datum, potvrzený zůstatek, poznámka) a pohybů s filtrem data.

---

## 6. Datový model (nové tabulky)

### `cash_closings`
| sloupec | typ | poznámka |
|---|---|---|
| id | INT PK AI | |
| date | DATE UNIQUE | jeden záznam na den, přepsatelný |
| calculated_balance | DECIMAL(10,2) | co systém spočítal |
| confirmed_balance | DECIMAL(10,2) | co admin potvrdil/upravil |
| note | TEXT NULL | volitelná poznámka |
| created_by | INT FK users | kdo uzavřel |
| created_at | DATETIME | první uzávěrka |
| updated_at | DATETIME | čas posledního přepisu |

### `cash_movements`
| sloupec | typ | poznámka |
|---|---|---|
| id | INT PK AI | |
| date | DATE | vždy dnešní den při vytvoření |
| amount | DECIMAL(10,2) | kladné nebo záporné |
| note | TEXT NOT NULL | povinná poznámka |
| created_by | INT FK users | kdo zadal |
| created_at | DATETIME | |

---

## 7. API endpointy (nový soubor `backend/api/kasa.php`)

| metoda | cesta | auth | popis |
|---|---|---|---|
| GET | /api/kasa/status | prodavacka + admin | dnešní stav kasy (výpočet) |
| POST | /api/kasa/movements | admin | přidat pohyb |
| GET | /api/kasa/movements | admin | seznam pohybů (filtr ?date=) |
| POST | /api/kasa/close | admin | uložit/přepsat uzávěrku |
| GET | /api/kasa/closings | admin | seznam uzávěrek (filtr ?from=&to=) |

### Statistiky (detailně)
- Časové tržby: denní, měsíční, roční
- Tržby per prodavačka (za zvolené období) — základ pro výplaty
- Nejprodávanější položky za zvolené období
- DB je indexována pro efektivní dotazy: `idx_sales_created_at`, `idx_sales_user_id`, `idx_sale_items_tea_id`

---

## Způsob platby

- `payment_method` zůstává v DB s default hodnotou `'cash'`
- V aplikaci se neeviduje ani nezobrazuje
- Možnost přidat platby later zůstává otevřená

---

## Docker (lokální vývoj)

- Docker Desktop = globální aplikace na počítači
- `docker-compose.yml` = per-projekt konfigurace kontejnerů
- Pro Cajovnu: PHP/Apache kontejner + MariaDB kontejner
- Stejný stack jako na Wedosu → co funguje lokálně, pojede i na hostingu
- Data v DB přežijí restart díky Docker volume
- Fáze 0 plánu: nainstalovat Docker, připravit `docker-compose.yml`, ověřit funkčnost
