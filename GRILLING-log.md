# Cajovna – Grill session log (2026-05-27)

## Q1
**Otázka:** Kdo jsou uživatelé POS rozhraní a jak ho budou reálně používat? Jak to teď v čajovně funguje? Platí zákazníci vždy jen jeden čaj na transakci, nebo bývají košíky s více položkami?

**Odpověď:** Většinou více položek, košík je běžný.

---

## Q2
**Otázka:** Jak probíhá typický prodej v košíku? Prodává se vzorek jako samostatná položka s vlastní cenou, nebo je vzorek vždy zdarma/součástí jiné položky? (Poznámka: `item_type = 'sample'` je v plánovacím dokumentu, ale v schema.sql chybí.)

**Odpověď:** Vzorky neřešíme, zrušit sample z ENUMu. V schema.sql tam sloupec na sample nevidím.

---

## Q3
**Otázka:** Co znamená `item_type = 'custom'` v praxi? Je to libovolné množství v gramech se zadanou cenou za gram?

**Odpověď:** Cena se počítá z gramáže, a význam této varianty je, že si zákazník třeba donese svůj obal.

---

## Q4
**Otázka:** Jak se vybírá pytlík při prodeji? Je pytlík součástí téže `sale_items` řádky, nebo jako samostatná položka v košíku?

**Odpověď:** Pro přehlednost to dejme zatím zvlášť, uvidíme, jak se to osvědčí.

---

## Q5
**Otázka:** Sklad — pro `custom` položky schéma neumí sledovat spotřebu v kg, chybí `stock_kg`. Chceš sledovat sklad v kg pro volnou gramáž, nebo to teď necháme bez skladu?

**Odpověď:** Ano, přidat `stock_kg` a sledovat stav při prodeji. Sortiment jsou už hotové naplněné pytlíčky, ale i velké pytle, ze kterých se odebírá prodávané množství. V administraci pak bude probíhat naskladnění, když se nakoupí nové zboží.

---

## Q6
**Otázka:** Naskladnění v administraci — je to vždy jen "přičíst kladné číslo", nebo chce admin i možnost ručně opravit stav (nastavit přesnou hodnotu) pro inventuru?

**Odpověď:** Obojí, přičíst i nastavit přesně.

---

## Q7
**Otázka:** Výběr čaje v POS — primárně fulltext search nebo kategorie? Kolik čajů má sortiment přibližně? Mají být v POS viditelné i čaje s `flag = 'trial'`?

**Odpověď:** (1) viz soubor test_sample-caje.csv. (2) Dal bych to někam do konfigurace aplikace jako checkbox.

*(Poznámka: z CSV vyplývá ~300+ aktivních položek.)*

---

## Q8
**Otázka:** Jak prodávají čaje ze skupiny "TAO čaje pro eshop"? Jsou dostupné i v čajovně fyzicky, nebo je `flag = 'eshop_only'` přesně pro ně?

**Odpověď:** Ten sloupec opravím a bude tam v každém řádku příslušná kategorie čaje. Teď tam jsou něco jako poznámky, takže nic jako jen e-shop zatím uvažovat nemusíme. Případně taková možnost bude implementována později.

---

## Q9
**Otázka:** Jak prodavačka vybere balení při prodeji? Balení jako velká tlačítka nebo jinak? Zobrazuje se MOC nebo VOC nebo obojí?

**Odpověď:** Iniciální stav prodeje by byl výběr kategorie nejlépe na klávesy šipek nahoru/dolů, entrem by se potvrdila kategorie, vyskočil by seznam všech příslušných čajů z týhle kategorie, zase přes šipky nahoru/dolů vybrat příslušný konkrétní, enter, vybrat množství, vybrat balení. Kdykoli by ale při tomto výběru prodávající začala ťukat na klávesnici jméno, tak by se ihned zobrazoval seznam produktů odpovídajících tomu zadanému jménu. Zobrazovala by se samozřejmě jenom maloobchodní cena.

---

## Q10
**Otázka:** Jak funguje krok "vybrat množství"? Výchozí hodnota 1, Enter potvrdí?

**Odpověď:** Ano, výchozí 1 kus, Enter potvrdí. Šipkami nahoru/dolů se default mění, +1 nebo -1.

---

## Q11
**Otázka:** Co se stane po výběru balení? Pytlík jako součást flow nebo samostatná akce?

**Odpověď:** Ano košík bude neustále viditelný. Po zadání množství úplně stejným následným krokem bude zase na klávesy nahoru dolů výběr pytlíku ano ne, defaultně ano, vybere se materiál, pak objem.

---

## Q12
**Otázka:** Jak se dokončí celý prodej? Klávesová zkratka, dialog, potvrzení?

**Odpověď:** Enter na prázdném vstupu (a neprázdném košíku) je dobrý nápad, například by to zobrazilo dialog "dokončit objednávku" a tím by vyskočil nějaký sumarizační přehled. Na další Enter (s podtextem zaplaceno) by se transakce zapsala do prodeje, upravil sklad, košík vyprázdnil. Žádná vazba na platební bránu zatím není, tímto by proces prodeje skončil a systém byl připravený na nový prodej.

---

## Q13
**Otázka:** Způsob platby — cash/card dialog při dokončení?

**Odpověď:** Typ platby řešit nemusíme.

---

## Q14 (upřesnění)
**Otázka:** `payment_method` — sloupec nechat v DB s default hodnotou `'cash'` a v aplikaci ho prostě nevyužívat?

**Odpověď:** Ano, nechat default cash.

---

## Q15
**Otázka:** Mazání položek z košíku — Tab přepne focus do košíku, šipky vyberou položku, Delete odstraní?

**Odpověď:** Super, ano.

---

## Q16
**Otázka:** Admin sekce — co admin potřebuje nejčastěji? Navrhované pořadí: sklad, CRUD čajů, statistiky, uživatelé.

**Odpověď:** Ne, uživatelé přece musí být první, ať můžeme založit prodavačky. Pak editace databáze — to obnáší editaci množství ve skladu, nakonec statistiky.

---

## Q17
**Otázka:** Jaké statistiky jsou nejdůležitější?

**Odpověď:** Časové (denní, měsíční, roční) tržby, přehled prodejů přes prodavačky (z toho jsou placeny) a nejprodávanější položky za určité období. DB musí být indexována tak, aby tam šlo všechno toto efektivně hledat.

---

## Q18
**Otázka:** Prodavačky jsou placeny z prodejů — jak přesně? Procento z tržeb, pevná odměna?

**Odpověď:** To řešit nemusíme, majiteli stačí vědět, kolik prodaly.

---
