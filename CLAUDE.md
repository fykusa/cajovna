# Cajovna — instrukce pro Claude

## Log aktivity

Na začátku každé session přečti posledních ~30 řádků `.claude/log.md` (nejnovější nahoře) — rychlý přehled, co se v projektu naposledy dělo. Do hloubky (memory soubory, git log, kód) jen když je to k danému úkolu potřeba.

Po každé uzavřené věci (dokončený fix/feature, padlé rozhodnutí, objevený bug) hned přidej jeden řádek nahoru do `.claude/log.md` — nečekej na konec session. Formát: `- [YYYY-MM-DD HH:MM] jedna věta.` Pro detail *proč*/*jak* odkaž na `memory/` (mimo repo) nebo `tasks.md`.

`tasks.md` zůstává jen pro otevřené/rozdělané úkoly (viz globální instrukce). `log.md` je širší timeline všeho, i věcí, co nikdy nebyly formální task.
