<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

// CORS hlavičky
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Routing
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rtrim($path, '/');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('#/api/auth/login$#', $path)) {
    handleLogin();
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('#/api/auth/logout$#', $path)) {
    handleLogout();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

// --- Handlery ---

function handleLogin(): void {
    $data = json_decode(file_get_contents('php://input'), true);

    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }

    $pdo = getPDO();
    $stmt = $pdo->prepare(
        'SELECT id, username, password_hash, role, active FROM users WHERE username = ? LIMIT 1'
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !$user['active']) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }

    if (!password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }

    $token = generateToken([
        'user_id'  => (int) $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
    ]);

    http_response_code(200);
    echo json_encode([
        'token' => $token,
        'user'  => [
            'id'       => (int) $user['id'],
            'username' => $user['username'],
            'role'     => $user['role'],
        ],
    ]);
}

function handleLogout(): void {
    // JWT je stateless – server nic nedrží, stačí 200 OK.
    // Klient smaže token na své straně.
    http_response_code(200);
    echo json_encode(['message' => 'Logged out']);
}
