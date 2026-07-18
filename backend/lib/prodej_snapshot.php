<?php
// Zamrazení ceníkové a nákupní ceny položky prodeje v okamžiku prodeje
// (00_prodej_polozky.celk_cena_cenik/celk_cena_nakup), aby pozdější sync
// ze Sheets nepřepisoval historii prodejů. Viz spec
// docs/superpowers/specs/2026-07-18-ziskovost-design.md.
require_once __DIR__ . '/produkt_typy.php';

/**
 * SQL sloupcový seznam pro SELECT cen dané produktové tabulky. 01_caje má
 * navíc NAKUP1-4 (nákupní ceny), 02_nadobi/03_etnoshop je zatím nemají.
 */
function cenaColumnsForTable(string $tableName): string {
    $cols = 'CENA1,CENA2,CENA3,CENA4';
    if ($tableName === '01_caje') {
        $cols .= ',NAKUP1,NAKUP2,NAKUP3,NAKUP4';
    }
    return $cols;
}

/**
 * Načte řádek s cenami pro daný KOD ze zadané tabulky. Vrací null, pokud
 * KOD v tabulce neexistuje.
 */
function fetchCenaRow(PDO $pdo, string $tableName, string $kod): ?array {
    if (!in_array($tableName, PRODUKT_TABULKY, true)) {
        throw new InvalidArgumentException('Neznámá tabulka pro ceny: ' . $tableName);
    }
    $stmt = $pdo->prepare('SELECT ' . cenaColumnsForTable($tableName) . " FROM `$tableName` WHERE KOD = ?");
    $stmt->execute([$kod]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

/**
 * Z řádku vráceného fetchCenaRow() vybere jednotkovou ceníkovou a nákupní
 * cenu pro dané balení (1-4). Nákupní cena chybí u nádobí/etnoshopu
 * (sloupec v řádku vůbec není) → null.
 */
function pickBaleniCeny(array $row, int $baleni): array {
    return [
        'cenik' => isset($row["CENA$baleni"]) ? (int) $row["CENA$baleni"] : null,
        'nakup' => isset($row["NAKUP$baleni"]) ? (int) $row["NAKUP$baleni"] : null,
    ];
}

/**
 * SQL fragment (bez aliasu) počítající zisk jednoho prodeje ze zamrazených
 * cen položek. Položky s neznámou nákupní cenou (celk_cena_nakup IS NULL —
 * nádobí/etnoshop, nebo prodeje před nasazením zamrazování) se do součtu
 * nezapočítávají vůbec, ne jako nulová marže. Očekává alias `p` pro
 * `00_prodej` v obklopujícím dotazu.
 */
const PRODEJ_ZISK_SUBQUERY = "(SELECT COALESCE(SUM(
        CASE WHEN pp.celk_cena_nakup IS NOT NULL
             THEN pp.celk_cena_cenik - pp.celk_cena_nakup ELSE 0 END
    ), 0) FROM `00_prodej_polozky` pp WHERE pp.prodej_id = p.id)";
