# CONTEXT.md — Cajovna

## Glossář

### Prodej
Jedna uzavřená transakce u pokladny. Obsahuje jednu nebo více Položek. Má jednoho Prodavačku. Způsob platby se neeviduje (default cash).

### Položka
Jeden řádek v košíku. Může být: předbalený čaj (std/pkg1/pkg2), čaj na váhu (custom), nebo pytlík.

### Košík
Rozpracovaný prodej — seznam Položek před potvrzením. Po potvrzení se stane Prodejem.

### Čaj (Tea)
Produkt ze sortimentu. Má kategorii, název, až 3 předbalené varianty (std/pkg1/pkg2) a možnost prodeje na váhu. Skladuje se buď v kusech (předbalené) nebo v kg (sypaný/volná gramáž).

### Předbalené balení
Balení čaje s pevnou gramáží a cenou — std, pkg1, pkg2. Sklad se eviduje v kusech.

### Volná gramáž (custom)
Čaj odvážený přímo při prodeji. Zákazník zpravidla přináší vlastní obal. Sklad se eviduje v kg. Cena se počítá z gramáže.

### Pytlík (Bag)
Obal nabízený čajovnou (papír, bílý matný, černý matný, transparentní; různé objemy). Slouží jako ceník — sklad pytlíků se neeviduje. V košíku je samostatnou Položkou.

### Prodavačka
Uživatel s rolí `prodavacka`. Provádí prodeje přes POS.

### Admin
Uživatel s rolí `admin`. Spravuje uživatele, databázi čajů, sklad a statistiky.

### Naskladnění
Operace v admin sekci: buď přičtení množství k aktuálnímu stavu (běžný nákup), nebo nastavení přesné hodnoty (inventura).

### MOC
Maloobchodní cena — cena zobrazovaná zákazníkovi a v POS.

### VOC
Velkoobchodní/interní cena — zobrazuje se pouze v admin sekci, nikoli v POS.

### Flag
Stav čaje v sortimentu: `active` (prodejný), `discontinued` (již není), `no_insert` (nevkládat), `eshop_only` (jen e-shop — zatím neimplementováno), `trial` (na zkoušku — zobrazení v POS konfigurovatelné).

### Statistiky
Přehledy pro admina: denní/měsíční/roční tržby, tržby per prodavačka, nejprodávanější položky za zvolené období.

### Uzávěrka
Explicitní denní uzavření kasy, provádí Admin. Jeden záznam na den — přepsatelný (nová uzávěrka téhož dne přepíše předchozí, stará verze se nepamátuje). Systém navrhne vypočítaný zůstatek, admin ho může před uložením upravit.

### Pohyb kasy
Intradenní pohyb hotovosti zaznamenaný Adminem — kladná nebo záporná částka + textová poznámka. Pohyby nelze mazat ani editovat; chybu admin opraví protipohybem.

### Stav kasy
Aktuální odhadovaný zůstatek hotovosti v provozovně. Vypočítá se jako: poslední Uzávěrka před dneškem + Tržby dnes (prodeje všech prodavaček) + součet dnešních Pohybů kasy. Pokud žádná Uzávěrka dosud neproběhla, výchozí zůstatek je nedefinovaný (zobrazí se „—").

### Tržby dnes
Součet `total_amount` všech Prodejů s `created_at` v aktuálním kalendářním dni, bez ohledu na to, která Prodavačka prodávala.
