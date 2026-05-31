# Editace kategorií a pytlíků — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat plnou správu (edit + přidání + mazání) kategorií čajů a pytlíků ve stylu existující inline-editovatelné tabulky čajů, se sdílenou komponentou `EditableGrid`.

**Architecture:** Vytáhnout keyboard-edit engine z `Items.tsx` do znovupoužitelné komponenty `EditableGrid<T>` řízené konfigurací sloupců. `Items` se na ni přepne (beze změny chování). Přidat backend CRUD endpointy (`categories.php`, rozšířený `bags.php`) a frontend stránky `Categories.tsx` (nová) a přepsaný `Bags.tsx`.

**Tech Stack:** React 19 + TypeScript + Vite, zustand, react-router; backend PHP 7.4 + MySQL (PDO); testy vitest + @testing-library/react. Mock pattern: statický import + `vi.mock` (viz `Products.test.tsx`).

**Spec:** `docs/superpowers/specs/2026-06-01-edit-kategorie-pytliky-design.md`

---

## File Structure

**Nové soubory:**
- `frontend/src/components/admin/EditableGrid.tsx` — sdílený inline-edit grid (engine).
- `frontend/src/components/admin/EditableGrid.module.css` — styly gridu (table/cell/editor).
- `frontend/src/components/admin/EditableGrid.test.tsx` — testy gridu.
- `frontend/src/api/categories.ts` — CRUD API pro kategorie.
- `frontend/src/pages/admin/Categories.tsx` — stránka kategorií.
- `frontend/src/pages/admin/Categories.module.css` — styly stránky.
- `frontend/src/pages/admin/Categories.test.tsx` — testy stránky.
- `frontend/src/pages/admin/Bags.test.tsx` — testy přepsané stránky pytlíků.
- `backend/api/categories.php` — CRUD endpointy kategorií.

**Modifikované soubory:**
- `frontend/src/pages/admin/Items.tsx` — refactor na `EditableGrid`.
- `frontend/src/pages/admin/Items.module.css` — odstranit styly přesunuté do gridu.
- `frontend/src/pages/admin/Items.test.tsx` — případně upravit selektory.
- `frontend/src/api/bags.ts` — přidat create/update/delete.
- `frontend/src/pages/admin/Bags.tsx` — přepsat na `EditableGrid`.
- `frontend/src/pages/admin/Bags.module.css` — styly stránky (page/header/addBtn/deleteBtn).
- `frontend/src/router/AppRouter.tsx` — přidat route `/admin/categories`.
- `frontend/src/components/admin/AdminLayout.tsx` — přidat nav „Kategorie".
- `backend/.htaccess` — přidat rewrite pro `categories`.
- `backend/api/bags.php` — přidat POST/PUT/DELETE.

**Konvence příkazů:** Všechny `npm`/`npx` příkazy se spouští z adresáře `frontend/`. Testy spouštět **lokálním** vitestem přes `npm run test` (NE `npx vitest` — cache bez jsdom).

---

# FÁZE 1 — EditableGrid + refactor Items

## Task 1: Vytvořit `EditableGrid.module.css`

**Files:**
- Create: `frontend/src/components/admin/EditableGrid.module.css`

- [ ] **Step 1: Vytvořit soubor se styly gridu**

Tyto styly jsou přesunuté 1:1 z `Items.module.css` (table, cell, cellSelected, cellEditing, actionCell) — sjednocené vizuální chování.

```css
.grid {
  outline: none;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table thead {
  position: sticky;
  top: 0;
  background: #1a1a1a;
}

.table th {
  padding: 6px 10px;
  text-align: left;
  color: #ccc;
  border-bottom: 1px solid #333;
  font-weight: 600;
  white-space: nowrap;
  font-size: 0.85rem;
}

.table td {
  padding: 1px 10px;
  border-bottom: 1px solid #2a2a2a;
  color: #ccc;
  background: #222;
  line-height: 1.3;
}

.cell {
  cursor: pointer;
  position: relative;
  user-select: none;
}

.cellSelected {
  background: #333 !important;
  color: #a8e6a1;
  outline: 1px solid #d4a84b;
  outline-offset: -1px;
}

.cellEditing {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 1px 6px;
  background: #333;
  border: 1px solid #555;
  color: #fff;
  font-family: inherit;
  font-size: inherit;
}

.cellEditing:focus {
  outline: none;
  border-color: #666;
}

.actionCell {
  padding: 1px 8px;
  text-align: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/admin/EditableGrid.module.css
git commit -m "feat(admin): Add EditableGrid styles"
```

---

## Task 2: Vytvořit `EditableGrid.tsx`

**Files:**
- Create: `frontend/src/components/admin/EditableGrid.tsx`

- [ ] **Step 1: Vytvořit komponentu**

Pozn. k logice:
- `handleKeyDown` má `if (!selectedCell || editingCell) return` — během editace navigace neběží (zachovává fix z minula: šipky propadnou na input, nepřeskakují buňky).
- `closingRef` brání dvojímu uložení: po Enter se nastaví, takže následný `onBlur` (z odmountování inputu) save přeskočí. `cancelEdit` (Escape) zavře bez uložení.
- `editStartValue` formátuje číslo přes `parseFloat` (edituje se „30", ne „30.0"); pro select vrací surovou hodnotu (id), ne label.

```tsx
import { useState, useRef, useEffect } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import styles from './EditableGrid.module.css'

export interface ColDef<T> {
  key: keyof T & string
  label: string
  type: 'readonly' | 'text' | 'number' | 'select'
  options?: { value: string; label: string }[]
  render?: (row: T) => string
}

interface EditableGridProps<T> {
  columns: ColDef<T>[]
  rows: T[]
  getRowId: (row: T) => number
  onSaveCell: (row: T, col: ColDef<T>, value: string) => Promise<void>
  renderRowActions?: (row: T) => ReactNode
  rowClassName?: (row: T) => string
}

export default function EditableGrid<T>({
  columns,
  rows,
  getRowId,
  onSaveCell,
  renderRowActions,
  rowClassName,
}: EditableGridProps<T>) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  useEffect(() => {
    if (rows.length > 0 && !selectedCell) {
      setSelectedCell({ row: 0, col: 0 })
      setTimeout(() => gridRef.current?.focus(), 0)
    }
  }, [rows.length, selectedCell])

  const cellDisplay = (row: T, col: ColDef<T>): string => {
    if (col.render) return col.render(row)
    const val = row[col.key]
    if (val === null || val === undefined) return ''
    if (col.type === 'number') {
      const n = parseFloat(String(val))
      return Number.isNaN(n) ? '' : String(n)
    }
    if (col.type === 'select' && col.options) {
      return col.options.find((o) => o.value === String(val))?.label ?? String(val)
    }
    return String(val)
  }

  const editStartValue = (row: T, col: ColDef<T>): string => {
    const val = row[col.key]
    if (val === null || val === undefined) return ''
    if (col.type === 'number') {
      const n = parseFloat(String(val))
      return Number.isNaN(n) ? '' : String(n)
    }
    return String(val)
  }

  const focusGrid = () => setTimeout(() => gridRef.current?.focus(), 0)

  async function closeAndSave(row: T, col: ColDef<T>) {
    if (closingRef.current) return
    closingRef.current = true
    setEditingCell(null)
    try {
      await onSaveCell(row, col, editValue)
    } finally {
      closingRef.current = false
      focusGrid()
    }
  }

  function cancelEdit() {
    closingRef.current = true
    setEditingCell(null)
    setTimeout(() => {
      closingRef.current = false
      gridRef.current?.focus()
    }, 0)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!selectedCell || editingCell) return
    const { row, col } = selectedCell
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row > 0) setSelectedCell({ row: row - 1, col })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row < rows.length - 1) setSelectedCell({ row: row + 1, col })
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (col > 0) setSelectedCell({ row, col: col - 1 })
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (col < columns.length - 1) setSelectedCell({ row, col: col + 1 })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const colDef = columns[col]
      if (colDef.type !== 'readonly') {
        setEditingCell({ row, col })
        setEditValue(editStartValue(rows[row], colDef))
      }
    }
  }

  function handleEditorKeyDown(e: KeyboardEvent, row: T, col: ColDef<T>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      closeAndSave(row, col)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div ref={gridRef} className={styles.grid} tabIndex={0} onKeyDown={handleKeyDown}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((c, ci) => (
              <th key={ci}>{c.label}</th>
            ))}
            {renderRowActions && <th>Akce</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={getRowId(row)} className={rowClassName ? rowClassName(row) : ''}>
              {columns.map((col, ci) => {
                const isSelected = selectedCell?.row === ri && selectedCell?.col === ci
                const isEditing = editingCell?.row === ri && editingCell?.col === ci
                return (
                  <td
                    key={ci}
                    className={`${styles.cell} ${isSelected && !isEditing ? styles.cellSelected : ''}`}
                    onClick={() => setSelectedCell({ row: ri, col: ci })}
                  >
                    {isEditing ? (
                      col.type === 'select' ? (
                        <select
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => closeAndSave(row, col)}
                          onKeyDown={(e) => handleEditorKeyDown(e, row, col)}
                          className={styles.cellEditing}
                        >
                          <option value="">(prázdné)</option>
                          {(col.options ?? []).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          type="text"
                          inputMode={col.type === 'number' ? 'decimal' : undefined}
                          size={1}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => closeAndSave(row, col)}
                          onKeyDown={(e) => handleEditorKeyDown(e, row, col)}
                          className={styles.cellEditing}
                        />
                      )
                    ) : (
                      cellDisplay(row, col)
                    )}
                  </td>
                )
              })}
              {renderRowActions && <td className={styles.actionCell}>{renderRowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb (žádný výstup).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/EditableGrid.tsx
git commit -m "feat(admin): Add reusable EditableGrid component"
```

---

## Task 3: Testy `EditableGrid`

**Files:**
- Create: `frontend/src/components/admin/EditableGrid.test.tsx`

- [ ] **Step 1: Napsat testy**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableGrid, { type ColDef } from './EditableGrid'

interface Row {
  id: number
  name: string
  qty: number
}

const COLUMNS: ColDef<Row>[] = [
  { key: 'id', label: 'ID', type: 'readonly' },
  { key: 'name', label: 'Název', type: 'text' },
  { key: 'qty', label: 'Počet', type: 'number' },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alfa', qty: 30 },
  { id: 2, name: 'Beta', qty: 5 },
]

function setup(onSaveCell = vi.fn().mockResolvedValue(undefined)) {
  render(
    <EditableGrid<Row>
      columns={COLUMNS}
      rows={ROWS}
      getRowId={(r) => r.id}
      onSaveCell={onSaveCell}
    />
  )
  return { onSaveCell }
}

describe('EditableGrid', () => {
  it('zobrazí čísla bez zbytečných desetinných nul', () => {
    setup()
    // qty 30 se zobrazí jako "30", ne "30.0"
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('Enter vstoupí do editace, šipky během editace nepřesouvají výběr', async () => {
    const user = userEvent.setup()
    setup()
    const nameCell = screen.getByText('Alfa')
    await user.click(nameCell)
    await user.keyboard('{Enter}')

    const input = screen.getByDisplayValue('Alfa')
    const belowCell = screen.getByText('Beta').closest('td')!

    await user.keyboard('{ArrowDown}')
    expect(belowCell.className).not.toContain('cellSelected')
    expect(screen.getByDisplayValue('Alfa')).toBe(input)
  })

  it('uložení přes Enter zavolá onSaveCell se správnými argumenty', async () => {
    const onSaveCell = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    setup(onSaveCell)
    await user.click(screen.getByText('Alfa'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('Alfa')
    await user.clear(input)
    await user.type(input, 'Gama')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(onSaveCell).toHaveBeenCalledWith(
        ROWS[0],
        expect.objectContaining({ key: 'name' }),
        'Gama'
      )
    )
  })

  it('renderRowActions vykreslí akční sloupec', () => {
    render(
      <EditableGrid<Row>
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        onSaveCell={vi.fn().mockResolvedValue(undefined)}
        renderRowActions={(r) => <button>smazat {r.id}</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'smazat 1' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Akce' })).toBeInTheDocument()
  })

  it('readonly sloupec nelze editovat (Enter neotevře input)', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('1')) // ID buňka, readonly
    await user.keyboard('{Enter}')
    // žádný input se neobjeví
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Spustit testy**

Run (z `frontend/`): `npm run test -- src/components/admin/EditableGrid.test.tsx`
Expected: PASS (5 testů).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/EditableGrid.test.tsx
git commit -m "test(admin): Add EditableGrid tests"
```

---

## Task 4: Refactor `Items.tsx` na `EditableGrid`

**Files:**
- Modify: `frontend/src/pages/admin/Items.tsx` (celý přepis)
- Modify: `frontend/src/pages/admin/Items.module.css` (odstranit přesunuté styly)
- Modify: `frontend/src/pages/admin/Items.test.tsx` (případně)

- [ ] **Step 1: Přepsat `Items.tsx`**

Celý nový obsah:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { getProducts, getCategories, updateProduct } from '../../api/products'
import { updateStock } from '../../api/stock'
import type { Tea, Category } from '../../types'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import styles from './Items.module.css'

const FLAG_OPTIONS = ['active', 'discontinued', 'no_insert', 'eshop_only', 'trial'].map((f) => ({
  value: f,
  label: f,
}))

export default function AdminItems() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [allTeas, cats] = await Promise.all([getProducts(), getCategories()])
      setTeas(allTeas)
      setCategories(cats)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleTeas = (showInactive
    ? teas.filter((t) => t.flag !== 'active')
    : teas.filter((t) => t.flag === 'active')
  ).filter((t) => categoryFilter === null || t.category_id === categoryFilter)

  const getCategoryName = (catId: number) =>
    categories.find((c) => c.id === catId)?.name || `[${catId}]`

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }))

  const columns: ColDef<Tea>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    {
      key: 'category_id',
      label: 'Kategorie',
      type: 'select',
      options: categoryOptions,
      render: (t) => getCategoryName(t.category_id),
    },
    { key: 'name', label: 'Název', type: 'text' },
    { key: 'flag', label: 'Status', type: 'select', options: FLAG_OPTIONS },
    { key: 'origin', label: 'Původ', type: 'text' },
    { key: 'note', label: 'Poznámka', type: 'text' },
    { key: 'std_weight_g', label: 'Std g', type: 'number' },
    { key: 'std_price_moc', label: 'Std Kč', type: 'number' },
    { key: 'pkg1_weight_g', label: 'Bal1 g', type: 'number' },
    { key: 'pkg1_price_moc', label: 'Bal1 Kč', type: 'number' },
    { key: 'pkg2_weight_g', label: 'Bal2 g', type: 'number' },
    { key: 'pkg2_price_moc', label: 'Bal2 Kč', type: 'number' },
    { key: 'stock_std_pcs', label: 'Sklad std', type: 'number' },
    { key: 'stock_pkg1_pcs', label: 'Sklad bal1', type: 'number' },
    { key: 'stock_pkg2_pcs', label: 'Sklad bal2', type: 'number' },
    { key: 'stock_kg', label: 'Sklad kg', type: 'number' },
  ]

  async function handleSaveCell(tea: Tea, col: ColDef<Tea>, value: string) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = value
      if (col.type === 'number') parsed = value === '' ? null : parseFloat(value)
      if (col.key === 'category_id') parsed = parseInt(value)

      if (col.key.startsWith('stock_')) {
        const updated = await updateStock(tea.id, { [col.key]: parsed })
        setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      } else {
        const updated = await updateProduct(tea.id, { [col.key]: parsed })
        setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      }
      setError(null)
      setSuccess('Záznam uložen')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(tea: Tea) {
    setSaving(true)
    try {
      const newFlag = tea.flag === 'active' ? 'discontinued' : 'active'
      const updated = await updateProduct(tea.id, { flag: newFlag })
      setTeas((prev) => prev.map((t) => (t.id === tea.id ? updated : t)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Položky</h1>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Zobrazit neaktivní
        </label>
      </div>

      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Kategorie</label>
        <div className={styles.filterGrid}>
          {categories
            .filter((c) => !c.parent_id)
            .map((cat) => (
              <button
                key={cat.id}
                className={`${styles.filterBtn}${categoryFilter === cat.id ? ' ' + styles.filterActive : ''}`}
                onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
              >
                <span className={styles.filterId}>{String(cat.id).padStart(2, '0')}</span>{' '}
                {cat.name}
              </button>
            ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      <div className={styles.tableWrapper}>
        <EditableGrid<Tea>
          columns={columns}
          rows={visibleTeas}
          getRowId={(t) => t.id}
          onSaveCell={handleSaveCell}
          rowClassName={(t) => (t.flag !== 'active' ? styles.rowInactive : '')}
          renderRowActions={(tea) => (
            <button
              className={`${styles.actionBtn} ${
                tea.flag === 'active' ? styles.actionDeactivate : styles.actionActivate
              }`}
              onClick={() => handleToggleActive(tea)}
              disabled={saving}
            >
              {tea.flag === 'active' ? 'deaktivovat' : 'aktivovat'}
            </button>
          )}
        />
      </div>

      {visibleTeas.length === 0 && !loading && (
        <p className={styles.empty}>
          {showInactive ? 'Žádné neaktivní položky.' : 'Žádné aktivní položky.'}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Odstranit přesunuté styly z `Items.module.css`**

Smazat tyto bloky z `Items.module.css` (přesunuly se do `EditableGrid.module.css`): `.table`, `.table thead`, `.table th`, `.table td`, `.cell`, `.cellSelected`, `.cellEditing`, `.cellEditing:focus`, `.actionCell`.

**Ponechat** v `Items.module.css`: `.page`, `.header`, `.title`, `.toggle`, `.toggle input`, `.filterSection`, `.filterLabel`, `.filterGrid`, `.filterBtn`, `.filterId`, `.filterBtn:hover`, `.filterActive` (a varianty), `.tableWrapper`, `.rowInactive`, `.actionBtn`, `.actionDeactivate`, `.actionActivate` (a hover/disabled), `.loading`, `.empty`, `.error`, `.success`.

Pozn.: `.page` má `outline: none;` — ponechat. `.tableWrapper` zůstává jako scroll kontejner kolem gridu.

- [ ] **Step 3: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb.

- [ ] **Step 4: Spustit Items testy**

Run (z `frontend/`): `npm run test -- src/pages/admin/Items.test.tsx`
Expected: PASS (2 testy). Pokud selže selektor (např. hledání `cellSelected` třídy), uprav v `Items.test.tsx` jen selektory — aserce chování (výběr nepřeskočí, deaktivace volá updateProduct) musí zůstat. Třída `cellSelected` je nyní z `EditableGrid.module.css`, ale `className.toContain('cellSelected')` funguje dál (scoped název obsahuje původní řetězec).

- [ ] **Step 5: Spustit celou suite**

Run (z `frontend/`): `npm run test`
Expected: PASS (všechny testy včetně nových EditableGrid).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Items.tsx frontend/src/pages/admin/Items.module.css frontend/src/pages/admin/Items.test.tsx
git commit -m "refactor(admin/items): Use shared EditableGrid component"
```

---

# FÁZE 2 — Kategorie

## Task 5: Backend `categories.php` + `.htaccess`

**Files:**
- Create: `backend/api/categories.php`
- Modify: `backend/.htaccess`

- [ ] **Step 1: Vytvořit `backend/api/categories.php`**

Modelováno dle `products.php` (allow-list, FK guard) a `stock.php`.

```php
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

requireAuth();

if ($method === 'GET' && preg_match('#/api/categories$#', $path)) {
    listCategories();
} elseif ($method === 'GET' && preg_match('#/api/categories/(\d+)$#', $path, $m)) {
    getCategory((int) $m[1]);
} elseif ($method === 'POST' && preg_match('#/api/categories$#', $path)) {
    requireAdmin();
    createCategory();
} elseif ($method === 'PUT' && preg_match('#/api/categories/(\d+)$#', $path, $m)) {
    requireAdmin();
    updateCategory((int) $m[1]);
} elseif ($method === 'DELETE' && preg_match('#/api/categories/(\d+)$#', $path, $m)) {
    requireAdmin();
    deleteCategory((int) $m[1]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function listCategories(): void {
    $rows = getPDO()
        ->query('SELECT id, name, parent_id, sort_order FROM tea_categories ORDER BY sort_order, name')
        ->fetchAll();
    echo json_encode($rows);
}

function getCategory(int $id): void {
    $stmt = getPDO()->prepare('SELECT id, name, parent_id, sort_order FROM tea_categories WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Kategorie nenalezena']);
        return;
    }
    echo json_encode($row);
}

function createCategory(): void {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo  = getPDO();
    $stmt = $pdo->prepare('INSERT INTO tea_categories (name, parent_id, sort_order) VALUES (?, ?, ?)');
    $stmt->execute([
        $data['name'] ?? 'Nová kategorie',
        $data['parent_id'] ?? null,
        $data['sort_order'] ?? 0,
    ]);
    $id   = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT id, name, parent_id, sort_order FROM tea_categories WHERE id = ?');
    $stmt->execute([$id]);
    http_response_code(201);
    echo json_encode($stmt->fetch());
}

function updateCategory(int $id): void {
    $data    = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo     = getPDO();
    $allowed = ['name', 'parent_id', 'sort_order'];
    $fields  = [];
    $params  = [];
    foreach ($allowed as $col) {
        if (array_key_exists($col, $data)) {
            $fields[] = "`$col` = ?";
            $params[]  = $data[$col];
        }
    }
    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'Žádná platná pole k aktualizaci']);
        return;
    }
    $params[] = $id;
    $pdo->prepare('UPDATE tea_categories SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    $stmt = $pdo->prepare('SELECT id, name, parent_id, sort_order FROM tea_categories WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Kategorie nenalezena']);
        return;
    }
    echo json_encode($row);
}

function deleteCategory(int $id): void {
    $pdo = getPDO();
    try {
        $pdo->prepare('DELETE FROM tea_categories WHERE id = ?')->execute([$id]);
        http_response_code(204);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Kategorie je použita u čajů, nelze smazat.']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Chyba při mazání']);
        }
    }
}
```

- [ ] **Step 2: Přidat rewrite do `backend/.htaccess`**

Přidat řádek za pravidlo pro `products` (řádek 9):

```apache
RewriteRule ^api/categories(/.*)?$ api/categories.php [QSA,L]
```

Výsledná sekce routování:

```apache
RewriteRule ^api/auth(/.*)?$     api/auth.php       [QSA,L]
RewriteRule ^api/users(/.*)?$    api/users.php      [QSA,L]
RewriteRule ^api/categories(/.*)?$ api/categories.php [QSA,L]
RewriteRule ^api/products(/.*)?$ api/products.php   [QSA,L]
RewriteRule ^api/bags(/.*)?$     api/bags.php       [QSA,L]
RewriteRule ^api/sales(/.*)?$    api/sales.php      [QSA,L]
RewriteRule ^api/stock(/.*)?$    api/stock.php      [QSA,L]
```

- [ ] **Step 3: Ručně ověřit endpoint (běžící backend)**

Spustit backend (`docker compose up -d`), získat token přihlášením a ověřit:

Run:
```bash
curl -s -X GET http://localhost:8080/api/categories -H "Authorization: Bearer <TOKEN>" | head
```
Expected: JSON pole kategorií (200).

Pozn.: Pokud `<TOKEN>` nemáš po ruce, lze ověřit po dokončení Fáze 2 přímo v UI.

- [ ] **Step 4: Commit**

```bash
git add backend/api/categories.php backend/.htaccess
git commit -m "feat(backend): Add categories CRUD endpoints"
```

---

## Task 6: Frontend API `categories.ts`

**Files:**
- Create: `frontend/src/api/categories.ts`

- [ ] **Step 1: Vytvořit modul**

Pozn.: `parent_id` se posílá jako `number | null`; parsování na int řeší stránka před voláním.

```ts
// frontend/src/api/categories.ts
import { apiFetch } from './client'
import type { Category } from '../types'

export const getCategories = (): Promise<Category[]> => apiFetch<Category[]>('/categories')

export const createCategory = (data: Partial<Category>): Promise<Category> =>
  apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(data) })

export const updateCategory = (id: number, data: Partial<Category>): Promise<Category> =>
  apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteCategory = (id: number): Promise<void> =>
  apiFetch<void>(`/categories/${id}`, { method: 'DELETE' })
```

- [ ] **Step 2: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/categories.ts
git commit -m "feat(api): Add categories CRUD client"
```

---

## Task 7: Stránka `Categories.tsx` + route + nav

**Files:**
- Create: `frontend/src/pages/admin/Categories.tsx`
- Create: `frontend/src/pages/admin/Categories.module.css`
- Modify: `frontend/src/router/AppRouter.tsx`
- Modify: `frontend/src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Vytvořit `Categories.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.title {
  color: #d4a84b;
  margin: 0;
  font-size: 1.4rem;
}

.addBtn {
  padding: 4px 12px;
  background: #1e2a1e;
  border: 1px solid #6abf69;
  color: #6abf69;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.addBtn:hover:not(:disabled) {
  background: #243324;
}

.addBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tableWrapper {
  flex: 1;
  overflow: auto;
  border-radius: 8px;
  background: #222;
}

.deleteBtn {
  padding: 0;
  background: none;
  border: none;
  color: #b06a6a;
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.deleteBtn:hover:not(:disabled) {
  color: #c98686;
}

.deleteBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  color: #666;
  font-style: italic;
  padding: 24px;
}

.error {
  color: #ff6b6b;
  padding: 12px;
  background: #3a1a1a;
  border-radius: 6px;
  border-left: 3px solid #ff6b6b;
}
```

- [ ] **Step 2: Vytvořit `Categories.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react'
import type { Category } from '../../types'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api/categories'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import styles from './Categories.module.css'

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await getCategories())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getCatName = (id: number | null) =>
    id === null ? '(žádná)' : categories.find((c) => c.id === id)?.name ?? `[${id}]`

  const parentOptions = categories.map((c) => ({ value: String(c.id), label: c.name }))

  const columns: ColDef<Category>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    { key: 'name', label: 'Název', type: 'text' },
    {
      key: 'parent_id',
      label: 'Nadřazená',
      type: 'select',
      options: parentOptions,
      render: (c) => getCatName(c.parent_id),
    },
    { key: 'sort_order', label: 'Pořadí', type: 'number' },
  ]

  async function handleSaveCell(cat: Category, col: ColDef<Category>, value: string) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = value
      if (col.type === 'number') parsed = value === '' ? 0 : parseInt(value)
      if (col.key === 'parent_id') parsed = value === '' ? null : parseInt(value)
      const updated = await updateCategory(cat.id, { [col.key]: parsed })
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await createCategory({ name: 'Nová kategorie', parent_id: null, sort_order: 0 })
      setCategories((prev) => [...prev, created])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    setSaving(true)
    try {
      await deleteCategory(cat.id)
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba mazání')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Kategorie</h1>
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          + Přidat
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrapper}>
        <EditableGrid<Category>
          columns={columns}
          rows={categories}
          getRowId={(c) => c.id}
          onSaveCell={handleSaveCell}
          renderRowActions={(cat) => (
            <button className={styles.deleteBtn} onClick={() => handleDelete(cat)} disabled={saving}>
              smazat
            </button>
          )}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Přidat route do `AppRouter.tsx`**

Přidat lazy import (za řádek `const AdminItems = ...`):

```tsx
const AdminCategories = lazy(() => import('../pages/admin/Categories'))
```

Přidat route uvnitř `/admin` (za `<Route path="products" ... />`):

```tsx
<Route path="categories" element={<AdminCategories />} />
```

- [ ] **Step 4: Přidat nav prvek do `AdminLayout.tsx`**

V poli `NAV_ITEMS` přidat za „Čaje":

```tsx
{ to: '/admin/categories', label: 'Kategorie', end: false },
```

- [ ] **Step 5: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/Categories.tsx frontend/src/pages/admin/Categories.module.css frontend/src/router/AppRouter.tsx frontend/src/components/admin/AdminLayout.tsx
git commit -m "feat(admin): Add Categories page with route and nav"
```

---

## Task 8: Testy `Categories.tsx`

**Files:**
- Create: `frontend/src/pages/admin/Categories.test.tsx`

- [ ] **Step 1: Napsat testy**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Categories from './Categories'
import * as categoriesApi from '../../api/categories'
import type { Category } from '../../types'

vi.mock('../../api/categories', () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const CATS: Category[] = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  { id: 2, name: 'Zelené', parent_id: null, sort_order: 2 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(categoriesApi.getCategories).mockResolvedValue(CATS)
})

describe('Categories', () => {
  it('zobrazí seznam kategorií', async () => {
    render(<Categories />)
    expect(await screen.findByText('Bílé')).toBeInTheDocument()
    expect(screen.getByText('Zelené')).toBeInTheDocument()
  })

  it('přidání zavolá createCategory a připne řádek', async () => {
    vi.mocked(categoriesApi.createCategory).mockResolvedValue({
      id: 3,
      name: 'Nová kategorie',
      parent_id: null,
      sort_order: 0,
    })
    const user = userEvent.setup()
    render(<Categories />)
    await screen.findByText('Bílé')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    await waitFor(() =>
      expect(categoriesApi.createCategory).toHaveBeenCalledWith({
        name: 'Nová kategorie',
        parent_id: null,
        sort_order: 0,
      })
    )
    expect(await screen.findByText('Nová kategorie')).toBeInTheDocument()
  })

  it('editace názvu zavolá updateCategory', async () => {
    vi.mocked(categoriesApi.updateCategory).mockResolvedValue({
      id: 1,
      name: 'Bílé čaje',
      parent_id: null,
      sort_order: 1,
    })
    const user = userEvent.setup()
    render(<Categories />)
    await screen.findByText('Bílé')
    await user.click(screen.getByText('Bílé'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('Bílé')
    await user.clear(input)
    await user.type(input, 'Bílé čaje')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(categoriesApi.updateCategory).toHaveBeenCalledWith(1, { name: 'Bílé čaje' })
    )
  })

  it('smazání zavolá deleteCategory a odebere řádek', async () => {
    vi.mocked(categoriesApi.deleteCategory).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Categories />)
    await screen.findByText('Bílé')
    const deleteButtons = screen.getAllByRole('button', { name: 'smazat' })
    await user.click(deleteButtons[0])
    await waitFor(() => expect(categoriesApi.deleteCategory).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Bílé')).not.toBeInTheDocument())
  })

  it('409 při mazání zobrazí chybu', async () => {
    const { ApiError } = await import('../../api/client')
    vi.mocked(categoriesApi.deleteCategory).mockRejectedValue(
      new ApiError(409, 'Kategorie je použita u čajů, nelze smazat.')
    )
    const user = userEvent.setup()
    render(<Categories />)
    await screen.findByText('Bílé')
    await user.click(screen.getAllByRole('button', { name: 'smazat' })[0])
    expect(await screen.findByText(/použita u čajů/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Spustit testy**

Run (z `frontend/`): `npm run test -- src/pages/admin/Categories.test.tsx`
Expected: PASS (5 testů).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/Categories.test.tsx
git commit -m "test(admin): Add Categories page tests"
```

---

# FÁZE 3 — Pytlíky

## Task 9: Backend — rozšířit `bags.php`

**Files:**
- Modify: `backend/api/bags.php`

- [ ] **Step 1: Přepsat `bags.php` na plné CRUD**

Celý nový obsah:

```php
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

requireAuth();

if ($method === 'GET' && preg_match('#/api/bags$#', $path)) {
    listBags();
} elseif ($method === 'POST' && preg_match('#/api/bags$#', $path)) {
    requireAdmin();
    createBag();
} elseif ($method === 'PUT' && preg_match('#/api/bags/(\d+)$#', $path, $m)) {
    requireAdmin();
    updateBag((int) $m[1]);
} elseif ($method === 'DELETE' && preg_match('#/api/bags/(\d+)$#', $path, $m)) {
    requireAdmin();
    deleteBag((int) $m[1]);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}

function bagColumns(): string {
    return 'id, surface_type, volume_ml, dimensions, price_per_piece';
}

function listBags(): void {
    $rows = getPDO()
        ->query('SELECT ' . bagColumns() . ' FROM bags ORDER BY surface_type, volume_ml')
        ->fetchAll();
    echo json_encode($rows);
}

function createBag(): void {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo  = getPDO();
    $stmt = $pdo->prepare(
        'INSERT INTO bags (surface_type, volume_ml, dimensions, price_per_piece) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $data['surface_type'] ?? 'nový',
        $data['volume_ml'] ?? 0,
        $data['dimensions'] ?? null,
        $data['price_per_piece'] ?? 0,
    ]);
    $id   = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT ' . bagColumns() . ' FROM bags WHERE id = ?');
    $stmt->execute([$id]);
    http_response_code(201);
    echo json_encode($stmt->fetch());
}

function updateBag(int $id): void {
    $data    = json_decode(file_get_contents('php://input'), true) ?? [];
    $pdo     = getPDO();
    $allowed = ['surface_type', 'volume_ml', 'dimensions', 'price_per_piece'];
    $fields  = [];
    $params  = [];
    foreach ($allowed as $col) {
        if (array_key_exists($col, $data)) {
            $fields[] = "`$col` = ?";
            $params[]  = $data[$col];
        }
    }
    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'Žádná platná pole k aktualizaci']);
        return;
    }
    $params[] = $id;
    $pdo->prepare('UPDATE bags SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    $stmt = $pdo->prepare('SELECT ' . bagColumns() . ' FROM bags WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Pytlík nenalezen']);
        return;
    }
    echo json_encode($row);
}

function deleteBag(int $id): void {
    $pdo = getPDO();
    try {
        $pdo->prepare('DELETE FROM bags WHERE id = ?')->execute([$id]);
        http_response_code(204);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode(['error' => 'Pytlík je použit v prodeji, nelze smazat.']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Chyba při mazání']);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/bags.php
git commit -m "feat(backend): Add bags CRUD endpoints"
```

---

## Task 10: Frontend API — rozšířit `bags.ts`

**Files:**
- Modify: `frontend/src/api/bags.ts`

- [ ] **Step 1: Přepsat `bags.ts`**

```ts
// frontend/src/api/bags.ts
import { apiFetch } from './client'
import type { Bag } from '../types'

export const getBags = (): Promise<Bag[]> => apiFetch<Bag[]>('/bags')

export const createBag = (data: Partial<Bag>): Promise<Bag> =>
  apiFetch<Bag>('/bags', { method: 'POST', body: JSON.stringify(data) })

export const updateBag = (id: number, data: Partial<Bag>): Promise<Bag> =>
  apiFetch<Bag>(`/bags/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteBag = (id: number): Promise<void> =>
  apiFetch<void>(`/bags/${id}`, { method: 'DELETE' })
```

- [ ] **Step 2: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/bags.ts
git commit -m "feat(api): Add bags CRUD client"
```

---

## Task 11: Přepsat `Bags.tsx` na editovatelnou tabulku

**Files:**
- Modify: `frontend/src/pages/admin/Bags.tsx` (celý přepis)
- Modify: `frontend/src/pages/admin/Bags.module.css`

- [ ] **Step 1: Přepsat `Bags.module.css`**

Celý nový obsah (stejný vzor jako Categories):

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.title {
  color: #d4a84b;
  margin: 0;
  font-size: 1.4rem;
}

.addBtn {
  padding: 4px 12px;
  background: #1e2a1e;
  border: 1px solid #6abf69;
  color: #6abf69;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.addBtn:hover:not(:disabled) {
  background: #243324;
}

.addBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tableWrapper {
  flex: 1;
  overflow: auto;
  border-radius: 8px;
  background: #222;
}

.deleteBtn {
  padding: 0;
  background: none;
  border: none;
  color: #b06a6a;
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.deleteBtn:hover:not(:disabled) {
  color: #c98686;
}

.deleteBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  color: #666;
  font-style: italic;
  padding: 24px;
}

.error {
  color: #ff6b6b;
  padding: 12px;
  background: #3a1a1a;
  border-radius: 6px;
  border-left: 3px solid #ff6b6b;
}
```

- [ ] **Step 2: Přepsat `Bags.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react'
import type { Bag } from '../../types'
import { getBags, createBag, updateBag, deleteBag } from '../../api/bags'
import EditableGrid, { type ColDef } from '../../components/admin/EditableGrid'
import styles from './Bags.module.css'

export default function AdminBags() {
  const [bags, setBags] = useState<Bag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBags(await getBags())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns: ColDef<Bag>[] = [
    { key: 'id', label: 'ID', type: 'readonly' },
    { key: 'surface_type', label: 'Materiál', type: 'text' },
    { key: 'volume_ml', label: 'Objem ml', type: 'number' },
    { key: 'dimensions', label: 'Rozměry', type: 'text' },
    { key: 'price_per_piece', label: 'Cena/ks', type: 'number' },
  ]

  async function handleSaveCell(bag: Bag, col: ColDef<Bag>, value: string) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = value
      if (col.type === 'number') parsed = value === '' ? null : parseFloat(value)
      const updated = await updateBag(bag.id, { [col.key]: parsed })
      setBags((prev) => prev.map((b) => (b.id === bag.id ? updated : b)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uložení')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await createBag({
        surface_type: 'nový',
        volume_ml: 0,
        dimensions: null,
        price_per_piece: 0,
      })
      setBags((prev) => [...prev, created])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bag: Bag) {
    setSaving(true)
    try {
      await deleteBag(bag.id)
      setBags((prev) => prev.filter((b) => b.id !== bag.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba mazání')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pytlíky</h1>
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving}>
          + Přidat
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrapper}>
        <EditableGrid<Bag>
          columns={columns}
          rows={bags}
          getRowId={(b) => b.id}
          onSaveCell={handleSaveCell}
          renderRowActions={(bag) => (
            <button className={styles.deleteBtn} onClick={() => handleDelete(bag)} disabled={saving}>
              smazat
            </button>
          )}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Ověřit typecheck**

Run (z `frontend/`): `npx tsc -b`
Expected: bez chyb.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/Bags.tsx frontend/src/pages/admin/Bags.module.css
git commit -m "feat(admin): Rewrite Bags as editable grid"
```

---

## Task 12: Testy `Bags.tsx`

**Files:**
- Create: `frontend/src/pages/admin/Bags.test.tsx`

- [ ] **Step 1: Napsat testy**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Bags from './Bags'
import * as bagsApi from '../../api/bags'
import type { Bag } from '../../types'

vi.mock('../../api/bags', () => ({
  getBags: vi.fn(),
  createBag: vi.fn(),
  updateBag: vi.fn(),
  deleteBag: vi.fn(),
}))

const BAGS: Bag[] = [
  { id: 1, surface_type: 'porcelán', volume_ml: 200, dimensions: '8x8', price_per_piece: 12.5 },
  { id: 2, surface_type: 'sklo', volume_ml: 300, dimensions: null, price_per_piece: 20 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(bagsApi.getBags).mockResolvedValue(BAGS)
})

describe('Bags', () => {
  it('zobrazí seznam pytlíků', async () => {
    render(<Bags />)
    expect(await screen.findByText('porcelán')).toBeInTheDocument()
    expect(screen.getByText('sklo')).toBeInTheDocument()
  })

  it('cena se zobrazí bez zbytečných nul (20, ne 20.00)', async () => {
    render(<Bags />)
    await screen.findByText('porcelán')
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('přidání zavolá createBag a připne řádek', async () => {
    vi.mocked(bagsApi.createBag).mockResolvedValue({
      id: 3,
      surface_type: 'nový',
      volume_ml: 0,
      dimensions: null,
      price_per_piece: 0,
    })
    const user = userEvent.setup()
    render(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    await waitFor(() =>
      expect(bagsApi.createBag).toHaveBeenCalledWith({
        surface_type: 'nový',
        volume_ml: 0,
        dimensions: null,
        price_per_piece: 0,
      })
    )
    expect(await screen.findByText('nový')).toBeInTheDocument()
  })

  it('editace ceny zavolá updateBag', async () => {
    vi.mocked(bagsApi.updateBag).mockResolvedValue({
      id: 1,
      surface_type: 'porcelán',
      volume_ml: 200,
      dimensions: '8x8',
      price_per_piece: 15,
    })
    const user = userEvent.setup()
    render(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getByText('12.5'))
    await user.keyboard('{Enter}')
    const input = screen.getByDisplayValue('12.5')
    await user.clear(input)
    await user.type(input, '15')
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(bagsApi.updateBag).toHaveBeenCalledWith(1, { price_per_piece: 15 })
    )
  })

  it('smazání zavolá deleteBag a odebere řádek', async () => {
    vi.mocked(bagsApi.deleteBag).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<Bags />)
    await screen.findByText('porcelán')
    await user.click(screen.getAllByRole('button', { name: 'smazat' })[0])
    await waitFor(() => expect(bagsApi.deleteBag).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('porcelán')).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Spustit testy**

Run (z `frontend/`): `npm run test -- src/pages/admin/Bags.test.tsx`
Expected: PASS (5 testů).

- [ ] **Step 3: Spustit celou suite + typecheck**

Run (z `frontend/`): `npx tsc -b && npm run test`
Expected: tsc bez chyb; všechny testy PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/Bags.test.tsx
git commit -m "test(admin): Add Bags page tests"
```

---

## Finální ověření (po Fázi 3)

- [ ] **Manuální smoke test v UI**

Spustit `docker compose up -d` (backend :8080) a `npm run dev` (frontend :5173). Přihlásit `admin`/`admin`. Ověřit:
1. Nav „Kategorie" → editace názvu/pořadí/nadřazené, přidání, smazání (a 409 u použité kategorie).
2. Nav „Pytlíky" → plochá tabulka, editace, přidání, smazání.
3. Nav „Čaje" → vše funguje jako dřív (editace, deaktivace, šipky, čísla).

---

## Poznámky

- **Backend nemá test framework** (jako zbytek repa) → backend ověřit manuálně/přes UI.
- **Pre-existing quirk:** Stávající Items zobrazoval v sloupci „Kategorie" číselné `category_id` bez možnosti editace (chyběly options). Refactor to zlepšuje — sloupec teď zobrazuje **název** kategorie (`render`) a edituje se přes select s options. Žádný test na to nezávisel.
- **Mimo rozsah:** nákupní var-sloupce pytlíků, soft-deaktivace kategorií/pytlíků, drag-and-drop řazení.
