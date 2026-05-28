<?php
require_once __DIR__ . '/config.php';

/**
 * Vygeneruje JWT token (HMAC-SHA256, pure PHP, bez externích závislostí).
 *
 * @param array $payload  Asociativní pole dat (user_id, username, role atd.)
 * @param int   $ttl      Platnost v sekundách (default: 3600 = 1 hodina)
 * @return string         Podepsaný JWT token
 */
function generateToken(array $payload, int $ttl = 3600): string {
    $header = base64url_encode(json_encode([
        'alg' => 'HS256',
        'typ' => 'JWT',
    ]));

    $payload['exp'] = time() + $ttl;
    $payload['iat'] = time();

    $body = base64url_encode(json_encode($payload));

    $signature = base64url_encode(
        hash_hmac('sha256', $header . '.' . $body, JWT_SECRET, true)
    );

    return $header . '.' . $body . '.' . $signature;
}

/**
 * Ověří JWT token a vrátí payload, nebo false při selhání.
 *
 * @param string $token
 * @return array|false
 */
function validateToken(string $token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }

    [$header, $body, $signature] = $parts;

    $expectedSig = base64url_encode(
        hash_hmac('sha256', $header . '.' . $body, JWT_SECRET, true)
    );

    // Timing-safe porovnání
    if (!hash_equals($expectedSig, $signature)) {
        return false;
    }

    $payload = json_decode(base64url_decode($body), true);
    if (!is_array($payload)) {
        return false;
    }

    // Kontrola expirace
    if (!isset($payload['exp']) || $payload['exp'] < time()) {
        return false;
    }

    return $payload;
}

/**
 * Middleware – vyžaduje platný JWT. Vrátí payload nebo pošle 401 a ukončí běh.
 */
function requireAuth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? getallheaders()['Authorization']
           ?? '';

    if (strncmp($header, 'Bearer ', 7) !== 0) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $token = substr($header, 7);
    $payload = validateToken($token);

    if ($payload === false) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired token']);
        exit;
    }

    return $payload;
}

/**
 * Middleware – vyžaduje roli admin.
 */
function requireAdmin(): array {
    $payload = requireAuth();
    if (($payload['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    return $payload;
}

// --- Pomocné funkce ---

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}
