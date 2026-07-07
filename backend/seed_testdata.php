<?php
// Generátor testovacích dat — prodeje 08/2025–06/2026
// Po použití SMAZAT ze serveru!
require_once __DIR__ . '/db.php';

header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><title>Seed testovacích dat</title>
<style>
  body { font-family: monospace; background: #141a08; color: #e5e2ba; padding: 32px; }
  h1   { color: #9cba21; }
  pre  { background: #1e2b0e; padding: 16px; border-radius: 6px; line-height: 1.7; }
  .ok  { color: #9cba21; }
  .err { color: #f4a64a; }
  form { margin-bottom: 16px; }
  button { background: #9cba21; color: #141a08; border: none; padding: 10px 24px;
           font-size: 1rem; font-weight: 700; border-radius: 4px; cursor: pointer; }
</style>
</head>
<body>
<h1>Seed testovacích dat</h1>
<?php if ($_SERVER['REQUEST_METHOD'] !== 'POST'): ?>
<form method="post">
  <p>Vygeneruje 20–50 prodejů na každý měsíc <strong>08/2025 – 06/2026</strong>
     (user_id 2 nebo 3, prodeje 200–3 000 Kč).</p>
  <button type="submit">Spustit generátor</button>
</form>
<?php else: ?>
<pre>
<?php
flush();

function p($msg, $cls = 'ok') {
    echo '<span class="' . $cls . '">' . htmlspecialchars($msg) . "</span>\n";
    flush();
}

try {
    $pdo = getPDO();
} catch (Throwable $e) {
    p('DB chyba: ' . $e->getMessage(), 'err');
    echo '</pre></body></html>';
    exit;
}

// Načtení aktivních čajů
$teas = $pdo->query(
    "SELECT KOD, NAZEV, CENA1, CENA2, CENA3, CENA4 FROM `01_caje` WHERE AKTIV = 'x' AND V_SHEETU = 1"
)->fetchAll(PDO::FETCH_ASSOC);

p('Aktivních čajů: ' . count($teas));

// Dostupné balení pro čaj (jen nenulové ceny, max 3000 Kč/ks)
function teaBaleni(array $tea): array {
    $opts = [];
    foreach ([1, 2, 3, 4] as $n) {
        $cena = $tea["CENA$n"];
        if ($cena !== null && (int)$cena <= 3000) {
            $opts[] = ['cislo' => $n, 'cena' => (int)$cena];
        }
    }
    return $opts;
}

// Jen čaje s aspoň jedním dostupným balením
$validTeas = array_values(array_filter($teas, fn($t) => !empty(teaBaleni($t))));
p('Čajů s platnými cenami: ' . count($validTeas));
echo "\n";

$userIds  = [2, 3];
$inserted = 0;
$skipped  = 0;

$stmtProdej  = $pdo->prepare(
    'INSERT INTO `00_prodej` (user_id, created_at, total_kc) VALUES (?, ?, ?)'
);
$stmtPolozka = $pdo->prepare(
    'INSERT INTO `00_prodej_polozky` (prodej_id, caje_kod, baleni, kusu, jedn_cena, celk_cena)
     VALUES (?, ?, ?, ?, ?, ?)'
);

// Měsíce 08/2025 – 06/2026
$cur   = new DateTime('2025-08-01');
$limit = new DateTime('2026-07-01');

while ($cur < $limit) {
    $y    = (int)$cur->format('Y');
    $m    = (int)$cur->format('m');
    $days = (int)date('t', mktime(0, 0, 0, $m, 1, $y));
    $cnt  = rand(20, 50);

    $monthInserted = 0;

    for ($i = 0; $i < $cnt; $i++) {
        // Sestav košík
        $polozky  = [];
        $total    = 0;
        $maxItems = rand(1, 5);
        $loop     = 0;

        while (($total < 200 || count($polozky) < $maxItems) && $loop < 40) {
            $loop++;

            // Kolik zbývá do limitu 3000
            $zbyvá = 3000 - $total;
            if ($zbyvá <= 0) break;

            $tea  = $validTeas[array_rand($validTeas)];
            $opts = array_values(array_filter(
                teaBaleni($tea),
                fn($b) => $b['cena'] <= $zbyvá
            ));
            if (empty($opts)) continue;

            $bal     = $opts[array_rand($opts)];
            $maxKusu = min(3, (int)floor($zbyvá / $bal['cena']));
            if ($maxKusu < 1) continue;
            $kusu = rand(1, $maxKusu);
            $celk = $bal['cena'] * $kusu;

            $polozky[] = [
                'caje_kod'  => $tea['KOD'],
                'baleni'    => $bal['cislo'],
                'kusu'      => $kusu,
                'jedn_cena' => $bal['cena'],
                'celk_cena' => $celk,
            ];
            $total += $celk;

            // Přidáváme položky dokud není >= 200 a nesplníme maxItems
            if ($total >= 200 && count($polozky) >= $maxItems) break;
        }

        if ($total < 200 || empty($polozky)) {
            $skipped++;
            continue;
        }

        $dt  = sprintf('%04d-%02d-%02d %02d:%02d:%02d',
            $y, $m, rand(1, $days), rand(9, 18), rand(0, 59), rand(0, 59));
        $uid = $userIds[array_rand($userIds)];

        $pdo->beginTransaction();
        try {
            $stmtProdej->execute([$uid, $dt, $total]);
            $pid = (int)$pdo->lastInsertId();
            foreach ($polozky as $pol) {
                $stmtPolozka->execute([
                    $pid,
                    $pol['caje_kod'],
                    $pol['baleni'],
                    $pol['kusu'],
                    $pol['jedn_cena'],
                    $pol['celk_cena'],
                ]);
            }
            $pdo->commit();
            $inserted++;
            $monthInserted++;
        } catch (Throwable $e) {
            $pdo->rollBack();
            p('Chyba prodeje: ' . $e->getMessage(), 'err');
        }
    }

    p(sprintf('%04d-%02d: %d prodejů', $y, $m, $monthInserted));
    $cur->modify('+1 month');
}

echo "\n";
p("Celkem vloženo: $inserted prodejů" . ($skipped ? " (přeskočeno $skipped)" : '') . '.');
p('Hotovo! Nezapomeň smazat tento soubor ze serveru.');
?>
</pre>
<?php endif; ?>
</body>
</html>
