<?php
// DB-backed test. Spouštět: docker compose exec -T php php tools/test_prodej_snapshot.php
// Vytváří a maže vlastní testovací řádky (KOD s prefixem TEST-PRODEJ-SNAPSHOT),
// nesahá na reálná synced data.
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/prodej_snapshot.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// --- cenaColumnsForTable (pure) ---
ok('cenaColumnsForTable(01_caje) obsahuje NAKUP sloupce',
   cenaColumnsForTable('01_caje') === 'CENA1,CENA2,CENA3,CENA4,NAKUP1,NAKUP2,NAKUP3,NAKUP4');
ok('cenaColumnsForTable(02_nadobi) neobsahuje NAKUP sloupce',
   cenaColumnsForTable('02_nadobi') === 'CENA1,CENA2,CENA3,CENA4');
ok('cenaColumnsForTable(03_etnoshop) neobsahuje NAKUP sloupce',
   cenaColumnsForTable('03_etnoshop') === 'CENA1,CENA2,CENA3,CENA4');

// --- pickBaleniCeny (pure) ---
$rowCaje = ['CENA1' => 130, 'CENA2' => 700, 'CENA3' => 1680, 'CENA4' => 98,
            'NAKUP1' => 80, 'NAKUP2' => null, 'NAKUP3' => 950, 'NAKUP4' => 60];
$p1 = pickBaleniCeny($rowCaje, 1);
ok('pickBaleniCeny balení 1: cenik=130', $p1['cenik'] === 130);
ok('pickBaleniCeny balení 1: nakup=80', $p1['nakup'] === 80);
$p2 = pickBaleniCeny($rowCaje, 2);
ok('pickBaleniCeny balení 2: cenik=700', $p2['cenik'] === 700);
ok('pickBaleniCeny balení 2: nakup=null (v DB NULL)', $p2['nakup'] === null);

$rowNadobi = ['CENA1' => 250, 'CENA2' => null, 'CENA3' => null, 'CENA4' => null];
$p3 = pickBaleniCeny($rowNadobi, 1);
ok('pickBaleniCeny (nadobi, bez NAKUP sloupců): cenik=250', $p3['cenik'] === 250);
ok('pickBaleniCeny (nadobi, bez NAKUP sloupců): nakup=null (sloupec v řádku vůbec není)', $p3['nakup'] === null);

// --- fetchCenaRow (DB-backed) ---
$pdo = getPDO();
$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");
$pdo->exec("INSERT INTO `01_caje` (KOD, KATEGORIE, ZEME, AKTIV, NAZEV, MN1, CENA1, NAKUP1, V_SHEETU)
            VALUES ('TEST-PRODEJ-SNAPSHOT-01', 'TEST', 'TEST', 'x', 'Test čaj', 30, 130, 80, 1)");

$row = fetchCenaRow($pdo, '01_caje', 'TEST-PRODEJ-SNAPSHOT-01');
ok('fetchCenaRow najde existující KOD', $row !== null);
ok('fetchCenaRow vrací CENA1', $row !== null && (int) $row['CENA1'] === 130);
ok('fetchCenaRow vrací NAKUP1', $row !== null && (int) $row['NAKUP1'] === 80);

$missing = fetchCenaRow($pdo, '01_caje', 'NEEXISTUJICI-KOD-XYZ');
ok('fetchCenaRow vrací null pro neexistující KOD', $missing === null);

$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
