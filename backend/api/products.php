<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

requireAuth();

// GET /api/products/categories
if ($method === 'GET' && preg_match('#/api/products/categories$#', $path)) {
    listCategories();

// GET /api/products
} elseif ($method === 'GET' && preg_match('#/api/products$#', $path)) {
    listProducts();

// GET /api/products/{id}
} elseif ($method === 'GET' && preg_match('#/api/products/(\d+)$#', $path, $m)) {
    getProduct((int) $m[1]);

// PUT /api/products/{id} – pouze admin
} elseif ($method === 'PUT' && preg_match('#/api/products/(\d+)$#', $path, $m)) {
    requireAdmin();
    updateProduct((int) $m[1]);

} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// --- Handlery ---

function listCategories(): void {
    $rows = getPDO()
        ->query('SELECT id, name, parent_id, sort_order FROM tea_categories ORDER BY sort_order, name')
        ->fetchAll();
    echo json_encode($rows);
}

function listProducts(): void {
    $pdo = getPDO();

    // Volitelné filtry
    $where  = ['1=1'];
    $params = [];

    if (!empty($_GET['category_id'])) {
        $where[]  = 'category_id = ?';
        $params[] = (int) $_GET['category_id'];
    }
    if (!empty($_GET['flag'])) {
        $where[]  = 'flag = ?';
        $params[] = $_GET['flag'];
    }
    if (!empty($_GET['search'])) {
        $where[]  = 'name LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }

    $sql  = 'SELECT id, category_id, name, note, flag, origin,
                    std_weight_g, std_price_moc,
                    pkg1_weight_g, pkg1_price_moc,
                    pkg2_weight_g, pkg2_price_moc,
                    stock_std_pcs, stock_pkg1_pcs, stock_pkg2_pcs, stock_kg
             FROM teas
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY name';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
}

function getProduct(int $id): void {
    $stmt = getPDO()->prepare('SELECT * FROM teas WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Čaj nenalezen']);
        return;
    }

    echo json_encode($row);
}

function updateProduct(int $id): void {
    $data   = json_decode(file_get_contents('php://input'), true);
    $pdo    = getPDO();

    $allowed = [
        'name', 'note', 'flag', 'origin',
        'std_weight_g', 'std_price_moc', 'std_price_voc', 'std_margin_pct',
        'pkg1_weight_g', 'pkg1_price_moc', 'pkg1_price_voc', 'pkg1_margin_pct',
        'pkg2_weight_g', 'pkg2_price_moc', 'pkg2_price_voc', 'pkg2_margin_pct',
    ];

    $fields = [];
    $params = [];

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
    $affected = $pdo->prepare('UPDATE teas SET ' . implode(', ', $fields) . ' WHERE id = ?');
    $affected->execute($params);

    if ($affected->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Čaj nenalezen']);
        return;
    }

    http_response_code(200);
    echo json_encode(['message' => 'OK']);
}
