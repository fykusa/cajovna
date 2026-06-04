# Ruční vytvoření uživatele v databázi (záložní postup)

Návod, jak ručně vytvořit funkčního uživatele přímo v databázi (např. v phpMyAdmin),
kdyby z nějakého důvodu nefungoval login přes aplikaci.

## Jak se heslo ukládá

Aplikace neukládá hesla jako čistý text, ale jako **bcrypt hash**
(PHP `password_hash(..., PASSWORD_BCRYPT)`). Login pak ověřuje přes `password_verify`.
Do sloupce `password_hash` proto musí jít přesně takový bcrypt hash — ne čisté heslo.

Hash poznáš podle prefixu `$2y$10$…` a délky 60 znaků. Bcrypt schválně dává pokaždé
jiný řetězec (míchá do sebe náhodnou „sůl") — to je v pořádku, ověření přesto funguje.

## 1. Vygenerování hashe

Nahraď `tvojeheslo` skutečným heslem (uvozovky kolem hesla nech jednoduché):

```powershell
docker compose exec php php -r 'echo password_hash("tvojeheslo", PASSWORD_BCRYPT), \"\n\";'
```

Příkaz vypíše hash, např.:

```
$2y$10$7cl4HnVFOVZfpFJlsJ/55./y88dHOjkfv5aVhlX7lcBeJGjsPuNc6
```

Zkopíruj celý řetězec `$2y$10$…` (60 znaků).

## 2. Vložení uživatele v phpMyAdmin

Otevři phpMyAdmin, vyber databázi **`f109530`**, tabulku **`users`** a spusť SQL
(do `password_hash` vlož vygenerovaný hash):

```sql
INSERT INTO `users` (`username`, `password_hash`, `role`, `active`, `password_changed_at`)
VALUES ('zaloha', 'sem_vloz_hash', 'admin', 1, NOW());
```

Poznámky k polím:

- **`password_hash`** = bcrypt hash z kroku 1 (ne čisté heslo!).
- **`role`** = `admin` nebo `prodavacka`.
- **`active`** musí být `1` — login odmítne neaktivní účet.
- `id` a `created_at` se doplní samy.

## 3. Přihlášení

Přihlas se jménem `zaloha` a heslem, ze kterého jsi hash vyrobil.

## Ověření, že hash sedí k heslu

Vygeneruj a rovnou ověř v jednom běhu (žádné kopírování hashe přes uvozovky):

```powershell
docker compose exec php php -r '$hash = password_hash("heslo123", PASSWORD_BCRYPT); echo $hash, \"\n\"; var_dump(password_verify("heslo123", $hash));'
```

Vypíše hash a `bool(true)`, pokud heslo k hashi sedí.

## Důležité varování — znak `$` v hashi

Bcrypt hash obsahuje znaky `$`.

- V **SQL INSERTu** (phpMyAdmin) to **nevadí** — řetězec v `'...'` se bere doslova.
- Problém vzniká jen při vkládání hashe do **PHP nebo shell řetězce ve dvojitých
  uvozovkách** — tam se `$2y`, `$10` apod. snaží interpretovat jako proměnné a hash se
  „rozbije". Pokud hash někde kopíruješ do skriptu, dávej ho vždy do **jednoduchých
  uvozovek** `'...'`.
```
