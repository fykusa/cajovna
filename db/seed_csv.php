<?php
/**
 * seed_csv.php – import CSV dat do MariaDB
 *
 * Spuštění: php db/seed_csv.php
 * (z adresáře D:\_FYKA\AI\Cajovna)
 *
 * Předpoklady:
 *   - schema.sql musí být aplikovány (tabulky existují)
 *   - backend/db.php + backend/config.php dostupné
 *
 * Struktura CSV (caje):
 *   col0 = flag (F=active, 'uz neni!', 'nevkladat', 'jen eshop', 'na zkousku')
 *   col1 = kategorie NEBO subkategorie NEBO flag (v praxi data jsou i zde)
 *   col2 = název čaje
 *   col3 = poznámka
 *   col5 = std_weight_g, col6 = std_price_moc, col7 = std_price_voc, col8 = std_margin_%
 *   col12= pkg1_weight_g, col13= pkg1_moc, col14= pkg1_voc, col15= pkg1_%
 *   col16= pkg2_weight_g, col17= pkg2_moc, col18= pkg2_voc, col19= pkg2_%
 *   col21= purchase_kg, col22= stock_std, col24= stock_pkg1, col25= stock_pkg2
 *   col26= tao_pct, col27= trade_pct
 *
 * Hierarchie: hlavní kategorie (BÍLÉ, ZELENÉ...) jsou v col1 bez nadřazené kategorie.
 *   Podkategorie (JAPONSKÉ, ČÍNSKÝ...) jsou TAKÉ v col1 – závisí na pořadí.
 *   Logika: seznam MAIN_CATS definuje hlavní kategorie; vše ostatní = subkategorie.
 */

require_once __DIR__ . '/../backend/db.php';

define('CSV_CAJE',    __DIR__ . '/../src/test_sample-caje.csv');
define('CSV_PYTLIKY', __DIR__ . '/../src/test_sample-pytliky.csv');

// Flagy v col0 nebo col1
const FLAGS = [
    'f'          => 'active',
    'uz neni!'   => 'discontinued',
    'už není!'   => 'discontinued',
    'nevkladat'  => 'no_insert',
    'nevkládat'  => 'no_insert',
    'jen eshop'  => 'eshop_only',
    'na zkousku' => 'trial',
    'na zkoušku' => 'trial',
];

// Hlavní kategorie – vše ostatní (non-flag) je subkategorie
const MAIN_CATS = [
    'bílé', 'zelené', 'žluté', 'oolong', 'červené', 'černý',
    'tmavý', 'pchu-er', 'čínský tmavý pchu-er',
    'yerba mate', 'rooibos', 'bylinky', 'aromat.',
    'černé',  // aromatizované černé
];

// ─────────────────────────────────────────────────
// Pomocné funkce
// ─────────────────────────────────────────────────

function readCsvLines(string $path): array
{
    $lines = [];
    $handle = fopen($path, 'r');
    if (!$handle) die("Nelze otevrit: $path\n");
    // Odebrat UTF-8 BOM
    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") fseek($handle, 0);
    while (!feof($handle)) {
        $line = fgets($handle);
        if ($line === false) break;
        $lines[] = explode(';', rtrim($line, "\r\n"));
    }
    fclose($handle);
    return $lines;
}

function col(array $row, int $i): string
{
    return isset($row[$i]) ? trim($row[$i]) : '';
}

function intOrNull(string $v): ?int
{
    $v = preg_replace('/[\s\xc2\xa0]/', '', $v);
    if ($v === '' || $v === '-') return null;
    $n = filter_var($v, FILTER_VALIDATE_INT);
    return $n === false ? null : (int)$n;
}

function floatOrNull(string $v): ?float
{
    $v = str_replace([' ', "\xc2\xa0", ','], ['', '', '.'], $v);
    if ($v === '' || $v === '-') return null;
    $n = filter_var($v, FILTER_VALIDATE_FLOAT);
    return $n === false ? null : (float)$n;
}

function resolveFlag(string $raw): ?string
{
    $t = mb_strtolower(trim($raw));
    return FLAGS[$t] ?? null;
}

function isMainCat(string $name): bool
{
    $lower = mb_strtolower(trim($name));
    return in_array($lower, MAIN_CATS, true);
}

function isHeaderRow(array $row): bool
{
    $joined = mb_strtolower(implode(';', $row));
    // Řádky s popisem sloupců (obsahují klíčová slova z hlavičky)
    if (str_contains($joined, 'standardní balení')) return true;
    if (str_contains($joined, 'std.balení'))        return true;
    if (str_contains($joined, 'moc sáčku'))         return true;
    if (str_contains($joined, 'moc s'))             return true;
    // První header řádek (F;typ;...)
    if (trim($row[0] ?? '') === 'F' && trim($row[1] ?? '') === 'typ') return true;
    return false;
}

function isEmptyRow(array $row): bool
{
    foreach ($row as $c) {
        if (trim($c) !== '') return false;
    }
    return true;
}

function isCommentRow(array $row): bool
{
    // Dlouhý text v col1 bez číslic v col5+ = poznámka/komentář autora
    $c1 = trim($row[1] ?? '');
    if (mb_strlen($c1) > 40 && trim($row[2] ?? '') === '' && trim($row[5] ?? '') === '') {
        return true;
    }
    // URL
    if (str_starts_with($c1, 'http') || str_starts_with(trim($row[0] ?? ''), 'http')) {
        return true;
    }
    return false;
}

// ─────────────────────────────────────────────────
// DB helper
// ─────────────────────────────────────────────────

/** Cache: (name, parent_id) → id */
$categoryCache = [];

function upsertCategory(PDO $pdo, string $name, ?int $parentId, int &$sortOrder): int
{
    global $categoryCache;
    $key = $name . '::' . ($parentId ?? 'null');
    if (isset($categoryCache[$key])) return $categoryCache[$key];

    $stmt = $pdo->prepare(
        'SELECT id FROM tea_categories WHERE name = ? AND (parent_id <=> ?)'
    );
    $stmt->execute([$name, $parentId]);
    $row = $stmt->fetch();
    if ($row) {
        $categoryCache[$key] = (int)$row['id'];
        return $categoryCache[$key];
    }
    $stmt = $pdo->prepare(
        'INSERT INTO tea_categories (name, parent_id, sort_order) VALUES (?, ?, ?)'
    );
    $stmt->execute([$name, $parentId, $sortOrder++]);
    $id = (int)$pdo->lastInsertId();
    $categoryCache[$key] = $id;
    return $id;
}

// ─────────────────────────────────────────────────
// IMPORT ČAJŮ
// ─────────────────────────────────────────────────
function importCaje(PDO $pdo): int
{
    $rows = readCsvLines(CSV_CAJE);
    $inserted = 0;
    $sortOrder = 1;

    $currentMainCatId = null;
    $currentSubCatId  = null;

    $stmtTea = $pdo->prepare('
        INSERT INTO teas
            (category_id, name, note, flag,
             std_weight_g, std_price_moc, std_price_voc, std_margin_pct,
             pkg1_weight_g, pkg1_price_moc, pkg1_price_voc, pkg1_margin_pct,
             pkg2_weight_g, pkg2_price_moc, pkg2_price_voc, pkg2_margin_pct,
             stock_std_pcs, stock_pkg1_pcs, stock_pkg2_pcs,
             purchase_kg, tao_pct, trade_pct)
        VALUES
            (:category_id, :name, :note, :flag,
             :std_weight_g, :std_price_moc, :std_price_voc, :std_margin_pct,
             :pkg1_weight_g, :pkg1_price_moc, :pkg1_price_voc, :pkg1_margin_pct,
             :pkg2_weight_g, :pkg2_price_moc, :pkg2_price_voc, :pkg2_margin_pct,
             :stock_std_pcs, :stock_pkg1_pcs, :stock_pkg2_pcs,
             :purchase_kg, :tao_pct, :trade_pct)
    ');

    foreach ($rows as $row) {
        if (isEmptyRow($row))   continue;
        if (isHeaderRow($row))  continue;
        if (isCommentRow($row)) continue;

        $c0 = col($row, 0);  // flag (zřídka používáno v datech)
        $c1 = col($row, 1);  // kategorie / subkategorie / flag
        $c2 = col($row, 2);  // název čaje
        $c3 = col($row, 3);  // poznámka

        // ── Zjistit flag (z col0 nebo col1) ──
        $flagFromCol0 = resolveFlag($c0);
        $flagFromCol1 = resolveFlag($c1);
        $explicitFlag = $flagFromCol0 ?? $flagFromCol1; // col0 má přednost

        // ── Kategorie v col1 (jen pokud col1 není flag) ──
        if ($c1 !== '' && $flagFromCol1 === null) {
            if (isMainCat($c1)) {
                // Nová hlavní kategorie
                $currentMainCatId = upsertCategory($pdo, $c1, null, $sortOrder);
                $currentSubCatId  = null;
            } else {
                // Subkategorie pod aktuální hlavní kategorií
                if ($currentMainCatId !== null) {
                    $currentSubCatId = upsertCategory($pdo, $c1, $currentMainCatId, $sortOrder);
                } else {
                    // Žádná hlavní kategorie – použít jako hlavní
                    $currentMainCatId = upsertCategory($pdo, $c1, null, $sortOrder);
                    $currentSubCatId  = null;
                }
            }
        }

        // ── Čaj? ──
        if ($c2 === '') continue;
        if ($currentMainCatId === null) continue;

        $flag = $explicitFlag ?? 'active';
        if ($flag === 'no_insert') continue;

        $catId = $currentSubCatId ?? $currentMainCatId;

        $stmtTea->execute([
            ':category_id'     => $catId,
            ':name'            => $c2,
            ':note'            => $c3 !== '' ? $c3 : null,
            ':flag'            => $flag,

            ':std_weight_g'    => floatOrNull(col($row, 5)),
            ':std_price_moc'   => intOrNull(col($row, 6)),
            ':std_price_voc'   => intOrNull(col($row, 7)),
            ':std_margin_pct'  => floatOrNull(col($row, 8)),

            ':pkg1_weight_g'   => floatOrNull(col($row, 12)),
            ':pkg1_price_moc'  => intOrNull(col($row, 13)),
            ':pkg1_price_voc'  => intOrNull(col($row, 14)),
            ':pkg1_margin_pct' => floatOrNull(col($row, 15)),

            ':pkg2_weight_g'   => floatOrNull(col($row, 16)),
            ':pkg2_price_moc'  => intOrNull(col($row, 17)),
            ':pkg2_price_voc'  => intOrNull(col($row, 18)),
            ':pkg2_margin_pct' => floatOrNull(col($row, 19)),

            ':stock_std_pcs'   => intOrNull(col($row, 22)) ?? 0,
            ':stock_pkg1_pcs'  => intOrNull(col($row, 24)) ?? 0,
            ':stock_pkg2_pcs'  => intOrNull(col($row, 25)) ?? 0,

            ':purchase_kg'     => floatOrNull(col($row, 21)),
            ':tao_pct'         => floatOrNull(col($row, 26)),
            ':trade_pct'       => floatOrNull(col($row, 27)),
        ]);
        $inserted++;
    }

    return $inserted;
}

// ─────────────────────────────────────────────────
// IMPORT PYTLÍKŮ
// ─────────────────────────────────────────────────
function importPytliky(PDO $pdo): int
{
    $rows = readCsvLines(CSV_PYTLIKY);
    $inserted = 0;

    $currentSurface = null;
    $supplierUrl    = null;

    $stmtBag = $pdo->prepare('
        INSERT INTO bags
            (surface_type, volume_ml, dimensions, price_per_piece,
             var1_qty, var1_price, var1_margin_pct,
             var2_qty, var2_price, var2_margin_pct,
             var3_qty, var3_price, var3_margin_pct,
             supplier_url)
        VALUES
            (:surface_type, :volume_ml, :dimensions, :price_per_piece,
             :var1_qty, :var1_price, :var1_margin_pct,
             :var2_qty, :var2_price, :var2_margin_pct,
             :var3_qty, :var3_price, :var3_margin_pct,
             :supplier_url)
    ');

    foreach ($rows as $row) {
        if (isEmptyRow($row)) continue;

        $c0 = col($row, 0);
        $c1 = col($row, 1);

        // URL → zapamatuj pro aktuální sekci
        if (str_starts_with($c0, 'http')) {
            $supplierUrl = $c0;
            continue;
        }

        // Header řádky: "POVRCH" (globální header), nebo obsahují "varianta"
        $joined = mb_strtolower(implode(';', $row));
        if ($c0 === 'POVRCH' && $c1 === '') continue; // první řádek souboru

        // Surface header: col0 neprázdné a col1 == 'objem' (vzor: "PAPÍR;objem;rozměr;...")
        // MUSÍ být před kontrolou 'varianta', protože sekční header má varianta v zadních sloupcích
        if ($c0 !== '' && $c1 === 'objem'
            && !str_starts_with($c0, 'http') && !preg_match('/^\d/', $c0)
        ) {
            $currentSurface = $c0;
            $supplierUrl    = null;
            continue; // header řádek sekce – žádná data
        }

        if (str_contains($joined, 'varianta')) continue;

        // Datový řádek: col1 musí být objem (např. "100ml")
        if (!preg_match('/(\d+)\s*ml/i', $c1, $m)) continue;
        if ($currentSurface === null)               continue;

        $volumeMl  = (int)$m[1];
        $dimensions = col($row, 2) ?: null;

        // Layout:
        //  col3=var1_qty, col4=var1_price, col5=var1_margin%
        //  col6=var2_qty, col7=var2_price, col8=var2_margin%
        //  col9=var3_qty, col10=var3_price, col11=var3_margin%
        //  col12=separator, col13=price_per_piece(1ks)

        $stmtBag->execute([
            ':surface_type'    => $currentSurface,
            ':volume_ml'       => $volumeMl,
            ':dimensions'      => $dimensions,
            ':price_per_piece' => floatOrNull(col($row, 13)) ?? 0.0,

            ':var1_qty'        => intOrNull(col($row, 3)),
            ':var1_price'      => intOrNull(col($row, 4)),
            ':var1_margin_pct' => floatOrNull(col($row, 5)),

            ':var2_qty'        => intOrNull(col($row, 6)),
            ':var2_price'      => intOrNull(col($row, 7)),
            ':var2_margin_pct' => floatOrNull(col($row, 8)),

            ':var3_qty'        => intOrNull(col($row, 9)),
            ':var3_price'      => intOrNull(col($row, 10)),
            ':var3_margin_pct' => floatOrNull(col($row, 11)),

            ':supplier_url'    => $supplierUrl,
        ]);
        $inserted++;
    }

    return $inserted;
}

// ─────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────
try {
    $pdo = getPDO();

    echo "Importuji caje...\n";
    $teas = importCaje($pdo);
    echo "  => vlozeno do teas: $teas radku\n";

    echo "Importuji pytliky...\n";
    $bags = importPytliky($pdo);
    echo "  => vlozeno do bags: $bags radku\n";

    echo "\nHotovo.\n";

} catch (PDOException $e) {
    echo "DB chyba: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "Chyba: " . $e->getMessage() . "\n";
    exit(1);
}
