<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../lib/produkty_list.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');

if ($method === 'GET' && preg_match('#/api/etnoshop$#', $path)) {
    handleListProdukty('03_etnoshop');
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}
