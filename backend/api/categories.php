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

if ($method === 'GET' && preg_match('#/api/categories$#', $path)) {
    listCategories();
} elseif ($method === 'GET' && preg_match('#/api/categories/(\d+)$#', $path, $m)) {
    getCategory((int) $m[1]);
} elseif ($method === 'POST' && preg_match('#/api/categories$#', $path)) {
    requireAdmin();
    createCategory();
} elseif ($method === 'PUT' && preg_match('#/api/categories/(\d+)$#', $path, $m)) {
    requireAdmin();
    updateCategory((int) $m[1]);
} elseif ($method === 'DELETE' && preg_match('#/api/categories/(\d+)$#', $path, $m)) {
    requireAdmin();
    deleteCategory((int) $m[1]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function listCategories(): void {
    $rows = getPDO()
        ->query('SELECT id, name, parent_id, sort_order FROM tea_categories ORDER BY sort_order, name')
        ->fetchAll();
    echo json_encode($rows);
}

function getCategory(int $id): void {
    $stmt = getPDO()->prepare('SELECT id, name, parent_id, sort_order FROM tea_categories WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Kategorie nenalezena']);
        return;
    }
    echo json_encode($row);
}

function createCategory(): void {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo  = getPDO();
    $stmt = $pdo->prepare('INSERT INTO tea_categories (name, parent_id, sort_order) VALUES (?, ?, ?)');
    $stmt->execute([
        $data['name'] ?? 'Nová kategorie',
        $data['parent_id'] ?? null,
        $data['sort_order'] ?? 0,
    ]);
    $id   = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT id, name, parent_id, sort_order FROM tea_categories WHERE id = ?');
    $stmt->execute([$id]);
    http_response_code(201);
    echo json_encode($stmt->fetch());
}

function updateCategory(int $id): void {
    $data    = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo     = getPDO();
    $allowed = ['name', 'parent_id', 'sort_order'];
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
    $pdo->prepare('UPDATE tea_categories SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    $stmt = $pdo->prepare('SELECT id, name, parent_id, sort_order FROM tea_categories WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Kategorie nenalezena']);
        return;
    }
    echo json_encode($row);
}

function deleteCategory(int $id): void {
    $pdo = getPDO();
    try {
        $pdo->prepare('DELETE FROM tea_categories WHERE id = ?')->execute([$id]);
        http_response_code(204);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Kategorie je použita u čajů, nelze smazat.']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Chyba při mazání']);
        }
    }
}
