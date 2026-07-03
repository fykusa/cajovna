<?php
// DB-backed test upsert syncu. Spouštět: docker compose exec -T php php tools/test_sheets_upsert.php
// POZOR: maže obsah 00_prodej_polozky, 00_prodej a 01_caje v lokální DB (dev data, lze re-seedovat).
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/sheets_sync.php';

$PASS = 0; $FAIL = 0;
function ok(string $msg, bool $cond): void {
    global $PASS, $FAIL;
    if ($cond) { echo "PASS: $msg\n"; $PASS++; }
    else        { echo "FAIL: $msg\n"; $FAIL++; }
}

function mkRow(string $kod, string $nazev, string $cena1): array {
    return ['KATEGORIE' => 'BÍLÝ', 'ZEME' => 'ČÍNA', 'AKTIV' => 'x', 'KOD' => $kod,
            'NAZEV' => $nazev, 'POZNAMKA' => null, 'MN1' => '30', 'CENA1' => $cena1,
            'MN2' => null, 'CENA2' => null, 'MN3' => null, 'CENA3' => null,
            'MN4' => null, 'CENA4' => null];
}

$pdo = getPDO();
$pdo->exec('TRUNCATE TABLE `00_prodej_polozky`');
$pdo->exec('DELETE FROM `00_prodej`');
$pdo->exec('DELETE FROM `01_caje`');

// --- 1. sync: dva nové řádky ---
$res = sheetsUpsertCaje($pdo, [
    mkRow('2606-C-BILY-TAWN-01', 'Show Mee', '130'),
    mkRow('2606-C-BILY-TAWN-02', 'Bai Mu Dan', '220'),
]);
ok('1. sync: synced = 2',   $res['synced'] === 2);
ok('1. sync: vyrazeno = 0', $res['vyrazeno'] === 0);

$id1 = (int) $pdo->query("SELECT id FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-01'")->fetchColumn();
ok('1. sync: řádek 1 existuje', $id1 > 0);
$vs = (int) $pdo->query("SELECT V_SHEETU FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-02'")->fetchColumn();
ok('1. sync: V_SHEETU = 1', $vs === 1);

// --- 2. sync: řádek 1 změněná cena, řádek 2 zmizel ze sheetu, řádek 3 nový ---
$res = sheetsUpsertCaje($pdo, [
    mkRow('2606-C-BILY-TAWN-01', 'Show Mee', '150'),
    mkRow('2607-C-ZELE-JAPO-01', 'Gyokuro', '200'),
]);
ok('2. sync: synced = 2',   $res['synced'] === 2);
ok('2. sync: vyrazeno = 1', $res['vyrazeno'] === 1);

$row1 = $pdo->query("SELECT id, CENA1, V_SHEETU FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-01'")->fetch(PDO::FETCH_ASSOC);
ok('2. sync: řádek 1 — id stabilní',      (int) $row1['id'] === $id1);
ok('2. sync: řádek 1 — cena updatnutá',   (int) $row1['CENA1'] === 150);
ok('2. sync: řádek 1 — V_SHEETU = 1',     (int) $row1['V_SHEETU'] === 1);

$row2 = $pdo->query("SELECT NAZEV, V_SHEETU FROM `01_caje` WHERE KOD = '2606-C-BILY-TAWN-02'")->fetch(PDO::FETCH_ASSOC);
ok('2. sync: vyřazený řádek zůstal v DB',   $row2 !== false);
ok('2. sync: vyřazený řádek — V_SHEETU = 0', (int) $row2['V_SHEETU'] === 0);
ok('2. sync: vyřazený řádek — data intaktní', $row2['NAZEV'] === 'Bai Mu Dan');

$cnt = (int) $pdo->query('SELECT COUNT(*) FROM `01_caje`')->fetchColumn();
ok('2. sync: celkem 3 řádky v DB', $cnt === 3);

// --- 3. FK: prodej odkazuje na vyřazený kód → JOIN historie stále funguje ---
$pdo->exec("INSERT INTO `00_prodej` (user_id, total_kc) VALUES (1, 220)");
$pid = (int) $pdo->lastInsertId();
$pdo->exec("INSERT INTO `00_prodej_polozky` (prodej_id, caje_kod, baleni, kusu, jedn_cena, celk_cena)
            VALUES ($pid, '2606-C-BILY-TAWN-02', 1, 1, 220, 220)");
$nazev = $pdo->query(
    "SELECT c.NAZEV FROM `00_prodej_polozky` pp LEFT JOIN `01_caje` c ON c.KOD = pp.caje_kod WHERE pp.prodej_id = $pid"
)->fetchColumn();
ok('FK + JOIN: historie dohledá název vyřazené položky', $nazev === 'Bai Mu Dan');

// úklid prodeje po testu
$pdo->exec('TRUNCATE TABLE `00_prodej_polozky`');
$pdo->exec('DELETE FROM `00_prodej`');

echo "\n$PASS passed, $FAIL failed\n";
exit($FAIL > 0 ? 1 : 0);
