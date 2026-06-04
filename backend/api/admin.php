<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../lib/db_transfer.php';

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(204);
    exit;
}

requireAdmin();

if ($method === 'GET' && preg_match('#/api/admin/export$#', $path)) {
    handleExport();
} elseif ($method === 'POST' && preg_match('#/api/admin/import$#', $path)) {
    handleImport();
} else {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function handleExport(): void {
    $zipPath = tempnam(sys_get_temp_dir(), 'exp');
    try {
        dbtExportZip(getPDO(), $zipPath);
        $name = 'cajovna-zaloha-' . date('Y-m-d') . '.zip';
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Content-Length: ' . filesize($zipPath));
        readfile($zipPath);
    } finally {
        @unlink($zipPath);
    }
}

function handleImport(): void {
    header('Content-Type: application/json; charset=utf-8');
    if (empty($_FILES['file']['tmp_name']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí nahraný soubor.']);
        return;
    }
    $groups = json_decode($_POST['tables'] ?? '[]', true);
    if (!is_array($groups)) $groups = [];
    // 'users' není mezi DBT_GROUPS → nelze ho importovat ani omylem.
    try {
        $imported = dbtImportZip(getPDO(), $_FILES['file']['tmp_name'], $groups);
        echo json_encode(['imported' => $imported]);
    } catch (Throwable $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
