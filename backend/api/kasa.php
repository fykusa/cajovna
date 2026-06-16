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

if ($method === 'GET' && preg_match('#/api/kasa/status$#', $path)) {
    requireAuth();
    handleStatus();

} elseif ($method === 'POST' && preg_match('#/api/kasa/movements$#', $path)) {
    $auth = requireAdmin();
    handleAddMovement($auth);

} elseif ($method === 'GET' && preg_match('#/api/kasa/movements$#', $path)) {
    requireAdmin();
    handleListMovements();

} elseif ($method === 'POST' && preg_match('#/api/kasa/close$#', $path)) {
    $auth = requireAdmin();
    handleClose($auth);

} elseif ($method === 'GET' && preg_match('#/api/kasa/closings$#', $path)) {
    requireAdmin();
    handleListClosings();

} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// --- Handlery ---

function handleStatus(): void {
    $pdo   = getPDO();
    $today = date('Y-m-d');

    $stmt = $pdo->prepare(
        'SELECT date, confirmed_balance FROM 91_zaverka WHERE date < ? ORDER BY date DESC LIMIT 1'
    );
    $stmt->execute([$today]);
    $lastClosing = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

    $stmt = $pdo->prepare(
        'SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE DATE(created_at) = ?'
    );
    $stmt->execute([$today]);
    $trzbyDnes = (float) $stmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT cm.id, cm.date, cm.amount, cm.note, cm.created_by,
                u.username AS created_by_username, cm.created_at
         FROM 90_cashflow cm
         JOIN users u ON u.id = cm.created_by
         WHERE cm.date = ?
         ORDER BY cm.created_at ASC'
    );
    $stmt->execute([$today]);
    $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $pohybySum = (float) array_sum(array_column($movements, 'amount'));

    $stavKasy = $lastClosing !== null
        ? (float) $lastClosing['confirmed_balance'] + $trzbyDnes + $pohybySum
        : null;

    echo json_encode([
        'last_closing' => $lastClosing
            ? ['date' => $lastClosing['date'], 'confirmed_balance' => (float) $lastClosing['confirmed_balance']]
            : null,
        'trzby_dnes'  => $trzbyDnes,
        'pohyby_dnes' => $pohybySum,
        'stav_kasy'   => $stavKasy,
        'movements'   => $movements,
    ]);
}

function handleAddMovement(array $auth): void {
    $data   = json_decode(file_get_contents('php://input'), true);
    $amount = $data['amount'] ?? null;
    $note   = trim($data['note'] ?? '');

    if ($amount === null || !is_numeric($amount)) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí nebo neplatná částka']);
        return;
    }
    if ($note === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Poznámka je povinná']);
        return;
    }

    $pdo = getPDO();
    $pdo->prepare(
        'INSERT INTO 90_cashflow (date, amount, note, created_by) VALUES (?, ?, ?, ?)'
    )->execute([date('Y-m-d'), (float) $amount, $note, $auth['user_id']]);

    $id  = (int) $pdo->lastInsertId();
    $row = $pdo->prepare(
        'SELECT cm.id, cm.date, cm.amount, cm.note, cm.created_by,
                u.username AS created_by_username, cm.created_at
         FROM 90_cashflow cm JOIN users u ON u.id = cm.created_by WHERE cm.id = ?'
    );
    $row->execute([$id]);
    http_response_code(201);
    echo json_encode($row->fetch(PDO::FETCH_ASSOC));
}

function handleListMovements(): void {
    $pdo  = getPDO();
    $date = $_GET['date'] ?? date('Y-m-d');
    $stmt = $pdo->prepare(
        'SELECT cm.id, cm.date, cm.amount, cm.note, cm.created_by,
                u.username AS created_by_username, cm.created_at
         FROM 90_cashflow cm JOIN users u ON u.id = cm.created_by
         WHERE cm.date = ? ORDER BY cm.created_at ASC'
    );
    $stmt->execute([$date]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function handleClose(array $auth): void {
    $data             = json_decode(file_get_contents('php://input'), true);
    $confirmedBalance = $data['confirmed_balance'] ?? null;
    $note             = isset($data['note']) ? trim($data['note']) : null;

    if ($confirmedBalance === null || !is_numeric($confirmedBalance)) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí potvrzený zůstatek']);
        return;
    }

    $pdo   = getPDO();
    $today = date('Y-m-d');

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE DATE(created_at) = ?'
        );
        $stmt->execute([$today]);
        $trzbyDnes = (float) $stmt->fetchColumn();

        $stmt = $pdo->prepare(
            'SELECT COALESCE(SUM(amount), 0) FROM 90_cashflow WHERE date = ?'
        );
        $stmt->execute([$today]);
        $pohybySum = (float) $stmt->fetchColumn();

        $stmt = $pdo->prepare(
            'SELECT confirmed_balance FROM 91_zaverka WHERE date < ? ORDER BY date DESC LIMIT 1'
        );
        $stmt->execute([$today]);
        $lastBalance = (float) ($stmt->fetchColumn() ?: 0);

        $calculatedBalance = $lastBalance + $trzbyDnes + $pohybySum;

        $pdo->prepare(
            'INSERT INTO 91_zaverka (date, calculated_balance, confirmed_balance, note, created_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               calculated_balance = VALUES(calculated_balance),
               confirmed_balance  = VALUES(confirmed_balance),
               note               = VALUES(note),
               created_by         = VALUES(created_by),
               updated_at         = CURRENT_TIMESTAMP'
        )->execute([$today, $calculatedBalance, (float) $confirmedBalance, $note, $auth['user_id']]);

        $pdo->commit();

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při uzavírání kasy']);
        return;
    }

    $row = $pdo->prepare(
        'SELECT cc.id, cc.date, cc.calculated_balance, cc.confirmed_balance,
                cc.note, cc.created_by, u.username AS created_by_username,
                cc.created_at, cc.updated_at
         FROM 91_zaverka cc JOIN users u ON u.id = cc.created_by WHERE cc.date = ?'
    );
    $row->execute([$today]);
    echo json_encode($row->fetch(PDO::FETCH_ASSOC));
}

function handleListClosings(): void {
    $pdo    = getPDO();
    $where  = ['1=1'];
    $params = [];

    if (!empty($_GET['from'])) { $where[] = 'cc.date >= ?'; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $where[] = 'cc.date <= ?'; $params[] = $_GET['to']; }

    $stmt = $pdo->prepare(
        'SELECT cc.id, cc.date, cc.calculated_balance, cc.confirmed_balance,
                cc.note, cc.created_by, u.username AS created_by_username,
                cc.created_at, cc.updated_at
         FROM 91_zaverka cc JOIN users u ON u.id = cc.created_by
         WHERE ' . implode(' AND ', $where) . '
         ORDER BY cc.date DESC LIMIT 100'
    );
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}
