<?php
require_once __DIR__ . '/../lib/db_transfer.php';

$failed = 0;
function check(string $name, bool $cond): void {
    global $failed;
    echo ($cond ? "PASS" : "FAIL") . " — $name\n";
    if (!$cond) $failed++;
}

// encode/decode
check('encode null → \\N', dbtEncode(null) === '\\N');
check('encode "" → ""', dbtEncode('') === '');
check('decode \\N → null', dbtDecode('\\N') === null);
check('decode "" → ""', dbtDecode('') === '');

// round-trip s NULL, prázdným stringem a speciálními znaky
$cols = ['id', 'name', 'note'];
$rows = [
    ['id' => '1', 'name' => 'Bílý čaj', 'note' => null],
    ['id' => '2', 'name' => '', 'note' => 'a;b "c"' . "\n" . 'd'],
];
$csv = dbtRowsToCsv($cols, $rows);
[$h, $r] = dbtParseCsv($csv);

check('header sedí', $h === ['id', 'name', 'note']);
check('řádek 1: note je \\N v CSV → decode null', dbtDecode($r[0][2]) === null);
check('řádek 2: prázdné name zůstává ""', dbtDecode($r[1][1]) === '');
check('řádek 2: escaping ; " newline', dbtDecode($r[1][2]) === 'a;b "c"' . "\n" . 'd');
check('počet řádků 2', count($r) === 2);

echo $failed === 0 ? "\nVŠE OK\n" : "\n$failed SELHALO\n";
exit($failed === 0 ? 0 : 1);
