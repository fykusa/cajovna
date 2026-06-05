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

// GET /api/products/categories
if ($method === 'GET' && preg_match('#/api/products/categories$#', $path)) {
    listCategories();

// GET /api/products
} elseif ($method === 'GET' && preg_match('#/api/products$#', $path)) {
    listProducts();

// POST /api/products – pouze admin
} elseif ($method === 'POST' && preg_match('#/api/products$#', $path)) {
    requireAdmin();
    createProduct();

// GET /api/products/{id}
} elseif ($method === 'GET' && preg_match('#/api/products/(\d+)$#', $path, $m)) {
    getProduct((int) $m[1]);

// PUT /api/products/{id} – pouze admin
} elseif ($method === 'PUT' && preg_match('#/api/products/(\d+)$#', $path, $m)) {
    requireAdmin();
    updateProduct((int) $m[1]);

// DELETE /api/products/{id} – pouze admin
} elseif ($method === 'DELETE' && preg_match('#/api/products/(\d+)$#', $path, $m)) {
    requireAdmin();
    deleteProduct((int) $m[1]);

} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// --- Handlery ---

function listCategories(): void {
    $rows = getPDO()
        ->query('SELECT id, name FROM tea_categories ORDER BY name')
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
                    stock_std_pcs, stock_pkg1_pcs, stock_pkg2_pcs, stock_kg,
                    EXISTS(SELECT 1 FROM sale_items si WHERE si.tea_id = teas.id) AS has_sales
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

function createProduct(): void {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (empty($data['category_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id je povinný']);
        return;
    }

    $pdo  = getPDO();
    try {
        $stmt = $pdo->prepare('INSERT INTO teas (category_id, name, flag) VALUES (?, ?, ?)');
        $stmt->execute([
            (int) $data['category_id'],
            $data['name'] ?? 'Nový čaj',
            $data['flag'] ?? 'active',
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Neplatná kategorie']);
            return;
        }
        throw $e;
    }

    $id   = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM teas WHERE id = ?');
    $stmt->execute([$id]);

    http_response_code(201);
    echo json_encode($stmt->fetch());
}

function updateProduct(int $id): void {
    $data   = json_decode(file_get_contents('php://input'), true);
    $pdo    = getPDO();

    $allowed = [
        'category_id',
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

    $stmt = $pdo->prepare('SELECT * FROM teas WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    http_response_code(200);
    echo json_encode($row);
}

function deleteProduct(int $id): void {
    $pdo = getPDO();
    try {
        $stmt = $pdo->prepare('DELETE FROM teas WHERE id = ?');
        $stmt->execute([$id]);
        http_response_code(204);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Položka je použita v prodeji, nelze smazat — deaktivujte ji.']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Chyba při mazání']);
        }
    }
}
