<?php
require_once __DIR__ . '/../lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// Sloupce A-S (0-based): bereme 0,1,2,3,4,5,6,9,10,13,14,17,18
function makeCsvLine(array $vals, int $totalCols = 19): string {
    $padded = array_pad($vals, $totalCols, '');
    return implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $padded));
}

$header1 = makeCsvLine(['Standart','','','','','','','','','Větší','','','','Největší','','','','V čajovně','']);
$header2 = makeCsvLine(['KATEGORIE','ZEME','AKTIV','NAZEV','POZNAMKA','MN1','CENA1','','','MN2','CENA2','','','MN3','CENA3','','','MN4','CENA4']);

// Řádek 3: plný řádek
$data1 = makeCsvLine(['BÍLÝ','ČÍNA','x','Show Mee','','30','130','','','200','700','','','500','1680','','','7','98']);
// Řádek 4: bez NAZEV → má být přeskočen
$data2 = makeCsvLine(['','','','','','','','','','','','','','','','','','','']);
// Řádek 5: aktivní=prázdné (neaktivní)
$data3 = makeCsvLine(['ZELENÉ','JAPONSKO','','Gyokuro','Poznámka test','40','200','','','200','800','','','','','','','20','150']);
// Řádek 6: bez KATEGORIE (sloupec A prázdný) → přeskočit
$data4 = makeCsvLine(['','','x','Bez kategorie','','30','130','','','','','','','','','','','','']);

$csv = implode("\n", [$header1, $header2, $data1, $data2, $data3, $data4]);

[$rows] = parseCajeRows($csv);

ok('parsuje 2 řádky (bez NAZEV a bez KATEGORIE přeskočeny)', count($rows) === 2);

$r1 = $rows[0];
ok('KATEGORIE = BÍLÝ',              $r1['KATEGORIE'] === 'BÍLÝ');
ok('ZEME = ČÍNA',                   $r1['ZEME'] === 'ČÍNA');
ok('AKTIV = x',                     $r1['AKTIV'] === 'x');
ok('NAZEV = Show Mee',              $r1['NAZEV'] === 'Show Mee');
ok('POZNAMKA = null',               $r1['POZNAMKA'] === null);
ok('MN1 = 30',                      $r1['MN1'] === '30');
ok('CENA1 = 130',                   $r1['CENA1'] === '130');
ok('MN2 = 200 (sloupec J)',         $r1['MN2'] === '200');
ok('CENA2 = 700 (sloupec K)',       $r1['CENA2'] === '700');
ok('MN3 = 500 (sloupec N)',         $r1['MN3'] === '500');
ok('CENA3 = 1680 (sloupec O)',      $r1['CENA3'] === '1680');
ok('MN4 = 7 (sloupec R)',           $r1['MN4'] === '7');
ok('CENA4 = 98 (sloupec S)',        $r1['CENA4'] === '98');

$r2 = $rows[1];
ok('řádek 2 NAZEV = Gyokuro',                   $r2['NAZEV'] === 'Gyokuro');
ok('řádek 2 AKTIV = null (neaktivní)',          $r2['AKTIV'] === null);
ok('řádek 2 POZNAMKA = Poznámka test',          $r2['POZNAMKA'] === 'Poznámka test');
ok('řádek 2 MN3 = null (prázdné)',              $r2['MN3'] === null);

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
