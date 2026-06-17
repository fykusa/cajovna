<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
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
} elseif ($method === 'GET' && preg_match('#/api/cajovna/prodeje/(\d+)/polozky$#', $path, $m)) {
    listPolozky((int) $m[1]);
} elseif ($method === 'GET' && preg_match('#/api/cajovna/prodeje$#', $path)) {
    listProdeje();
} elseif ($method === 'GET' && preg_match('#/api/cajovna/kategorie$#', $path)) {
    listKategorie();
} elseif ($method === 'DELETE' && preg_match('#/api/cajovna/prodej/(\d+)$#', $path, $m)) {
    cancelProdej((int) $m[1]);
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
    $pdo       = getPDO();
    $from      = isset($_GET['from'])      ? trim($_GET['from'])      : null;
    $to        = isset($_GET['to'])        ? trim($_GET['to'])        : null;
    $kategorie = isset($_GET['kategorie']) ? trim($_GET['kategorie']) : null;
    $zeme      = isset($_GET['zeme'])      ? trim($_GET['zeme'])      : null;

    $where  = [];
    $params = [];

    if ($from && $to) {
        $where[]  = 'p.created_at BETWEEN ? AND ?';
        $params[] = $from;
        $params[] = $to;
    } elseif ($from) {
        $where[]  = 'p.created_at >= ?';
        $params[] = $from;
    } elseif ($to) {
        $where[]  = 'p.created_at <= ?';
        $params[] = $to;
    }

    if ($kategorie !== null && $kategorie !== '') {
        if ($zeme !== null && $zeme !== '') {
            $where[]  = 'EXISTS (SELECT 1 FROM `00_prodej_polozky` pp JOIN `01_caje` c ON c.id = pp.caje_id WHERE pp.prodej_id = p.id AND c.KATEGORIE = ? AND c.ZEME = ?)';
            $params[] = $kategorie;
            $params[] = $zeme;
        } else {
            $where[]  = 'EXISTS (SELECT 1 FROM `00_prodej_polozky` pp JOIN `01_caje` c ON c.id = pp.caje_id WHERE pp.prodej_id = p.id AND c.KATEGORIE = ?)';
            $params[] = $kategorie;
        }
    }

    $sql = 'SELECT p.id, p.created_at, p.total_kc, u.username, p.user_id, p.cancelled_at
            FROM `00_prodej` p
            JOIN users u ON u.id = p.user_id'
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY p.created_at DESC LIMIT 500';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function listKategorie(): void {
    $pdo  = getPDO();
    $stmt = $pdo->query(
        "SELECT DISTINCT KATEGORIE as kategorie, ZEME as zeme FROM `01_caje`
         WHERE AKTIV = 'x' AND KATEGORIE IS NOT NULL
         ORDER BY KATEGORIE, ZEME"
    );
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function listPolozky(int $prodejId): void {
    $pdo  = getPDO();
    $stmt = $pdo->prepare(
        'SELECT pp.id, pp.caje_id, pp.baleni, pp.kusu, pp.jedn_cena, pp.celk_cena,
                c.NAZEV as nazev, c.KATEGORIE as kategorie, c.ZEME as zeme
         FROM `00_prodej_polozky` pp
         LEFT JOIN `01_caje` c ON c.id = pp.caje_id
         WHERE pp.prodej_id = ?
         ORDER BY pp.id'
    );
    $stmt->execute([$prodejId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function cancelProdej(int $id): void {
    $auth = requireAuth();
    $pdo  = getPDO();

    $stmt = $pdo->prepare('SELECT id, user_id, cancelled_at, DATE(created_at) as sale_date FROM `00_prodej` WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Prodej nenalezen.']);
        return;
    }
    if ($row['cancelled_at'] !== null) {
        http_response_code(409);
        echo json_encode(['error' => 'Prodej je již stornován.']);
        return;
    }

    $isAdmin = ($auth['role'] === 'admin');
    $isOwner = ((int) $row['user_id'] === (int) $auth['user_id']);
    $isToday = ($row['sale_date'] === date('Y-m-d'));

    if (!$isAdmin && !($isOwner && $isToday)) {
        http_response_code(403);
        echo json_encode(['error' => 'Nemáte oprávnění stornovat tento prodej.']);
        return;
    }

    $pdo->prepare('UPDATE `00_prodej` SET cancelled_at = NOW(), cancelled_by = ? WHERE id = ?')
        ->execute([$auth['user_id'], $id]);

    echo json_encode(['ok' => true]);
}
