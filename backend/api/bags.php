<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

requireAuth();

if ($method === 'GET' && preg_match('#/api/bags$#', $path)) {
    listBags();
} elseif ($method === 'POST' && preg_match('#/api/bags$#', $path)) {
    requireAdmin();
    createBag();
} elseif ($method === 'PUT' && preg_match('#/api/bags/(\d+)$#', $path, $m)) {
    requireAdmin();
    updateBag((int) $m[1]);
} elseif ($method === 'DELETE' && preg_match('#/api/bags/(\d+)$#', $path, $m)) {
    requireAdmin();
    deleteBag((int) $m[1]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function bagColumns(): string {
    return 'id, surface_type, volume_ml, dimensions, price_per_piece, '
        . 'var1_qty, var1_price, var1_margin_pct, '
        . 'var2_qty, var2_price, var2_margin_pct, '
        . 'var3_qty, var3_price, var3_margin_pct, supplier_url';
}

function listBags(): void {
    $rows = getPDO()
        ->query('SELECT ' . bagColumns() . ' FROM bags ORDER BY surface_type, volume_ml')
        ->fetchAll();
    echo json_encode($rows);
}

function createBag(): void {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo  = getPDO();
    $stmt = $pdo->prepare(
        'INSERT INTO bags (surface_type, volume_ml, dimensions, price_per_piece) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $data['surface_type'] ?? 'nový',
        $data['volume_ml'] ?? 0,
        $data['dimensions'] ?? null,
        $data['price_per_piece'] ?? 0,
    ]);
    $id   = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT ' . bagColumns() . ' FROM bags WHERE id = ?');
    $stmt->execute([$id]);
    http_response_code(201);
    echo json_encode($stmt->fetch());
}

function updateBag(int $id): void {
    $data    = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo     = getPDO();
    $allowed = [
        'surface_type', 'volume_ml', 'dimensions', 'price_per_piece',
        'var1_qty', 'var1_price', 'var1_margin_pct',
        'var2_qty', 'var2_price', 'var2_margin_pct',
        'var3_qty', 'var3_price', 'var3_margin_pct', 'supplier_url',
    ];
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
        echo json_encode(['error' => 'Žádná platná pole k aktualizaci']);
        return;
    }
    $params[] = $id;
    $pdo->prepare('UPDATE bags SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    $stmt = $pdo->prepare('SELECT ' . bagColumns() . ' FROM bags WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Pytlík nenalezen']);
        return;
    }
    echo json_encode($row);
}

function deleteBag(int $id): void {
    $pdo = getPDO();
    try {
        $pdo->prepare('DELETE FROM bags WHERE id = ?')->execute([$id]);
        http_response_code(204);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Pytlík je použit v prodeji, nelze smazat.']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Chyba při mazání']);
        }
    }
}
