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

// Všechny endpointy vyžadují admina
requireAdmin();

// GET /api/users
if ($method === 'GET' && preg_match('#/api/users$#', $path)) {
    listUsers();

// POST /api/users
} elseif ($method === 'POST' && preg_match('#/api/users$#', $path)) {
    createUser();

// PUT /api/users/{id}
} elseif ($method === 'PUT' && preg_match('#/api/users/(\d+)$#', $path, $m)) {
    updateUser((int) $m[1]);

// DELETE /api/users/{id}
} elseif ($method === 'DELETE' && preg_match('#/api/users/(\d+)$#', $path, $m)) {
    deleteUser((int) $m[1]);

} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// --- Handlery ---

function listUsers(): void {
    $rows = getPDO()
        ->query('SELECT id, username, role, active, created_at, password_changed_at FROM users ORDER BY username')
        ->fetchAll();
    echo json_encode($rows);
}

function createUser(): void {
    $data     = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $role     = $data['role'] ?? 'prodavacka';

    if ($username === '' || strlen($password) < 4) {
        http_response_code(400);
        echo json_encode(['error' => 'Username a heslo (min. 4 znaky) jsou povinné']);
        return;
    }

    if (!in_array($role, ['prodavacka', 'admin'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Neplatná role']);
        return;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $pdo  = getPDO();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO users (username, password_hash, role, password_changed_at) VALUES (?, ?, ?, NOW())'
        );
        $stmt->execute([$username, $hash, $role]);
        http_response_code(201);
        echo json_encode(['id' => (int) $pdo->lastInsertId(), 'username' => $username, 'role' => $role]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Uživatelské jméno již existuje']);
        } else {
            throw $e;
        }
    }
}

function updateUser(int $id): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo  = getPDO();

    // Ověř existenci
    $user = $pdo->prepare('SELECT id FROM users WHERE id = ?');
    $user->execute([$id]);
    if (!$user->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Uživatel nenalezen']);
        return;
    }

    $fields = [];
    $params = [];

    if (isset($data['username']) && trim($data['username']) !== '') {
        $fields[] = 'username = ?';
        $params[]  = trim($data['username']);
    }
    if (isset($data['password']) && strlen($data['password']) >= 4) {
        $fields[] = 'password_hash = ?';
        $params[]  = password_hash($data['password'], PASSWORD_BCRYPT);
        $fields[] = 'password_changed_at = NOW()';
    }
    if (isset($data['role']) && in_array($data['role'], ['prodavacka', 'admin'], true)) {
        $fields[] = 'role = ?';
        $params[]  = $data['role'];
    }
    if (isset($data['active'])) {
        $fields[] = 'active = ?';
        $params[]  = $data['active'] ? 1 : 0;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'Žádná platná pole k aktualizaci']);
        return;
    }

    $params[] = $id;
    $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
        ->execute($params);

    http_response_code(200);
    echo json_encode(['message' => 'OK']);
}

function deleteUser(int $id): void {
    // Soft delete – pouze deaktivace, historická data zůstanou
    $pdo  = getPDO();
    $stmt = $pdo->prepare('UPDATE users SET active = 0 WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Uživatel nenalezen']);
        return;
    }

    http_response_code(200);
    echo json_encode(['message' => 'Uživatel deaktivován']);
}
