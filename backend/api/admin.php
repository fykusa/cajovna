<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';
require_once __DIR__ . '/../lib/db_transfer.php';
require_once __DIR__ . '/../lib/sheets_sync.php';

// CORS hlavičky bezpodmínečně (i na GET/POST odpovědích), jako ostatní api soubory.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Sheets sync — vlastní auth (token NEBO admin session)
if ($method === 'POST' && preg_match('#/api/admin/sheets-sync$#', $path)) {
    header('Content-Type: application/json; charset=utf-8');
    handleSheetsSync();
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
    } catch (Throwable $e) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    } finally {
        @unlink($zipPath);
    }
}

function handleSheetsSync(): void {
    $configPath = __DIR__ . '/../config/sheets.php';
    if (!is_file($configPath)) {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'Konfigurace Sheets chybí (config/sheets.php).']);
        return;
    }
    $config = require $configPath;

    // Auth: token (Apps Script) nebo admin session (ruční sync z Dashboardu)
    $incomingToken = $_SERVER['HTTP_X_SYNC_TOKEN'] ?? '';
    $tokenOk       = $incomingToken !== '' && hash_equals($config['sync_token'] ?? '', $incomingToken);
    if (!$tokenOk) {
        requireAdmin(); // hodí 401/403 pokud není admin session
    }

    $sheet = $_GET['sheet'] ?? 'caje';
    if (!is_string($sheet) || !isset(PRODUKT_TABULKY[$sheet])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Neznámá záložka: ' . $sheet]);
        return;
    }
    $tableName = PRODUKT_TABULKY[$sheet];

    $url = $config["{$sheet}_csv_url"] ?? '';
    if ($url === '') {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'CSV URL není nakonfigurována.']);
        return;
    }

    try {
        $result = sheetsSyncProdukty(getPDO(), $url, $tableName);
        echo json_encode(['ok' => true, 'synced' => $result]);
    } catch (Throwable $e) {
        error_log('Sheets sync error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
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
