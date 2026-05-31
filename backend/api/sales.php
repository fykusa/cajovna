<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

$auth = requireAuth();

// POST /api/sales – nový prodej
if ($method === 'POST' && preg_match('#/api/sales$#', $path)) {
    createSale($auth);

// GET /api/sales – přehled (admin only)
} elseif ($method === 'GET' && preg_match('#/api/sales$#', $path)) {
    requireAdmin();
    listSales();

// GET /api/sales/:id/items – položky prodeje (admin only)
} elseif ($method === 'GET' && preg_match('#/api/sales/(\d+)/items$#', $path, $m)) {
    requireAdmin();
    listSaleItems((int) $m[1]);

} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// --- Handlery ---

function createSale(array $auth): void {
    $data  = json_decode(file_get_contents('php://input'), true);
    $items = $data['items'] ?? [];

    if (empty($items)) {
        http_response_code(400);
        echo json_encode(['error' => 'Košík je prázdný']);
        return;
    }

    $validTypes = ['std', 'pkg1', 'pkg2', 'custom', 'bag'];
    $total      = 0.0;

    foreach ($items as $item) {
        if (!isset($item['item_type'], $item['unit_price'], $item['total_price'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatná položka košíku']);
            return;
        }
        if (!in_array($item['item_type'], $validTypes, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatný typ položky: ' . $item['item_type']]);
            return;
        }
        $total += (float) $item['total_price'];
    }

    $pdo = getPDO();
    $pdo->beginTransaction();

    try {
        // Hlavička prodeje
        $stmt = $pdo->prepare(
            'INSERT INTO sales (user_id, payment_method, total_amount, note) VALUES (?, "cash", ?, ?)'
        );
        $stmt->execute([$auth['user_id'], $total, $data['note'] ?? null]);
        $saleId = (int) $pdo->lastInsertId();

        // Položky + odečet skladu
        $insItem = $pdo->prepare(
            'INSERT INTO sale_items (sale_id, tea_id, bag_id, item_type, weight_g, quantity, unit_price, total_price, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        foreach ($items as $item) {
            $insItem->execute([
                $saleId,
                $item['tea_id']    ?? null,
                $item['bag_id']    ?? null,
                $item['item_type'],
                $item['weight_g']  ?? null,
                $item['quantity']  ?? 1,
                $item['unit_price'],
                $item['total_price'],
                $item['note']      ?? null,
            ]);

            // Odečet skladu
            deductStock($pdo, $item);
        }

        $pdo->commit();
        http_response_code(201);
        echo json_encode(['sale_id' => $saleId, 'total' => $total]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při zápisu prodeje']);
    }
}

function deductStock(PDO $pdo, array $item): void {
    $teaId = $item['tea_id'] ?? null;
    if ($teaId === null) {
        return; // bag jako samostatná položka – sklad pytlíků neevidujeme
    }

    $type = $item['item_type'];
    $qty  = (int) ($item['quantity'] ?? 1);

    switch ($type) {
        case 'std':
            $pdo->prepare('UPDATE teas SET stock_std_pcs = stock_std_pcs - ? WHERE id = ?')
                ->execute([$qty, $teaId]);
            break;
        case 'pkg1':
            $pdo->prepare('UPDATE teas SET stock_pkg1_pcs = stock_pkg1_pcs - ? WHERE id = ?')
                ->execute([$qty, $teaId]);
            break;
        case 'pkg2':
            $pdo->prepare('UPDATE teas SET stock_pkg2_pcs = stock_pkg2_pcs - ? WHERE id = ?')
                ->execute([$qty, $teaId]);
            break;
        case 'custom':
            // weight_g → odečíst v kg
            $kg = round((float) ($item['weight_g'] ?? 0) / 1000, 3);
            $pdo->prepare('UPDATE teas SET stock_kg = stock_kg - ? WHERE id = ?')
                ->execute([$kg, $teaId]);
            break;
    }
}

function listSales(): void {
    $pdo    = getPDO();
    $where  = ['1=1'];
    $params = [];
    $joins  = '';

    if (!empty($_GET['from'])) {
        $where[]  = 's.created_at >= ?';
        $params[] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $where[]  = 's.created_at <= ?';
        $params[] = $_GET['to'];
    }
    if (!empty($_GET['user_id'])) {
        $where[]  = 's.user_id = ?';
        $params[] = (int) $_GET['user_id'];
    }

    if (!empty($_GET['category_id']) || !empty($_GET['tea_id'])) {
        $joins .= ' JOIN sale_items si ON si.sale_id = s.id';
        $joins .= ' LEFT JOIN teas t ON t.id = si.tea_id';
    }

    if (!empty($_GET['category_id'])) {
        $where[]  = 't.category_id = ?';
        $params[] = (int) $_GET['category_id'];
    }

    if (!empty($_GET['tea_id'])) {
        $where[]  = 't.id = ?';
        $params[] = (int) $_GET['tea_id'];
    }

    $stmt = $pdo->prepare(
        'SELECT DISTINCT s.id, s.user_id, u.username, s.total_amount, s.note, s.created_at
         FROM sales s
         JOIN users u ON u.id = s.user_id' . $joins . '
         WHERE ' . implode(' AND ', $where) . '
         ORDER BY s.created_at DESC
         LIMIT 500'
    );
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
}

function listSaleItems(int $saleId): void {
    $pdo  = getPDO();
    $stmt = $pdo->prepare(
        'SELECT si.id, si.item_type, si.weight_g, si.quantity,
                si.unit_price, si.total_price, si.note,
                si.tea_id, t.name AS tea_name, t.category_id,
                b.surface_type, b.volume_ml
         FROM sale_items si
         LEFT JOIN teas t ON t.id = si.tea_id
         LEFT JOIN bags b ON b.id = si.bag_id
         WHERE si.sale_id = ?
         ORDER BY si.id'
    );
    $stmt->execute([$saleId]);
    echo json_encode($stmt->fetchAll());
}
