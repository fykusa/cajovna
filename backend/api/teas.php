<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

if ($method === 'GET' && preg_match('#/api/teas$#', $path)) {
    listTeas();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function listTeas(): void {
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

    $sql  = 'SELECT * FROM `01_caje`';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY KATEGORIE, NAZEV';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
}
