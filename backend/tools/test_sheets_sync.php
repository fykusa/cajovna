<?php
require_once __DIR__ . '/../lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

// Sloupce A-Z (0-based, 26 sloupců). CAJE bere 0,1,2,3,4,5,6,7,10,11,14,15,18,19
// + nákupní ceny 22,23,24,25 (W-Z). NADOBI/ETNOSHOP berou jen prvních 14.
function makeCsvLine(array $vals, int $totalCols = 26): string {
    $padded = array_pad($vals, $totalCols, '');
    return implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $padded));
}

$header1 = makeCsvLine(['','','','','','','Standart','','','','Větší','','','','Největší','','','','V čajovně','','','','Nákup std','Nákup větší','Nákup největší','Nákup čajovna']);
$header2 = makeCsvLine(['KATEGORIE','ZEME','AKTIV','KOD','NAZEV','POZNAMKA','MN1','CENA1','','','MN2','CENA2','','','MN3','CENA3','','','MN4','CENA4','','','NAKUP1','NAKUP2','NAKUP3','NAKUP4']);

// Řádek 3: plný řádek, vč. nákupních cen W-Z
$data1 = makeCsvLine(['BÍLÝ','ČÍNA','x','2606-C-BILY-TAWN-01','Show Mee','','30','130','','','200','700','','','500','1680','','','7','98','','','90','480','1150','65']);
// Řádek 4: prázdný → přeskočit
$data2 = makeCsvLine([]);
// Řádek 5: aktivní=prázdné (neaktivní), bez nákupních cen
$data3 = makeCsvLine(['ZELENÉ','JAPONSKO','','2606-C-ZELE-JAPO-01','Gyokuro','Poznámka test','40','200','','','200','800','','','','','','','20','150']);
// Řádek 6: bez KATEGORIE → přeskočit
$data4 = makeCsvLine(['','','x','2606-C-XXXX-XXXX-01','Bez kategorie','','30','130']);
// Řádek 7: bez KOD → přeskočit
$data5 = makeCsvLine(['BÍLÝ','ČÍNA','x','','Bez kódu','','30','130']);
// Řádek 8: chyba vzorce (#VALUE!/#DIV/0!) v číselných sloupcích → NULL, řádek se NEzahazuje
$data6 = makeCsvLine(['ČERNÝ','INDIE','x','2608-C-CERN-INDI-01','Assam TGFOP','','30','130','','','200','700','','','500','#DIV/0!','','','7','98','','','50','#VALUE!','#DIV/0!','120']);

$csv = implode("\n", [$header1, $header2, $data1, $data2, $data3, $data4, $data5, $data6]);

// --- columnsForTable ---
[$colIndices, $colNames] = columnsForTable('01_caje');
ok('columnsForTable(01_caje) vrací 18 sloupců (14 základních + 4 nákupní)', count($colNames) === 18);
ok('columnsForTable(01_caje) obsahuje NAKUP1-4 na konci',
   array_slice($colNames, -4) === ['NAKUP1', 'NAKUP2', 'NAKUP3', 'NAKUP4']);
ok('columnsForTable(01_caje) indexy W-Z = 22,23,24,25',
   array_slice($colIndices, -4) === [22, 23, 24, 25]);

[$colIndicesNadobi, $colNamesNadobi] = columnsForTable('02_nadobi');
ok('columnsForTable(02_nadobi) vrací jen 14 základních sloupců (beze změny)', count($colNamesNadobi) === 14);
ok('columnsForTable(02_nadobi) neobsahuje NAKUP sloupce', !in_array('NAKUP1', $colNamesNadobi, true));

// --- parseCajeRows s nákupními cenami ---
[$rows] = parseCajeRows($csv, $colIndices, $colNames);

ok('parsuje 3 řádky (bez NAZEV/KATEGORIE/KOD přeskočeny, chyba vzorce řádek nezahazuje)', count($rows) === 3);

$r1 = $rows[0];
ok('KATEGORIE = BÍLÝ',                 $r1['KATEGORIE'] === 'BÍLÝ');
ok('ZEME = ČÍNA',                      $r1['ZEME'] === 'ČÍNA');
ok('AKTIV = x',                        $r1['AKTIV'] === 'x');
ok('KOD = 2606-C-BILY-TAWN-01 (sl. D)', $r1['KOD'] === '2606-C-BILY-TAWN-01');
ok('NAZEV = Show Mee (sloupec E)',     $r1['NAZEV'] === 'Show Mee');
ok('POZNAMKA = null',                  $r1['POZNAMKA'] === null);
ok('MN1 = 30 (sloupec G)',             $r1['MN1'] === '30');
ok('CENA1 = 130 (sloupec H)',          $r1['CENA1'] === '130');
ok('MN2 = 200 (sloupec K)',            $r1['MN2'] === '200');
ok('CENA2 = 700 (sloupec L)',          $r1['CENA2'] === '700');
ok('MN3 = 500 (sloupec O)',            $r1['MN3'] === '500');
ok('CENA3 = 1680 (sloupec P)',         $r1['CENA3'] === '1680');
ok('MN4 = 7 (sloupec S)',              $r1['MN4'] === '7');
ok('CENA4 = 98 (sloupec T)',           $r1['CENA4'] === '98');
ok('NAKUP1 = 90 (sloupec W)',          $r1['NAKUP1'] === '90');
ok('NAKUP2 = 480 (sloupec X)',         $r1['NAKUP2'] === '480');
ok('NAKUP3 = 1150 (sloupec Y)',        $r1['NAKUP3'] === '1150');
ok('NAKUP4 = 65 (sloupec Z)',          $r1['NAKUP4'] === '65');

$r2 = $rows[1];
ok('řádek 2 KOD = 2606-C-ZELE-JAPO-01',        $r2['KOD'] === '2606-C-ZELE-JAPO-01');
ok('řádek 2 NAZEV = Gyokuro',                  $r2['NAZEV'] === 'Gyokuro');
ok('řádek 2 AKTIV = null (neaktivní)',         $r2['AKTIV'] === null);
ok('řádek 2 POZNAMKA = Poznámka test',         $r2['POZNAMKA'] === 'Poznámka test');
ok('řádek 2 MN3 = null (prázdné)',             $r2['MN3'] === null);
ok('řádek 2 NAKUP1 = null (chybí ve zdroji)',  $r2['NAKUP1'] === null);

$r3 = $rows[2];
ok('řádek 3 KOD = 2608-C-CERN-INDI-01',         $r3['KOD'] === '2608-C-CERN-INDI-01');
ok('řádek 3 MN3 = 500 (validní, nedotčeno)',    $r3['MN3'] === '500');
ok('řádek 3 CENA3 = null (#DIV/0! → NULL)',     $r3['CENA3'] === null);
ok('řádek 3 NAKUP1 = 50 (validní, nedotčeno)',  $r3['NAKUP1'] === '50');
ok('řádek 3 NAKUP2 = null (#VALUE! → NULL)',    $r3['NAKUP2'] === null);
ok('řádek 3 NAKUP3 = null (#DIV/0! → NULL)',    $r3['NAKUP3'] === null);
ok('řádek 3 NAKUP4 = 120 (validní, nedotčeno)', $r3['NAKUP4'] === '120');

// --- assertUniqueKod ---
try {
    assertUniqueKod($rows);
    ok('unikátní kódy projdou bez výjimky', true);
} catch (RuntimeException $e) {
    ok('unikátní kódy projdou bez výjimky', false);
}

$dup = array_merge($rows, [$rows[0]]);
try {
    assertUniqueKod($dup);
    ok('duplicitní KOD hodí výjimku', false);
} catch (RuntimeException $e) {
    ok('duplicitní KOD hodí výjimku', true);
    ok('hláška obsahuje duplicitní kód', strpos($e->getMessage(), '2606-C-BILY-TAWN-01') !== false);
}

$caseDup = $rows;
$caseDup[1]['KOD'] = strtolower($rows[0]['KOD']);
try {
    assertUniqueKod($caseDup);
    ok('KOD lišící se jen velikostí písmen hodí výjimku (DB kolace je case-insensitive)', false);
} catch (RuntimeException $e) {
    ok('KOD lišící se jen velikostí písmen hodí výjimku (DB kolace je case-insensitive)', true);
}

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
