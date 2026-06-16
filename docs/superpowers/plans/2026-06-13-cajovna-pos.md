# Cajovna POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nová prodejní stránka `/cajovna` (kopie MobilePOS bez obalů) — kategorie a čaje z `01_caje`, prodeje zapisuje do `00_prodej` + `00_prodej_polozky`.

**Architecture:** Nový hook `useCajovnaPOS` načítá `TeaRow[]` z existujícího `GET /api/teas`, odvozuje kategorie jako unikátní `(KATEGORIE, ZEME)` páry, flow: home → categories → teas → packaging → quantity → checkout → success. Vše zapisuje přes nový `POST /api/cajovna/prodej`. Existující `/pos` a jeho kód se vůbec nedotýká.

**Tech Stack:** PHP 7.4 (bez Composeru), MySQL 5.7, React/TypeScript (Vite), Vitest + @testing-library/react, CSS Modules (kopírujeme styly z pos-mobile).

---

## Soubory

| Soubor | Akce |
|---|---|
| `db/migration_2026-06-13_cajovna_prodej.sql` | CREATE |
| `backend/api/cajovna.php` | CREATE |
| `backend/.htaccess` | MODIFY — přidat route |
| `frontend/src/types.ts` | MODIFY — přidat 4 nové typy |
| `frontend/src/api/cajovna.ts` | CREATE |
| `frontend/src/hooks/useCajovnaPOS.ts` | CREATE |
| `frontend/src/hooks/useCajovnaPOS.test.ts` | CREATE |
| `frontend/src/components/pos-cajovna/CajeCategories.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajeTeas.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajePackaging.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajeQuantity.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajeHome.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajeCheckout.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajeHistory.tsx` + `.module.css` | CREATE |
| `frontend/src/components/pos-cajovna/CajeProgressBar.tsx` + `.module.css` | CREATE |
| `frontend/src/pages/CajovnaPOS.tsx` | CREATE |
| `frontend/src/router/AppRouter.tsx` | MODIFY — přidat route `/cajovna` |

---

## Task 1: DB Migrace

**Files:**
- Create: `db/migration_2026-06-13_cajovna_prodej.sql`

- [ ] **Vytvoř migrační soubor**

```sql
-- Nové tabulky pro Cajovna POS (01_caje → prodeje bez obalů)

CREATE TABLE IF NOT EXISTS `00_prodej` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `user_id`    INT          NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_kc`   INT          NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `00_prodej_polozky` (
  `id`        INT      NOT NULL AUTO_INCREMENT,
  `prodej_id` INT      NOT NULL,
  `caje_id`   INT      NOT NULL,
  `baleni`    TINYINT  NOT NULL COMMENT '1=Standard 2=Větší 3=Největší 4=Čajovna',
  `kusu`      SMALLINT NOT NULL,
  `jedn_cena` INT      NOT NULL,
  `celk_cena` INT      NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`prodej_id`) REFERENCES `00_prodej`(`id`),
  FOREIGN KEY (`caje_id`)   REFERENCES `01_caje`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Spusť migraci v phpMyAdmin nebo Docker**

```bash
docker exec -i cajovna-mysql-1 mysql -u root -proot cajovna < db/migration_2026-06-13_cajovna_prodej.sql
```

> Heslo může být jiné — zkontroluj `backend/config.php` nebo spusť SQL v phpMyAdmin (http://localhost:8081).

- [ ] **Ověř, že tabulky existují**

```bash
docker exec cajovna-mysql-1 mysql -u root -proot cajovna -e "SHOW TABLES LIKE '00_%';"
```

Očekáváno: `00_prodej`, `00_prodej_polozky`.

- [ ] **Commitni**

```bash
git add db/migration_2026-06-13_cajovna_prodej.sql
git commit -m "db: migrace tabulek 00_prodej a 00_prodej_polozky pro Cajovna POS"
```

---

## Task 2: Backend endpoint

**Files:**
- Create: `backend/api/cajovna.php`
- Modify: `backend/.htaccess`

- [ ] **Přidej route do `backend/.htaccess`**

Za řádek `RewriteRule ^api/teas(/.*)?$    api/teas.php    [QSA,L]` přidej:
```apache
RewriteRule ^api/cajovna(/.*)?$  api/cajovna.php  [QSA,L]
```

- [ ] **Vytvoř `backend/api/cajovna.php`**

```php
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
```

- [ ] **Ověř PHP syntaxi**

```bash
docker exec cajovna-php-1 php -l /var/www/html/api/cajovna.php
```

Očekáváno: `No syntax errors detected`.

- [ ] **Commitni**

```bash
git add backend/api/cajovna.php backend/.htaccess
git commit -m "feat(cajovna): POST /api/cajovna/prodej a GET /api/cajovna/prodeje"
```

---

## Task 3: TypeScript typy

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Přidej 4 nové typy na konec `frontend/src/types.ts`**

Za blok `export interface SaleItem { ... }` přidej:

```typescript
export interface CajeCategory {
  kategorie: string
  zeme: string | null
}

export interface CajeBaleni {
  cislo: 1 | 2 | 3 | 4
  label: 'Standard' | 'Větší' | 'Největší' | 'Čajovna'
  mn: number    // gramáž
  cena: number  // MOC v Kč
}

export interface CajeCartItem {
  localId: string
  caj: TeaRow
  baleni: CajeBaleni
  kusu: number
  celkCena: number
}

export interface CajovnaProdej {
  id: number
  created_at: string
  total_kc: number
  username: string
}
```

- [ ] **Ověř TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Očekáváno: žádný výstup (0 chyb).

---

## Task 4: Frontend API

**Files:**
- Create: `frontend/src/api/cajovna.ts`

- [ ] **Vytvoř `frontend/src/api/cajovna.ts`**

```typescript
import { apiFetch } from './client'
import type { CajovnaProdej } from '../types'

export interface CajePolozkaSend {
  caje_id: number
  baleni: 1 | 2 | 3 | 4
  kusu: number
  jedn_cena: number
  celk_cena: number
}

export interface CajovnaSaleResponse {
  prodej_id: number
  total: number
}

export const createCajovnaSale = (polozky: CajePolozkaSend[]): Promise<CajovnaSaleResponse> =>
  apiFetch<CajovnaSaleResponse>('/cajovna/prodej', {
    method: 'POST',
    body: JSON.stringify({ polozky }),
  })

export const getCajovnaProdeje = (): Promise<CajovnaProdej[]> =>
  apiFetch<CajovnaProdej[]>('/cajovna/prodeje')
```

- [ ] **Ověř TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

---

## Task 5: Hook — testy (TDD — nejdřív testy)

**Files:**
- Create: `frontend/src/hooks/useCajovnaPOS.test.ts`

- [ ] **Vytvoř `frontend/src/hooks/useCajovnaPOS.test.ts`**

```typescript
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useCajovnaPOS, buildBaleni, deriveCategories } from './useCajovnaPOS'
import type { TeaRow } from '../types'
import * as teasApi from '../api/teas'
import * as cajovnaApi from '../api/cajovna'

vi.mock('../api/teas')
vi.mock('../api/cajovna')

const row1: TeaRow = {
  id: 1, KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Show Mee',
  POZNAMKA: null, MN1: 30, CENA1: 130, MN2: 200, CENA2: 700,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row2: TeaRow = {
  id: 2, KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Bai Mu Dan',
  POZNAMKA: 'poznámka', MN1: 30, CENA1: 220, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row3: TeaRow = {
  id: 3, KATEGORIE: 'ZELENÉ', ZEME: 'Japonsko', AKTIV: null, NAZEV: 'Neaktivní',
  POZNAMKA: null, MN1: 30, CENA1: 100, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}

beforeEach(() => {
  vi.mocked(teasApi.getTeas).mockResolvedValue([row1, row2, row3])
  vi.mocked(cajovnaApi.createCajovnaSale).mockResolvedValue({ prodej_id: 1, total: 130 })
})

// --- buildBaleni ---
describe('buildBaleni', () => {
  test('vrátí jen balení kde MN i CENA nejsou null', () => {
    const opts = buildBaleni(row1)
    expect(opts).toHaveLength(2)
    expect(opts[0]).toEqual({ cislo: 1, label: 'Standard', mn: 30, cena: 130 })
    expect(opts[1]).toEqual({ cislo: 2, label: 'Větší', mn: 200, cena: 700 })
  })
  test('vrátí prázdné pole když nejsou žádná balení', () => {
    const r = { ...row1, MN1: null, CENA1: null, MN2: null, CENA2: null }
    expect(buildBaleni(r)).toHaveLength(0)
  })
  test('přeskočí balení kde chybí jen CENA', () => {
    const r = { ...row1, CENA2: null }
    expect(buildBaleni(r)).toHaveLength(1)
    expect(buildBaleni(r)[0].cislo).toBe(1)
  })
})

// --- deriveCategories ---
describe('deriveCategories', () => {
  test('filtruje neaktivní řádky, deduplikuje, řadí abecedně', () => {
    const cats = deriveCategories([row1, row2, row3])
    expect(cats).toHaveLength(1)
    expect(cats[0]).toEqual({ kategorie: 'BÍLÝ', zeme: 'Čína' })
  })
  test('vrátí prázdné pole pro prázdný vstup', () => {
    expect(deriveCategories([])).toHaveLength(0)
  })
})

// --- useCajovnaPOS ---
describe('useCajovnaPOS', () => {
  test('startuje na home, načítá data', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    expect(result.current.view).toBe('home')
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.categories).toHaveLength(1)
    expect(result.current.cart).toHaveLength(0)
  })

  test('selectCategory → teas view, filtruje aktivní čaje kategorie', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    expect(result.current.view).toBe('teas')
    expect(result.current.teas).toHaveLength(2)
    expect(result.current.teas.every((r) => r.AKTIV === 'x')).toBe(true)
  })

  test('selectTea → packaging view, sestaví baleniOptions', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    expect(result.current.view).toBe('packaging')
    expect(result.current.baleniOptions).toHaveLength(2)
    expect(result.current.selectedBaleni?.cislo).toBe(1)
  })

  test('selectBaleni → quantity view', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    expect(result.current.view).toBe('quantity')
  })

  test('selectKusu → přidá do košíku, vrátí na home, resetuje výběr', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(2))
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].celkCena).toBe(260) // 130 * 2
    expect(result.current.cart[0].kusu).toBe(2)
    expect(result.current.selectedTea).toBeNull()
    expect(result.current.selectedBaleni).toBeNull()
  })

  test('removeFromCart odstraní správnou položku', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    const id = result.current.cart[0].localId
    act(() => result.current.removeFromCart(id))
    expect(result.current.cart).toHaveLength(0)
  })

  test('goBack z teas → categories', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('categories')
  })

  test('goBack z home → zůstane home', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('home')
  })

  test('goBack z checkout → home (special case)', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.startCheckout())
    act(() => result.current.goBack())
    expect(result.current.view).toBe('home')
  })

  test('confirmCheckout → volá createCajovnaSale, přejde na success, vymaže košík', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(cajovnaApi.createCajovnaSale).toHaveBeenCalledOnce()
    expect(cajovnaApi.createCajovnaSale).toHaveBeenCalledWith([
      { caje_id: 1, baleni: 1, kusu: 1, jedn_cena: 130, celk_cena: 130 },
    ])
    expect(result.current.view).toBe('success')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.lastTotal).toBe(130)
  })

  test('confirmCheckout při chybě API → nastaví checkoutError, zůstane na checkout', async () => {
    vi.mocked(cajovnaApi.createCajovnaSale).mockRejectedValueOnce(new Error('Server error'))
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(result.current.view).toBe('checkout')
    expect(result.current.checkoutError).toBe('Server error')
  })

  test('newSale resetuje košík a výběry', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory({ kategorie: 'BÍLÝ', zeme: 'Čína' }))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.newSale())
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCategory).toBeNull()
  })
})
```

- [ ] **Spusť testy — musí SELHAT (hook neexistuje)**

```bash
cd frontend && npm run test -- --run --reporter=verbose useCajovnaPOS
```

Očekáváno: `Cannot find module './useCajovnaPOS'` nebo podobná chyba.

---

## Task 6: Hook — implementace

**Files:**
- Create: `frontend/src/hooks/useCajovnaPOS.ts`

- [ ] **Vytvoř `frontend/src/hooks/useCajovnaPOS.ts`**

```typescript
import { useState, useEffect } from 'react'
import type { TeaRow, CajeCategory, CajeBaleni, CajeCartItem } from '../types'
import { getTeas } from '../api/teas'
import { createCajovnaSale } from '../api/cajovna'

export type CajeView = 'home' | 'categories' | 'teas' | 'packaging' | 'quantity' | 'checkout' | 'success'

export const CAJE_VIEW_ORDER: CajeView[] = [
  'home', 'categories', 'teas', 'packaging', 'quantity', 'checkout', 'success',
]

export function buildBaleni(tea: TeaRow): CajeBaleni[] {
  const opts: CajeBaleni[] = []
  if (tea.MN1 != null && tea.CENA1 != null)
    opts.push({ cislo: 1, label: 'Standard',  mn: tea.MN1, cena: tea.CENA1 })
  if (tea.MN2 != null && tea.CENA2 != null)
    opts.push({ cislo: 2, label: 'Větší',     mn: tea.MN2, cena: tea.CENA2 })
  if (tea.MN3 != null && tea.CENA3 != null)
    opts.push({ cislo: 3, label: 'Největší',  mn: tea.MN3, cena: tea.CENA3 })
  if (tea.MN4 != null && tea.CENA4 != null)
    opts.push({ cislo: 4, label: 'Čajovna',   mn: tea.MN4, cena: tea.CENA4 })
  return opts
}

export function deriveCategories(rows: TeaRow[]): CajeCategory[] {
  const seen = new Set<string>()
  const cats: CajeCategory[] = []
  for (const r of rows) {
    if (r.AKTIV !== 'x' || r.KATEGORIE == null) continue
    const key = `${r.KATEGORIE}||${r.ZEME ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      cats.push({ kategorie: r.KATEGORIE, zeme: r.ZEME })
    }
  }
  return cats.sort((a, b) => a.kategorie.localeCompare(b.kategorie, 'cs'))
}

export function useCajovnaPOS() {
  const [view, setView]                     = useState<CajeView>('home')
  const [allRows, setAllRows]               = useState<TeaRow[]>([])
  const [categories, setCategories]         = useState<CajeCategory[]>([])
  const [teas, setTeas]                     = useState<TeaRow[]>([])
  const [selectedCategory, setSelectedCategory] = useState<CajeCategory | null>(null)
  const [selectedTea, setSelectedTea]       = useState<TeaRow | null>(null)
  const [baleniOptions, setBaleniOptions]   = useState<CajeBaleni[]>([])
  const [selectedBaleni, setSelectedBaleni] = useState<CajeBaleni | null>(null)
  const [cart, setCart]                     = useState<CajeCartItem[]>([])
  const [lastTotal, setLastTotal]           = useState(0)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [checkoutError, setCheckoutError]   = useState<string | null>(null)

  useEffect(() => {
    getTeas()
      .then((rows) => {
        setAllRows(rows)
        setCategories(deriveCategories(rows))
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Chyba načítání dat')
        setLoading(false)
      })
  }, [])

  function selectCategory(cat: CajeCategory) {
    setSelectedCategory(cat)
    setTeas(allRows.filter((r) => r.AKTIV === 'x' && r.KATEGORIE === cat.kategorie))
    setView('teas')
  }

  function selectTea(tea: TeaRow) {
    setSelectedTea(tea)
    const opts = buildBaleni(tea)
    setBaleniOptions(opts)
    setSelectedBaleni(opts[0] ?? null)
    setView('packaging')
  }

  function selectBaleni(b: CajeBaleni) {
    setSelectedBaleni(b)
    setView('quantity')
  }

  function selectKusu(n: number) {
    if (!selectedTea || !selectedBaleni) return
    const item: CajeCartItem = {
      localId: `${Date.now()}-${Math.random()}`,
      caj: selectedTea,
      baleni: selectedBaleni,
      kusu: n,
      celkCena: selectedBaleni.cena * n,
    }
    setCart((prev) => [...prev, item])
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setView('home')
  }

  function removeFromCart(localId: string) {
    setCart((prev) => prev.filter((i) => i.localId !== localId))
  }

  function goBack() {
    if (view === 'checkout') { setView('home'); return }
    const idx = CAJE_VIEW_ORDER.indexOf(view)
    if (idx <= 0) return
    setView(CAJE_VIEW_ORDER[idx - 1])
  }

  function goToCategories() { setView('categories') }

  function startCheckout() {
    setCheckoutError(null)
    setView('checkout')
  }

  async function confirmCheckout() {
    setCheckoutError(null)
    try {
      const polozky = cart.map((item) => ({
        caje_id:   item.caj.id,
        baleni:    item.baleni.cislo,
        kusu:      item.kusu,
        jedn_cena: item.baleni.cena,
        celk_cena: item.celkCena,
      }))
      const res = await createCajovnaSale(polozky)
      setLastTotal(res.total)
      setCart([])
      setView('success')
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    }
  }

  function newSale() {
    setCart([])
    setSelectedCategory(null)
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setView('home')
  }

  return {
    view, categories, teas, baleniOptions,
    selectedCategory, selectedTea, selectedBaleni,
    cart, lastTotal, loading, error, checkoutError,
    selectCategory, selectTea, selectBaleni, selectKusu,
    removeFromCart, goBack, goToCategories,
    startCheckout, confirmCheckout, newSale,
  }
}
```

- [ ] **Spusť testy — musí PROJÍT**

```bash
cd frontend && npm run test -- --run --reporter=verbose useCajovnaPOS
```

Očekáváno: všechny testy zelené (přibližně 13 testů).

- [ ] **Commitni**

```bash
git add frontend/src/hooks/useCajovnaPOS.ts frontend/src/hooks/useCajovnaPOS.test.ts frontend/src/api/cajovna.ts frontend/src/types.ts
git commit -m "feat(cajovna): hook useCajovnaPOS + typy + API cajovna.ts"
```

---

## Task 7: Komponenty — kategorie a čaje

**Files:**
- Create: `frontend/src/components/pos-cajovna/CajeCategories.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeCategories.module.css`
- Create: `frontend/src/components/pos-cajovna/CajeTeas.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeTeas.module.css`

- [ ] **Vytvoř `CajeCategories.tsx`**

```tsx
import type { CajeCategory } from '../../types'
import styles from './CajeCategories.module.css'

interface Props {
  categories: CajeCategory[]
  onSelect: (cat: CajeCategory) => void
}

export default function CajeCategories({ categories, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        {categories.map((cat) => (
          <button
            key={`${cat.kategorie}||${cat.zeme ?? ''}`}
            className={styles.card}
            onClick={() => onSelect(cat)}
          >
            <span className={styles.name}>{cat.kategorie}</span>
            {cat.zeme && <span className={styles.zeme}>{cat.zeme}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Vytvoř `CajeCategories.module.css`**

```css
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px 16px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.card {
  padding: 14px 12px; border-radius: var(--mob-r); background: var(--mob-surface);
  border: 1px solid var(--mob-border); color: var(--mob-fg);
  font-size: 14px; font-weight: 500; text-align: center; cursor: pointer;
  min-height: 72px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
}
.card:active { background: var(--mob-accent-bg); border-color: var(--mob-accent); transform: scale(0.97); }
.name { font-size: 14px; font-weight: 600; }
.zeme { font-size: 11px; color: var(--mob-fg-dim, #888); }
```

- [ ] **Vytvoř `CajeTeas.tsx`**

```tsx
import type { TeaRow } from '../../types'
import styles from './CajeTeas.module.css'

interface Props {
  teas: TeaRow[]
  categoryName: string
  onSelect: (tea: TeaRow) => void
}

export default function CajeTeas({ teas, categoryName, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      {teas.length === 0 && (
        <p className={styles.empty}>Žádné čaje v kategorii {categoryName}.</p>
      )}
      <ul className={styles.list}>
        {teas.map((tea) => (
          <li key={tea.id}>
            <button className={styles.row} onClick={() => onSelect(tea)}>
              <div className={styles.info}>
                <span className={styles.name}>{tea.NAZEV}</span>
                {tea.POZNAMKA && <span className={styles.note}>{tea.POZNAMKA}</span>}
              </div>
              {tea.CENA1 != null && (
                <span className={styles.price}>{tea.CENA1} Kč</span>
              )}
              <span className={styles.arrow}>›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Vytvoř `CajeTeas.module.css`** (kopie z `pos-mobile/MobileTeas.module.css`)

```css
.scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.empty { padding: 24px 16px; color: var(--mob-fg-dim, #888); text-align: center; }
.list { list-style: none; margin: 0; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 6px; }
.row {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: var(--mob-r); background: var(--mob-surface);
  border: 1px solid var(--mob-border); color: var(--mob-fg); cursor: pointer; text-align: left;
}
.row:active { background: var(--mob-accent-bg); border-color: var(--mob-accent); }
.info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.name { font-size: 15px; font-weight: 500; }
.note { font-size: 11px; color: var(--mob-fg-dim, #888); }
.price { font-size: 14px; color: var(--mob-accent); font-weight: 600; white-space: nowrap; }
.arrow { font-size: 18px; color: var(--mob-fg-dim, #888); }
```

---

## Task 8: Komponenty — výběr balení a množství

**Files:**
- Create: `frontend/src/components/pos-cajovna/CajePackaging.tsx`
- Create: `frontend/src/components/pos-cajovna/CajePackaging.module.css`
- Create: `frontend/src/components/pos-cajovna/CajeQuantity.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeQuantity.module.css`

- [ ] **Vytvoř `CajePackaging.tsx`**

```tsx
import type { CajeBaleni } from '../../types'
import styles from './CajePackaging.module.css'

interface Props {
  options: CajeBaleni[]
  selected: CajeBaleni | null
  onSelect: (b: CajeBaleni) => void
}

export default function CajePackaging({ options, selected, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <ul className={styles.list}>
        {options.map((b) => (
          <li key={b.cislo}>
            <button
              className={`${styles.row} ${selected?.cislo === b.cislo ? styles.active : ''}`}
              onClick={() => onSelect(b)}
            >
              <div className={styles.info}>
                <span className={styles.label}>{b.label}</span>
                <span className={styles.weight}>{b.mn} g</span>
              </div>
              <span className={styles.price}>{b.cena} Kč</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Vytvoř `CajePackaging.module.css`** (kopie z `pos-mobile/MobilePackaging.module.css` — ten přečti a zkopíruj beze změny)

Přečti `frontend/src/components/pos-mobile/MobilePackaging.module.css` a zkopíruj obsah do `CajePackaging.module.css`.

- [ ] **Vytvoř `CajeQuantity.tsx`**

```tsx
import type { CajeBaleni } from '../../types'
import styles from './CajeQuantity.module.css'

const QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]

interface Props {
  baleni: CajeBaleni
  onSelect: (n: number) => void
}

export default function CajeQuantity({ baleni, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <p className={styles.hint}>{baleni.label} · {baleni.mn} g · {baleni.cena} Kč/ks</p>
      <div className={styles.grid}>
        {QUANTITIES.map((n) => (
          <button key={n} className={styles.btn} onClick={() => onSelect(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Vytvoř `CajeQuantity.module.css`**

Přečti `frontend/src/components/pos-mobile/MobileQuantity.module.css` a zkopíruj obsah do `CajeQuantity.module.css`. Pokud `MobileQuantity` nemá `.hint` třídu, přidej:

```css
.hint { padding: 12px 16px 4px; font-size: 13px; color: var(--mob-fg-dim, #888); }
```

---

## Task 9: Komponenty — košík a pokladna

**Files:**
- Create: `frontend/src/components/pos-cajovna/CajeHome.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeHome.module.css`
- Create: `frontend/src/components/pos-cajovna/CajeCheckout.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeCheckout.module.css`

- [ ] **Vytvoř `CajeHome.tsx`**

```tsx
import type { CajeCartItem } from '../../types'
import styles from './CajeHome.module.css'

interface Props {
  cart: CajeCartItem[]
  onAddItem: () => void
  onCheckout: () => void
  onRemove: (localId: string) => void
}

export default function CajeHome({ cart, onAddItem, onCheckout, onRemove }: Props) {
  const total = cart.reduce((s, i) => s + i.celkCena, 0)

  return (
    <>
      <div className={styles.scroll}>
        {cart.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyChar}>茶</span>
            <p>Košík je prázdný. Přidejte první položku.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {cart.map((item) => (
              <li key={item.localId} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.caj.NAZEV}</span>
                  <span className={styles.itemDetail}>
                    {item.kusu}× · {item.baleni.label} {item.baleni.mn}g · {item.baleni.cena} Kč/ks
                  </span>
                </div>
                <span className={styles.itemPrice}>{item.celkCena} Kč</span>
                <button
                  className={styles.removeBtn}
                  onClick={() => onRemove(item.localId)}
                  aria-label="Odstranit"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 && (
        <div className={styles.totalRow}>
          <span>Celkem</span>
          <span className={styles.totalAmt}>{total.toLocaleString('cs-CZ')} Kč</span>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.addBtn} onClick={onAddItem}>+ Přidat položku</button>
        {cart.length > 0 && (
          <button className={styles.checkoutBtn} onClick={onCheckout}>
            Zaúčtovat prodej →
          </button>
        )}
      </div>
    </>
  )
}
```

- [ ] **Vytvoř `CajeHome.module.css`**

Přečti `frontend/src/components/pos-mobile/MobileHome.module.css` a zkopíruj obsah beze změny do `CajeHome.module.css`.

- [ ] **Vytvoř `CajeCheckout.tsx`**

```tsx
import type { CajeCartItem } from '../../types'
import styles from './CajeCheckout.module.css'

interface Props {
  cart: CajeCartItem[]
  error: string | null
  loading?: boolean
  onConfirm: () => void
  onBack: () => void
}

export default function CajeCheckout({ cart, error, loading, onConfirm, onBack }: Props) {
  const total = cart.reduce((s, i) => s + i.celkCena, 0)

  return (
    <>
      <div className={styles.scroll}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <ul className={styles.list}>
          {cart.map((item) => (
            <li key={item.localId} className={styles.row}>
              <span className={styles.name}>{item.caj.NAZEV}</span>
              <span className={styles.qty}>×{item.kusu}</span>
              <span className={styles.price}>{item.celkCena} Kč</span>
            </li>
          ))}
        </ul>
        <div className={styles.totalRow}>
          <span>K zaplacení</span>
          <span className={styles.totalAmt}>{total.toLocaleString('cs-CZ')} Kč</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={onBack} disabled={loading}>
          Zpět na košík
        </button>
        <button className={styles.payBtn} onClick={onConfirm} disabled={loading}>
          {loading ? 'Ukládám…' : '✓ Zákazník zaplatil'}
        </button>
      </div>
    </>
  )
}
```

- [ ] **Vytvoř `CajeCheckout.module.css`**

Přečti `frontend/src/components/pos-mobile/MobileCheckout.module.css` a zkopíruj obsah beze změny do `CajeCheckout.module.css`.

---

## Task 10: Komponenty — historie a progress bar

**Files:**
- Create: `frontend/src/components/pos-cajovna/CajeHistory.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeHistory.module.css`
- Create: `frontend/src/components/pos-cajovna/CajeProgressBar.tsx`
- Create: `frontend/src/components/pos-cajovna/CajeProgressBar.module.css`

- [ ] **Vytvoř `CajeHistory.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { getCajovnaProdeje } from '../../api/cajovna'
import type { CajovnaProdej } from '../../types'
import styles from './CajeHistory.module.css'

export default function CajeHistory() {
  const [prodeje, setProdeje] = useState<CajovnaProdej[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    getCajovnaProdeje()
      .then(setProdeje)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  const total = prodeje.reduce((s, p) => s + p.total_kc, 0)
  const count = prodeje.length
  const countLabel = count === 1 ? 'prodej' : count < 5 ? 'prodeje' : 'prodejů'

  if (loading) return <div className={styles.state}>Načítám…</div>
  if (error)   return <div className={styles.state}>Chyba: {error}</div>
  if (count === 0) return <div className={styles.state}>Zatím žádné prodeje.</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        {count} {countLabel} · celkem {total.toLocaleString('cs-CZ')} Kč
      </div>
      <div className={styles.list}>
        {prodeje.map((p) => (
          <div key={p.id} className={styles.sale}>
            <span className={styles.saleTime}>
              {new Date(p.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={styles.saleUser}>{p.username}</span>
            <span className={styles.saleTotal}>{p.total_kc.toLocaleString('cs-CZ')} Kč</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Vytvoř `CajeHistory.module.css`**

Přečti `frontend/src/components/pos-mobile/MobileHistory.module.css` a zkopíruj obsah beze změny do `CajeHistory.module.css`.

- [ ] **Vytvoř `CajeProgressBar.tsx`**

```tsx
import type { CajeView } from '../../hooks/useCajovnaPOS'
import styles from './CajeProgressBar.module.css'

const STEPS: CajeView[] = ['categories', 'teas', 'packaging', 'quantity', 'checkout']

interface Props { view: CajeView }

export default function CajeProgressBar({ view }: Props) {
  const activeIdx = STEPS.indexOf(view)
  if (activeIdx < 0) return null
  return (
    <div className={styles.bar}>
      {STEPS.map((step, i) => (
        <div
          key={step}
          className={`${styles.dot} ${i <= activeIdx ? styles.active : ''}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Vytvoř `CajeProgressBar.module.css`**

Přečti `frontend/src/components/pos-mobile/MobileProgressBar.module.css` a zkopíruj obsah beze změny do `CajeProgressBar.module.css`.

- [ ] **Commitni**

```bash
git add frontend/src/components/pos-cajovna/
git commit -m "feat(cajovna): komponenty CajeCategories, CajeTeas, CajePackaging, CajeQuantity, CajeHome, CajeCheckout, CajeHistory, CajeProgressBar"
```

---

## Task 11: Stránka CajovnaPOS

**Files:**
- Create: `frontend/src/pages/CajovnaPOS.tsx`

- [ ] **Vytvoř `frontend/src/pages/CajovnaPOS.tsx`**

```tsx
import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCajovnaPOS, CAJE_VIEW_ORDER, type CajeView } from '../hooks/useCajovnaPOS'
import { useAuthStore } from '../store/authStore'
import MobileTopBar from '../components/pos-mobile/MobileTopBar'
import MobileHeader from '../components/pos-mobile/MobileHeader'
import MobileSuccess from '../components/pos-mobile/MobileSuccess'
import CajeProgressBar from '../components/pos-cajovna/CajeProgressBar'
import CajeCategories from '../components/pos-cajovna/CajeCategories'
import CajeTeas from '../components/pos-cajovna/CajeTeas'
import CajePackaging from '../components/pos-cajovna/CajePackaging'
import CajeQuantity from '../components/pos-cajovna/CajeQuantity'
import CajeHome from '../components/pos-cajovna/CajeHome'
import CajeCheckout from '../components/pos-cajovna/CajeCheckout'
import CajeHistory from '../components/pos-cajovna/CajeHistory'
import styles from './MobilePOS.module.css'

const VIEW_TITLES: Record<CajeView, string> = {
  home:       'TAO čajovna',
  categories: 'Kategorie',
  teas:       'Vyberte čaj',
  packaging:  'Typ balení',
  quantity:   'Množství',
  checkout:   'Přehled prodeje',
  success:    'Hotovo',
}

export default function CajovnaPOS() {
  const pos      = useCajovnaPOS()
  const [mode, setMode]           = useState<'pos' | 'history'>('pos')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const user     = useAuthStore((s) => s.user)
  const logout   = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const prevViewRef = useRef<CajeView>('home')
  const [slideClass, setSlideClass] = useState('')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const prevIdx = CAJE_VIEW_ORDER.indexOf(prevViewRef.current)
    const newIdx  = CAJE_VIEW_ORDER.indexOf(pos.view)
    if (prevViewRef.current !== pos.view) {
      setSlideClass(newIdx >= prevIdx ? styles.slideFwd : styles.slideBack)
    }
    prevViewRef.current = pos.view
  }, [pos.view])

  async function handleConfirmCheckout() {
    setCheckoutLoading(true)
    await pos.confirmCheckout()
    setCheckoutLoading(false)
  }

  if (pos.loading) return <div className={styles.loading}>Načítám…</div>
  if (pos.error)   return <div className={styles.loading}>Chyba: {pos.error}</div>

  const showBack = pos.view !== 'home' && pos.view !== 'success'
  const categoryName = pos.selectedCategory
    ? `${pos.selectedCategory.kategorie}${pos.selectedCategory.zeme ? ` — ${pos.selectedCategory.zeme}` : ''}`
    : ''

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <MobileTopBar
          mode={mode}
          onModeChange={setMode}
          username={user?.username ?? ''}
          onLogout={handleLogout}
        />

        {mode === 'pos' && (
          <div className={`${styles.view} ${slideClass}`}>
            {pos.view !== 'success' && (
              <MobileHeader
                title={VIEW_TITLES[pos.view]}
                subtitle={pos.view === 'teas' ? categoryName : undefined}
                cartCount={pos.cart.length}
                onBack={showBack ? pos.goBack : undefined}
              />
            )}
            <CajeProgressBar view={pos.view} />

            {pos.view === 'home' && (
              <CajeHome
                cart={pos.cart}
                onAddItem={pos.goToCategories}
                onCheckout={pos.startCheckout}
                onRemove={pos.removeFromCart}
              />
            )}
            {pos.view === 'categories' && (
              <CajeCategories categories={pos.categories} onSelect={pos.selectCategory} />
            )}
            {pos.view === 'teas' && (
              <CajeTeas
                teas={pos.teas}
                categoryName={categoryName}
                onSelect={pos.selectTea}
              />
            )}
            {pos.view === 'packaging' && (
              <CajePackaging
                options={pos.baleniOptions}
                selected={pos.selectedBaleni}
                onSelect={pos.selectBaleni}
              />
            )}
            {pos.view === 'quantity' && pos.selectedBaleni && (
              <CajeQuantity baleni={pos.selectedBaleni} onSelect={pos.selectKusu} />
            )}
            {pos.view === 'checkout' && (
              <CajeCheckout
                cart={pos.cart}
                error={pos.checkoutError}
                loading={checkoutLoading}
                onConfirm={handleConfirmCheckout}
                onBack={pos.goBack}
              />
            )}
            {pos.view === 'success' && (
              <MobileSuccess total={pos.lastTotal} onNewSale={pos.newSale} />
            )}
          </div>
        )}

        {mode === 'history' && <CajeHistory />}
      </div>
    </div>
  )
}
```

> **Poznámka:** `CajovnaPOS.tsx` sdílí `MobilePOS.module.css` pro layout (root, frame, view, slideFwd, slideBack, loading) — ty jsou generické a nemusíme je kopírovat.

---

## Task 12: Router + finální ověření

**Files:**
- Modify: `frontend/src/router/AppRouter.tsx`

- [ ] **Přidej lazy import do `AppRouter.tsx`**

Za řádek `const AdminTeas = lazy(() => import('../pages/admin/Teas'))` přidej:
```tsx
const CajovnaPOS = lazy(() => import('../pages/CajovnaPOS'))
```

- [ ] **Přidej route `/cajovna`**

Za blok route `/pos-desktop`:
```tsx
<Route
  path="/cajovna"
  element={
    <ProtectedRoute requiredRole="prodavacka">
      <CajovnaPOS />
    </ProtectedRoute>
  }
/>
```

- [ ] **TypeScript check — 0 chyb**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Spusť všechny testy — nesmí být regrese**

```bash
cd frontend && npm run test -- --run
```

Očekáváno: všechny existující testy projdou + nové testy z `useCajovnaPOS.test.ts`. Celkový počet testů > 165.

- [ ] **Manuální smoke test**

1. Spusť `npm run dev` ve složce `frontend`
2. Přihlaš se jako prodavacka
3. Naviguj na `http://localhost:5173/cajovna`
4. Projdi celý flow: kategorie → čaj → balení → množství → pokladna → zaplatit
5. Zkontroluj phpMyAdmin: `SELECT * FROM 00_prodej ORDER BY id DESC LIMIT 1` a odpovídající záznamy v `00_prodej_polozky`
6. Zkontroluj záložku Historie — prodej se zobrazí

- [ ] **Commitni**

```bash
git add frontend/src/pages/CajovnaPOS.tsx frontend/src/router/AppRouter.tsx
git commit -m "feat(cajovna): stránka CajovnaPOS + route /cajovna"
```
