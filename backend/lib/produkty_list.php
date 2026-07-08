<?php
require_once __DIR__ . '/produkt_typy.php';

/**
 * Sdílená GET listovací logika pro produktové tabulky (01_caje, 02_nadobi,
 * 03_etnoshop) — shodná struktura sloupců, liší se jen název tabulky.
 * Volající soubor (teas.php/nadobi.php/etnoshop.php) si řeší CORS hlavičky,
 * OPTIONS a routing regex sám; tahle funkce dělá jen požadovaný GET dotaz.
 */
function handleListProdukty(string $tableName): void {
    requireAuth();

    if (!in_array($tableName, PRODUKT_TABULKY, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Internal error: unknown table.']);
        return;
    }

    $pdo    = getPDO();
    $where  = ['V_SHEETU = 1'];
    $params = [];

    if (!empty($_GET['search'])) {
        $where[]  = 'NAZEV LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }
    if (!empty($_GET['kategorie'])) {
        $where[]  = 'KATEGORIE = ?';
        $params[] = $_GET['kategorie'];
    }
    if (isset($_GET['aktiv'])) {
        $where[]  = 'AKTIV = ?';
        $params[] = $_GET['aktiv'];
    }

    $sql  = "SELECT * FROM `$tableName`";
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY KATEGORIE, NAZEV';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
}
