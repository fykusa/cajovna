# Storno prodejů — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin může soft-stornovat celý prodej z tabulky `00_prodej`; stornované prodeje se nezapočítávají do tržeb ani do stavu kasy.

**Architecture:** Soft delete přes `cancelled_at DATETIME NULL` na `00_prodej`. Backend přidá `DELETE /api/cajovna/prodej/{id}` (admin only) a vrací `cancelled_at` v listProdeje. Kasa tržby filtrují `AND cancelled_at IS NULL`. Frontend přidá tabulku individuálních prodejů do `admin/Sales.tsx` s tlačítkem Stornovat (confirm dialog); stornované prodeje se zobrazí přeškrtnutě a vyloučí ze statistik.

**Tech Stack:** PHP 8 / MariaDB, React 19 + TypeScript, CSS Modules, Vitest + Testing Library

---

## Soubory

| Soubor | Změna |
|---|---|
| `db/migration_storno.sql` | CREATE — SQL migrace (ALTER TABLE) |
| `backend/api/cajovna.php` | Modify — cancel endpoint, cancelled_at v listProdeje, CORS |
| `backend/api/kasa.php` | Modify — přidat `AND cancelled_at IS NULL` ke dvěma SQL dotazům |
| `frontend/src/types.ts` | Modify — přidat `cancelled_at` do `CajovnaProdej` |
| `frontend/src/api/cajovna.ts` | Modify — přidat `cancelCajovnaSale()` |
| `frontend/src/pages/admin/Sales.tsx` | Modify — tabulka prodejů, storno UI, filtry statistik |
| `frontend/src/pages/admin/Sales.module.css` | Modify — styly stornovaného řádku a badge |
| `frontend/src/pages/admin/Sales.test.tsx` | Modify — testy pro storno |

---

## Task 1: DB migrace

**Files:**
- Create: `db/migration_storno.sql`

- [ ] **Krok 1: Napsat migration SQL**

```sql
-- db/migration_storno.sql
ALTER TABLE `00_prodej`
  ADD COLUMN `cancelled_at` DATETIME NULL DEFAULT NULL,
  ADD COLUMN `cancelled_by` INT NULL DEFAULT NULL;
```

- [ ] **Krok 2: Spustit migraci na lokální DB**

```bash
mysql -u cajovna -p cajovna < db/migration_storno.sql
```

Ověřit: `DESCRIBE 00_prodej;` → vidět sloupce `cancelled_at`, `cancelled_by`.

- [ ] **Krok 3: Commit**

```bash
git add db/migration_storno.sql
git commit -m "feat(storno): db migrace — cancelled_at a cancelled_by na 00_prodej"
```

---

## Task 2: Backend — cancel endpoint a cancelled_at v listProdeje

**Files:**
- Modify: `backend/api/cajovna.php`

- [ ] **Krok 1: Přidat DELETE do CORS headers a do routeru**

Aktuálně na řádku 6:
```
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
```
Změnit na:
```php
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
```

Do routovacího bloku (za existující větve, před `else`), přidat:
```php
} elseif ($method === 'DELETE' && preg_match('#/api/cajovna/prodej/(\d+)$#', $path, $m)) {
    cancelProdej((int) $m[1]);
```

- [ ] **Krok 2: Implementovat funkci `cancelProdej()`**

Přidat na konec souboru (za `listPolozky()`):

```php
function cancelProdej(int $id): void {
    $auth = requireAdmin();
    $pdo  = getPDO();

    $stmt = $pdo->prepare('SELECT id, cancelled_at FROM `00_prodej` WHERE id = ?');
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

    $pdo->prepare('UPDATE `00_prodej` SET cancelled_at = NOW(), cancelled_by = ? WHERE id = ?')
        ->execute([$auth['user_id'], $id]);

    echo json_encode(['ok' => true]);
}
```

Poznámka: `requireAdmin()` je v `backend/middleware.php` — vrací JWT payload nebo ukončí s 403. Nepředává se `$auth` z venku, volá se přímo.

- [ ] **Krok 3: Přidat `cancelled_at` do SELECT v `listProdeje()`**

V `listProdeje()`, SQL (aktuálně řádek 121–125):
```php
    $sql = 'SELECT p.id, p.created_at, p.total_kc, u.username, p.user_id
            FROM `00_prodej` p
            JOIN users u ON u.id = p.user_id'
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY p.created_at DESC LIMIT 500';
```
Změnit SELECT na:
```php
    $sql = 'SELECT p.id, p.created_at, p.total_kc, u.username, p.user_id, p.cancelled_at
            FROM `00_prodej` p
            JOIN users u ON u.id = p.user_id'
         . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY p.created_at DESC LIMIT 500';
```

- [ ] **Krok 4: Manuálně otestovat endpoint**

```bash
# cancel prodeje s id=1 (jako admin)
curl -X DELETE http://localhost/api/cajovna/prodej/1 \
  -H "Authorization: Bearer <admin_token>"
# Očekáváno: {"ok":true}

# druhý pokus — 409
curl -X DELETE http://localhost/api/cajovna/prodej/1 \
  -H "Authorization: Bearer <admin_token>"
# Očekáváno: {"error":"Prodej je již stornován."}

# neexistující id — 404
curl -X DELETE http://localhost/api/cajovna/prodej/99999 \
  -H "Authorization: Bearer <admin_token>"
# Očekáváno: {"error":"Prodej nenalezen."}

# prodavačka (ne admin) — 403
curl -X DELETE http://localhost/api/cajovna/prodej/2 \
  -H "Authorization: Bearer <prodavacka_token>"
# Očekáváno: 403
```

- [ ] **Krok 5: Commit**

```bash
git add backend/api/cajovna.php
git commit -m "feat(storno): backend cancel endpoint DELETE /api/cajovna/prodej/{id}"
```

---

## Task 3: Backend — kasa tržby filtrují stornované prodeje

**Files:**
- Modify: `backend/api/kasa.php`

Jsou dva SQL dotazy na `00_prodej` které počítají tržby. Oba musí přidat podmínku `AND cancelled_at IS NULL`.

- [ ] **Krok 1: Upravit první dotaz (handleStatus, ~řádek 56)**

```php
// PŘED
'SELECT COALESCE(SUM(total_kc), 0) FROM `00_prodej` WHERE DATE(created_at) = ?'
// PO
'SELECT COALESCE(SUM(total_kc), 0) FROM `00_prodej` WHERE DATE(created_at) = ? AND cancelled_at IS NULL'
```

- [ ] **Krok 2: Upravit druhý dotaz (handleClose, ~řádek 176)**

```php
// PŘED
'SELECT COALESCE(SUM(total_kc), 0) FROM `00_prodej` WHERE DATE(created_at) = ?'
// PO
'SELECT COALESCE(SUM(total_kc), 0) FROM `00_prodej` WHERE DATE(created_at) = ? AND cancelled_at IS NULL'
```

Oba dotazy jsou identické — hledej je přes `grep -n "SUM(total_kc)" backend/api/kasa.php`.

- [ ] **Krok 3: Commit**

```bash
git add backend/api/kasa.php
git commit -m "fix(kasa): vyloučit stornované prodeje z výpočtu tržeb"
```

---

## Task 4: Frontend — typy a API funkce

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/cajovna.ts`

- [ ] **Krok 1: Přidat `cancelled_at` do `CajovnaProdej` (types.ts, ~řádek 162)**

```typescript
export interface CajovnaProdej {
  id: number
  created_at: string
  total_kc: number
  username: string
  user_id: number
  cancelled_at: string | null
}
```

- [ ] **Krok 2: Přidat `cancelCajovnaSale()` do `api/cajovna.ts`**

```typescript
export const cancelCajovnaSale = (id: number): Promise<{ ok: boolean }> =>
  apiFetch<{ ok: boolean }>(`/cajovna/prodej/${id}`, { method: 'DELETE' })
```

- [ ] **Krok 3: Spustit testy — ověřit že nic nespadlo**

```bash
cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Očekáváno: Všechny existující testy projdou (mohly selhat kvůli chybějícímu `cancelled_at` v mock datech — to bude opraveno v Task 5).

- [ ] **Krok 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/cajovna.ts
git commit -m "feat(storno): přidat cancelled_at do CajovnaProdej a cancelCajovnaSale API"
```

---

## Task 5: Frontend — Sales UI, testy

**Files:**
- Modify: `frontend/src/pages/admin/Sales.tsx`
- Modify: `frontend/src/pages/admin/Sales.module.css`
- Modify: `frontend/src/pages/admin/Sales.test.tsx`

### 5a: Testy (TDD — napsat dřív)

- [ ] **Krok 1: Aktualizovat test fixtures a mock v `Sales.test.tsx`**

Přidat `cancelled_at: null` ke stávajícím SALES položkám a přidat `cancelCajovnaSale` do vi.mock. Přidat SALES_WITH_CANCELLED pro testy storny.

Celý soubor `Sales.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sales from './Sales'
import { renderWithToast } from '../../test/renderWithToast'
import * as cajovnaApi from '../../api/cajovna'

vi.mock('../../api/cajovna', () => ({
  getCajovnaProdeje: vi.fn(),
  getCajovnaPolozky: vi.fn(),
  createCajovnaSale: vi.fn(),
  cancelCajovnaSale: vi.fn(),
}))

const SALES = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: null },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null },
]

const SALES_WITH_CANCELLED = [
  { id: 1, user_id: 1, username: 'terka', total_kc: 260, created_at: '2026-05-28 10:00:00', cancelled_at: null },
  { id: 2, user_id: 1, username: 'terka', total_kc: 130, created_at: '2026-05-28 11:00:00', cancelled_at: '2026-05-28 13:00:00' },
  { id: 3, user_id: 2, username: 'boss',  total_kc: 500, created_at: '2026-05-28 12:00:00', cancelled_at: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES)
})

describe('Sales', () => {
  it('zobrazí denní pivot s prodavajícími ve sloupcích', async () => {
    renderWithToast(<Sales />)
    const pivot = await screen.findByRole('table', { name: 'Denní tržby přes prodavající' })
    expect(within(pivot).getByRole('columnheader', { name: 'terka' })).toBeInTheDocument()
    expect(within(pivot).getByRole('columnheader', { name: 'boss' })).toBeInTheDocument()
  })

  it('zobrazí měsíční pivot s prodavajícími ve sloupcích', async () => {
    renderWithToast(<Sales />)
    const monthly = await screen.findByRole('table', { name: 'Měsíční tržby přes prodavající' })
    expect(within(monthly).getByRole('columnheader', { name: 'terka' })).toBeInTheDocument()
    expect(within(monthly).getByRole('columnheader', { name: 'boss' })).toBeInTheDocument()
  })

  it('zobrazí souhrnnou tabulku celkových tržeb za prodavajícího', async () => {
    renderWithToast(<Sales />)
    const summary = await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    // terka 260+130 = 390, boss 500
    expect(within(summary).getByText(/390/)).toBeInTheDocument()
    expect(within(summary).getByText(/500/)).toBeInTheDocument()
  })

  it('spočítá celkovou tržbu', async () => {
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    expect(screen.getAllByText('890 Kč').length).toBeGreaterThan(0)
  })

  it('filtruje prodeje po kliku na Zobrazit', async () => {
    const user = userEvent.setup()
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    const fromInput = screen.getByLabelText('od')
    await user.clear(fromInput)
    await user.type(fromInput, '2026-05-28')
    await user.click(screen.getByRole('button', { name: /zobrazit/i }))
    await waitFor(() => expect(vi.mocked(cajovnaApi.getCajovnaProdeje)).toHaveBeenCalledTimes(2))
  })

  it('stornovaný prodej se nezapočítá do statistik', async () => {
    vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES_WITH_CANCELLED)
    renderWithToast(<Sales />)
    // Aktivní: id=1 (260) + id=3 (500) = 760 Kč; id=2 je stornovaný (130) — nesmí být v celkové
    await screen.findByRole('table', { name: 'Celkové tržby za prodavajícího' })
    expect(screen.getAllByText('760 Kč').length).toBeGreaterThan(0)
  })

  it('stornovaný prodej je v tabulce prodejů označen jako STORNO', async () => {
    vi.mocked(cajovnaApi.getCajovnaProdeje).mockResolvedValue(SALES_WITH_CANCELLED)
    renderWithToast(<Sales />)
    const table = await screen.findByRole('table', { name: 'Přehled prodejů' })
    expect(within(table).getByText('STORNO')).toBeInTheDocument()
  })

  it('klik na Stornovat zavolá cancelCajovnaSale a znovu načte data', async () => {
    vi.mocked(cajovnaApi.cancelCajovnaSale).mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderWithToast(<Sales />)
    await screen.findByRole('table', { name: 'Přehled prodejů' })
    const stornoBtn = screen.getAllByRole('button', { name: /stornovat/i })[0]
    await user.click(stornoBtn)
    // confirm dialog
    const confirmBtn = screen.getByRole('button', { name: /potvrdit/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(vi.mocked(cajovnaApi.cancelCajovnaSale)).toHaveBeenCalledWith(expect.any(Number)))
    await waitFor(() => expect(vi.mocked(cajovnaApi.getCajovnaProdeje)).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Krok 2: Spustit testy — ověřit že nové testy selžou (RED)**

```bash
cd frontend && npx vitest run src/pages/admin/Sales.test.tsx --reporter=verbose
```

Očekáváno: nové 3 testy FAIL (stornovaný prodej, STORNO badge, cancelCajovnaSale). Staré testy PASS.

### 5b: Implementace Sales.tsx

- [ ] **Krok 3: Přidat stav pro confirm dialog a filtrování aktivních prodejů**

Na začátek komponenty `Sales()` přidat state pro confirm:
```typescript
const [confirmId, setConfirmId] = useState<number | null>(null)
const [cancelling, setCancelling] = useState(false)
```

Import přidat do hlavičky:
```typescript
import { cancelCajovnaSale } from '../../api/cajovna'
```

- [ ] **Krok 4: Filtrovat stornované prodeje ze statistik**

Za `const [sales, setSales] = ...` přidat:
```typescript
const activeSales = sales.filter((s) => !s.cancelled_at)
```

Nahradit použití `sales` za `activeSales` v výpočtech statistik (ale NE v tabulce prodejů kde chceme vidět i stornované):
```typescript
// PŘED
const total = sales.reduce((s, sale) => s + sale.total_kc, 0)
const perUser: Record<string, number> = {}
sales.forEach((s) => { ... })
const byDay = pivotByKey(sales, ...)
const byMonth = pivotByKey(sales, ...)
const days = Array.from(byDay.keys())...
const months = Array.from(byMonth.keys())...

// PO
const total = activeSales.reduce((s, sale) => s + sale.total_kc, 0)
const perUser: Record<string, number> = {}
activeSales.forEach((s) => { ... })
const byDay = pivotByKey(activeSales, ...)
const byMonth = pivotByKey(activeSales, ...)
const days = Array.from(byDay.keys())...
const months = Array.from(byMonth.keys())...
```

Podmínka pro prázdný stav zůstane `sellers.length === 0` (sellers je z activeSales).

- [ ] **Krok 5: Přidat handler pro storno**

```typescript
async function handleCancel(id: number) {
  setCancelling(true)
  try {
    await cancelCajovnaSale(id)
    setConfirmId(null)
    await load()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Chyba při stornování')
  } finally {
    setCancelling(false)
  }
}
```

- [ ] **Krok 6: Přidat tabulku prodejů do JSX**

Za konec podmínky `sellers.length === 0` (před uzavírající `</>`) přidat:

```tsx
<div style={{ marginTop: 32 }}>
  <h2 className={styles.sectionTitle}>Přehled prodejů</h2>
  <table className={styles.table} aria-label="Přehled prodejů">
    <thead>
      <tr>
        <th>Datum a čas</th>
        <th>Prodavačka</th>
        <th style={{ textAlign: 'right' }}>Částka</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {sales.map((s) => (
        <tr key={s.id} className={s.cancelled_at ? styles.cancelled : undefined}>
          <td className={styles.time}>{s.created_at.slice(0, 16).replace('T', ' ')}</td>
          <td>{s.username}</td>
          <td className={styles.amount}>{fmtKc(s.total_kc)}</td>
          <td>
            {s.cancelled_at ? (
              <span className={styles.stornoBadge}>STORNO</span>
            ) : (
              <button className={styles.stornoBtn} onClick={() => setConfirmId(s.id)}>
                Stornovat
              </button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{confirmId !== null && (
  <div className={styles.confirmOverlay}>
    <div className={styles.confirmBox}>
      <p>Opravdu stornovat prodej #{confirmId}? Tato akce je nevratná.</p>
      <div className={styles.confirmActions}>
        <button className={styles.confirmBtn} disabled={cancelling} onClick={() => handleCancel(confirmId)}>
          {cancelling ? 'Stornuji…' : 'Potvrdit'}
        </button>
        <button className={styles.confirmCancelBtn} disabled={cancelling} onClick={() => setConfirmId(null)}>
          Zrušit
        </button>
      </div>
    </div>
  </div>
)}
```

Přidat `useState` do importu (pokud chybí).

### 5c: Styly

- [ ] **Krok 7: Přidat styly do `Sales.module.css`**

```css
/* Storno */
.cancelled td { opacity: 0.45; text-decoration: line-through; }

.stornoBadge {
  display: inline-block;
  padding: 2px 8px;
  background: #4a2020;
  color: #f87171;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.stornoBtn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #555;
  border-radius: 4px;
  color: #aaa;
  cursor: pointer;
  font-size: 0.8rem;
}
.stornoBtn:hover { border-color: #f87171; color: #f87171; }

/* Confirm overlay */
.confirmOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.confirmBox {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 24px 28px;
  max-width: 360px;
  color: #eee;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirmActions {
  display: flex;
  gap: 10px;
}

.confirmBtn {
  padding: 8px 20px;
  background: #c0392b;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}
.confirmBtn:hover:not(:disabled) { background: #d9534f; }
.confirmBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.confirmCancelBtn {
  padding: 8px 16px;
  background: #444;
  color: #eee;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

### 5d: Finalizace

- [ ] **Krok 8: Spustit testy — všechny musí PASS**

```bash
cd frontend && npx vitest run src/pages/admin/Sales.test.tsx --reporter=verbose
```

Očekáváno: všech 8 testů PASS.

- [ ] **Krok 9: Spustit celou test suite**

```bash
cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Očekáváno: všechny testy PASS (žádná regrese).

- [ ] **Krok 10: Commit**

```bash
git add frontend/src/pages/admin/Sales.tsx frontend/src/pages/admin/Sales.module.css frontend/src/pages/admin/Sales.test.tsx
git commit -m "feat(storno): tabulka prodejů s možností storna v admin/Sales"
```

---

## Self-Review

**Spec coverage:**
- ✅ DB: `cancelled_at DATETIME NULL` na `00_prodej` (Task 1)
- ✅ Backend cancel endpoint, admin-only (Task 2)
- ✅ Stornované prodeje vyloučeny z tržeb kasy (Task 3)
- ✅ Stornované prodeje vyloučeny ze statistik Sales (Task 5, activeSales)
- ✅ UI: tabulka prodejů s tlačítkem Stornovat a confirm dialogem (Task 5)
- ✅ Stornované prodeje zobrazeny přeškrtnutě + badge STORNO (Task 5)
- ✅ Storno celého prodeje (jen celý prodej, ne položky — dle rozhodnutí)
- ✅ Jen Cajovna POS (`00_prodej`), Desktop POS (`sales`) nedotčen

**Placeholder scan:** Žádné TBD ani "add validation" bez kódu. Všechny kroky mají konkrétní kód.

**Type consistency:** `cancelled_at: string | null` v types.ts → konzistentní v Sales.tsx `s.cancelled_at`, `!s.cancelled_at`, `SALES_WITH_CANCELLED`.
