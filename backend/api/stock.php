<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

requireAdmin();

// PUT /api/stock/{tea_id}
if ($method === 'PUT' && preg_match('#/api/stock/(\d+)$#', $path, $m)) {
    updateStock((int) $m[1]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function updateStock(int $teaId): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo  = getPDO();

    // Ověř existenci čaje
    $check = $pdo->prepare('SELECT id FROM teas WHERE id = ?');
    $check->execute([$teaId]);
    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Čaj nenalezen']);
        return;
    }

    $allowed = ['stock_std_pcs', 'stock_pkg1_pcs', 'stock_pkg2_pcs', 'stock_kg'];
    $fields  = [];
    $params  = [];

    foreach ($allowed as $col) {
        if (array_key_exists($col, $data)) {
            $fields[] = "`$col` = ?";
            $params[]  = $data[$col];
        }
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'Žádné platné pole (stock_std_pcs, stock_pkg1_pcs, stock_pkg2_pcs, stock_kg)']);
        return;
    }

    $params[] = $teaId;
    $pdo->prepare('UPDATE teas SET ' . implode(', ', $fields) . ' WHERE id = ?')
        ->execute($params);

    $stmt = $pdo->prepare('SELECT * FROM teas WHERE id = ?');
    $stmt->execute([$teaId]);
    $row = $stmt->fetch();

    http_response_code(200);
    echo json_encode($row);
}
