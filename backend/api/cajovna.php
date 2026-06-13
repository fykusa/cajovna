<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

$path   = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$auth = requireAuth();

if ($method === 'POST' && preg_match('#/api/cajovna/prodej$#', $path)) {
    createProdej($auth);
} elseif ($method === 'GET' && preg_match('#/api/cajovna/prodeje$#', $path)) {
    listProdeje();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function createProdej(array $auth): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $polozky = $data['polozky'] ?? [];

    if (empty($polozky)) {
        http_response_code(400);
        echo json_encode(['error' => 'Košík je prázdný.']);
        return;
    }

    foreach ($polozky as $p) {
        if (!isset($p['caje_id'], $p['baleni'], $p['kusu'], $p['jedn_cena'], $p['celk_cena'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatná položka.']);
            return;
        }
        if (!in_array((int) $p['baleni'], [1, 2, 3, 4], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Neplatné číslo balení: ' . $p['baleni']]);
            return;
        }
    }

    $total = (int) array_sum(array_column($polozky, 'celk_cena'));
    $pdo   = getPDO();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO `00_prodej` (user_id, total_kc) VALUES (?, ?)');
        $stmt->execute([$auth['user_id'], $total]);
        $prodejId = (int) $pdo->lastInsertId();

        $ins = $pdo->prepare(
            'INSERT INTO `00_prodej_polozky` (prodej_id, caje_id, baleni, kusu, jedn_cena, celk_cena)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($polozky as $p) {
            $ins->execute([
                $prodejId,
                (int) $p['caje_id'],
                (int) $p['baleni'],
                (int) $p['kusu'],
                (int) $p['jedn_cena'],
                (int) $p['celk_cena'],
            ]);
        }
        $pdo->commit();
        http_response_code(201);
        echo json_encode(['prodej_id' => $prodejId, 'total' => $total]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Chyba při zápisu prodeje.']);
    }
}

function listProdeje(): void {
    $pdo  = getPDO();
    $stmt = $pdo->query(
        'SELECT p.id, p.created_at, p.total_kc, u.username
         FROM `00_prodej` p
         JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC
         LIMIT 50'
    );
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}
