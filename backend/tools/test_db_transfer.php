<?php
require_once __DIR__ . '/../lib/db_transfer.php';

$failed = 0;
function check(string $name, bool $cond): void {
    global $failed;
    echo ($cond ? "PASS" : "FAIL") . " — $name\n";
    if (!$cond) $failed++;
}

// encode/decode — NULL ↔ prázdná buňka
check('encode null → ""', dbtEncode(null) === '');
check('decode "" → null', dbtDecode('') === null);
check('encode text projde beze změny', dbtEncode('Bai Mu Dan 2.0') === 'Bai Mu Dan 2.0');
check('decode text projde beze změny', dbtDecode('Bai Mu Dan 2.0') === 'Bai Mu Dan 2.0');

// číselné sloupce — desetinná tečka ↔ čárka
check('encode číslo 30.0 → "30,0"', dbtEncode('30.0', true) === '30,0');
check('encode číslo 2070.000 → "2070,000"', dbtEncode('2070.000', true) === '2070,000');
check('decode "30,0" → "30.0"', dbtDecode('30,0', true) === '30.0');
check('decode "2 070,000" (tisíce) → "2070.000"', dbtDecode("2\xC2\xA0070,000", true) === '2070.000');
check('decode prázdné číslo → null', dbtDecode('', true) === null);

// round-trip přes CSV: NULL, číselný sloupec, speciální znaky v textu
$cols = ['id', 'name', 'weight_g', 'note'];
$numeric = ['weight_g' => true];
$rows = [
    ['id' => '1', 'name' => 'Bílý čaj', 'weight_g' => '30.0', 'note' => null],
    ['id' => '2', 'name' => 'a;b "c"' . "\n" . 'd', 'weight_g' => '0.000', 'note' => 'x'],
];
$csv = dbtRowsToCsv($cols, $rows, $numeric);
[$h, $r] = dbtParseCsv($csv);

check('header sedí', $h === ['id', 'name', 'weight_g', 'note']);
check('řádek 1: weight 30.0 je v CSV "30,0"', $r[0][2] === '30,0');
check('řádek 1: weight decode zpět → "30.0"', dbtDecode($r[0][2], true) === '30.0');
check('řádek 1: note prázdné → decode null', dbtDecode($r[0][3]) === null);
check('řádek 2: escaping ; " newline', dbtDecode($r[1][1]) === 'a;b "c"' . "\n" . 'd');
check('řádek 2: weight 0.000 → "0,000" → decode "0.000"', dbtDecode($r[1][2], true) === '0.000');
check('počet řádků 2', count($r) === 2);

// detekce kódování — Windows-1250 (české Excel CSV) → UTF-8
$utf8 = 'Bílý čaj – příchuť';
$win1250 = iconv('UTF-8', 'Windows-1250', $utf8);
check('Windows-1250 vstup → převede na UTF-8', dbtToUtf8($win1250) === $utf8);
check('UTF-8 vstup zůstane beze změny', dbtToUtf8($utf8) === $utf8);
check('UTF-8 s BOM zůstane beze změny', dbtToUtf8("\xEF\xBB\xBF" . $utf8) === "\xEF\xBB\xBF" . $utf8);
check('čisté ASCII zůstane beze změny', dbtToUtf8('id;name;30,0') === 'id;name;30,0');

// normalizace datumů — Excel CZ formáty → MySQL
check('MySQL formát projde beze změny',
    dbtNormalizeDateTime('2026-05-28 17:44:39') === '2026-05-28 17:44:39');
check('28.05.2026 17:44 → 2026-05-28 17:44:00 (doplní sekundy)',
    dbtNormalizeDateTime('28.05.2026 17:44') === '2026-05-28 17:44:00');
check('28.5.2026 17:44 (bez leading zero)',
    dbtNormalizeDateTime('28.5.2026 17:44') === '2026-05-28 17:44:00');
check('28. 5. 2026 17:44 (mezery kolem teček)',
    dbtNormalizeDateTime('28. 5. 2026 17:44') === '2026-05-28 17:44:00');
check('28.05.2026 17:44:39 (se sekundami)',
    dbtNormalizeDateTime('28.05.2026 17:44:39') === '2026-05-28 17:44:39');
check('date-only 28.05.2026 → 2026-05-28',
    dbtNormalizeDateTime('28.05.2026', true) === '2026-05-28');
check('null → null', dbtNormalizeDateTime(null) === null);
check('prázdné → null', dbtNormalizeDateTime('') === null);
check('nepoznané vrací beze změny (chytí DB)',
    dbtNormalizeDateTime('nesmysl') === 'nesmysl');

echo $failed === 0 ? "\nVŠE OK\n" : "\n$failed SELHALO\n";
exit($failed === 0 ? 0 : 1);
