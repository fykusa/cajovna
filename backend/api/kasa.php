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
    $auth = requireAuth();
    handleAddMovement($auth);

} elseif ($method === 'GET' && preg_match('#/api/kasa/movements$#', $path)) {
    requireAdmin();
    handleListMovements();

} elseif ($method === 'POST' && preg_match('#/api/kasa/close$#', $path)) {
    $auth = requireAuth();
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
        'SELECT cc.confirmed_balance, cc.note, u.username AS created_by_username
         FROM 91_zaverka cc JOIN users u ON u.id = cc.created_by
         WHERE cc.date = ? LIMIT 1'
    );
    $stmt->execute([$today]);
    $todayClosing = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    if ($todayClosing) $todayClosing['confirmed_balance'] = (float) $todayClosing['confirmed_balance'];

    $stmt = $pdo->prepare(
        'SELECT COALESCE(SUM(total_kc), 0) FROM `00_prodej` WHERE DATE(created_at) = ? AND cancelled_at IS NULL'
    );
    $stmt->execute([$today]);
    $trzbyDnes = (float) $stmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT cm.id, cm.date, cm.amount, cm.note, cm.created_by,
                u.username AS created_by_username, cm.created_at
         FROM 90_cashflow cm
         JOIN users u ON u.id = cm.created_by
         WHERE cm.date = ?
         ORDER BY cm.created_at DESC'
    );
    $stmt->execute([$today]);
    $movements = array_map(function($row) {
        $row['amount'] = (float) $row['amount'];
        return $row;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    $pohybySum = (float) array_sum(array_column($movements, 'amount'));

    $stavKasy = $lastClosing !== null
        ? (float) $lastClosing['confirmed_balance'] + $trzbyDnes + $pohybySum
        : null;

    echo json_encode([
        'last_closing'  => $lastClosing
            ? ['date' => $lastClosing['date'], 'confirmed_balance' => (float) $lastClosing['confirmed_balance']]
            : null,
        'today_closing' => $todayClosing,
        'trzby_dnes'    => $trzbyDnes,
        'pohyby_dnes'   => $pohybySum,
        'stav_kasy'     => $stavKasy,
        'movements'     => $movements,
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
    $fetched = $row->fetch(PDO::FETCH_ASSOC);
    $fetched['amount'] = (float) $fetched['amount'];
    http_response_code(201);
    echo json_encode($fetched);
}

function handleListMovements(): void {
    $pdo = getPDO();

    if (isset($_GET['from']) || isset($_GET['to'])) {
        // range mode for admin history
        $from = $_GET['from'] ?? '1900-01-01';
        $to   = $_GET['to']   ?? date('Y-m-d');
        $stmt = $pdo->prepare(
            'SELECT cm.id, cm.date, cm.amount, cm.note, cm.created_by,
                    u.username AS created_by_username, cm.created_at
             FROM 90_cashflow cm JOIN users u ON u.id = cm.created_by
             WHERE cm.date BETWEEN :from AND :to ORDER BY cm.date DESC, cm.created_at DESC'
        );
        $stmt->execute(['from' => $from, 'to' => $to]);
    } else {
        // single-date mode (backward compat for POS status)
        $date = $_GET['date'] ?? date('Y-m-d');
        $stmt = $pdo->prepare(
            'SELECT cm.id, cm.date, cm.amount, cm.note, cm.created_by,
                    u.username AS created_by_username, cm.created_at
             FROM 90_cashflow cm JOIN users u ON u.id = cm.created_by
             WHERE cm.date = ? ORDER BY cm.created_at ASC'
        );
        $stmt->execute([$date]);
    }

    $movements = array_map(function($row) {
        $row['amount'] = (float) $row['amount'];
        return $row;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    echo json_encode($movements);
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
            'SELECT COALESCE(SUM(total_kc), 0) FROM `00_prodej` WHERE DATE(created_at) = ? AND cancelled_at IS NULL'
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
    $fetched = $row->fetch(PDO::FETCH_ASSOC);
    $fetched['calculated_balance'] = (float) $fetched['calculated_balance'];
    $fetched['confirmed_balance']  = (float) $fetched['confirmed_balance'];
    echo json_encode($fetched);
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
    $rows = array_map(function($r) {
        $r['calculated_balance'] = (float) $r['calculated_balance'];
        $r['confirmed_balance']  = (float) $r['confirmed_balance'];
        return $r;
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    echo json_encode($rows);
}
