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

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

requireAuth();

// GET /api/bags
if ($method === 'GET' && preg_match('#/api/bags$#', $path)) {
    listBags();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function listBags(): void {
    $rows = getPDO()
        ->query('SELECT id, surface_type, volume_ml, dimensions, price_per_piece FROM bags ORDER BY surface_type, volume_ml')
        ->fetchAll();
    echo json_encode($rows);
}
