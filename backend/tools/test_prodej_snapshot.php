<?php
// DB-backed test. Spouštět: docker compose exec -T php php tools/test_prodej_snapshot.php
// Vytváří a maže vlastní testovací řádky (KOD s prefixem TEST-PRODEJ-SNAPSHOT),
// nesahá na reálná synced data.
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/prodej_snapshot.php';
require_once __DIR__ . '/../lib/produkt_typy.php';

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

// --- fetchCenaRow validation ---
$invalidTableThrown = false;
try {
    fetchCenaRow($pdo, '99_neexistujici', 'TEST-KOD');
} catch (InvalidArgumentException $e) {
    $invalidTableThrown = true;
}
ok('fetchCenaRow hodí InvalidArgumentException pro neznámou tabulku', $invalidTableThrown);

$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");

// --- recept, který používá createProdej: fetchCenaRow + pickBaleniCeny × kusu → INSERT ---
$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");
$pdo->exec("INSERT INTO `01_caje` (KOD, KATEGORIE, ZEME, AKTIV, NAZEV, MN1, CENA1, NAKUP1, V_SHEETU)
            VALUES ('TEST-PRODEJ-SNAPSHOT-01', 'TEST', 'TEST', 'x', 'Test čaj', 30, 130, 80, 1)");
$pdo->exec("DELETE FROM `02_nadobi` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-02'");
$pdo->exec("INSERT INTO `02_nadobi` (KOD, KATEGORIE, AKTIV, NAZEV, MN1, CENA1, V_SHEETU)
            VALUES ('TEST-PRODEJ-SNAPSHOT-02', 'TEST', 'x', 'Test hrnek', 1, 250, 1)");

$pdo->exec('INSERT INTO `00_prodej` (user_id, total_kc) VALUES (1, 1000)');
$prodejId = (int) $pdo->lastInsertId();

$polozky = [
    ['caje_kod' => 'TEST-PRODEJ-SNAPSHOT-01', 'produkt_typ' => 'caje',   'baleni' => 1, 'kusu' => 2, 'jedn_cena' => 130, 'celk_cena' => 260],
    ['caje_kod' => 'TEST-PRODEJ-SNAPSHOT-02', 'produkt_typ' => 'nadobi', 'baleni' => 1, 'kusu' => 1, 'jedn_cena' => 250, 'celk_cena' => 250],
];
$ins = $pdo->prepare('INSERT INTO `00_prodej_polozky`
    (prodej_id, caje_kod, PRODUKT_TYP, baleni, kusu, jedn_cena, celk_cena, celk_cena_cenik, celk_cena_nakup)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
foreach ($polozky as $p) {
    $table = PRODUKT_TABULKY[$p['produkt_typ']];
    $row   = fetchCenaRow($pdo, $table, $p['caje_kod']);
    $ceny  = pickBaleniCeny($row, $p['baleni']);
    $kusu  = $p['kusu'];
    $ins->execute([
        $prodejId, $p['caje_kod'], $p['produkt_typ'], $p['baleni'], $kusu,
        $p['jedn_cena'], $p['celk_cena'],
        $ceny['cenik'] !== null ? $ceny['cenik'] * $kusu : null,
        $ceny['nakup'] !== null ? $ceny['nakup'] * $kusu : null,
    ]);
}

$stored = $pdo->query("SELECT caje_kod, celk_cena_cenik, celk_cena_nakup FROM `00_prodej_polozky` WHERE prodej_id = $prodejId ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
ok('recept: čaj balení 1 × 2ks → celk_cena_cenik=260 (130×2)',    (int) $stored[0]['celk_cena_cenik'] === 260);
ok('recept: čaj balení 1 × 2ks → celk_cena_nakup=160 (80×2)',     (int) $stored[0]['celk_cena_nakup'] === 160);
ok('recept: nádobí × 1ks → celk_cena_cenik=250 (250×1)',          (int) $stored[1]['celk_cena_cenik'] === 250);
ok('recept: nádobí → celk_cena_nakup=NULL (nemá NAKUP sloupce)',  $stored[1]['celk_cena_nakup'] === null);

$rowZisk = $pdo->query('SELECT ' . PRODEJ_ZISK_SUBQUERY . " AS zisk FROM `00_prodej` p WHERE p.id = $prodejId")->fetch(PDO::FETCH_ASSOC);
ok('zisk z tohoto prodeje = 100 (jen čajová položka: 260-160, nádobí bez nákupní ceny se nepočítá)',
   (int) $rowZisk['zisk'] === 100);

$pdo->exec("DELETE FROM `00_prodej_polozky` WHERE prodej_id = $prodejId");
$rowZiskPrazdny = $pdo->query('SELECT ' . PRODEJ_ZISK_SUBQUERY . " AS zisk FROM `00_prodej` p WHERE p.id = $prodejId")->fetch(PDO::FETCH_ASSOC);
ok('prodej bez položek se známou nákupní cenou → zisk=0', (int) $rowZiskPrazdny['zisk'] === 0);

$pdo->exec("DELETE FROM `00_prodej` WHERE id = $prodejId");
$pdo->exec("DELETE FROM `01_caje` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-01'");
$pdo->exec("DELETE FROM `02_nadobi` WHERE KOD = 'TEST-PRODEJ-SNAPSHOT-02'");

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
