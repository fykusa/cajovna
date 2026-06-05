import { useEffect, useState, useCallback } from 'react'
import { getSales, getSaleItems } from '../../api/sales'
import { getUsers } from '../../api/users'
import { getCategories, getProducts } from '../../api/products'
import type { Sale, SaleItem, User, Category, Tea } from '../../types'
import { useToast } from '../../components/toast/useToast'
import ImportDialog from '../../components/admin/ImportDialog'
import RevenueChart from '../../components/admin/RevenueChart'
import { exportDatabase } from '../../api/admin'
import { bucketRevenue } from './revenueBuckets'
import styles from './Dashboard.module.css'

type Period = 'month' | 'lastmonth' | 'year'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date()
  const today = fmt(now)
  if (p === 'month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  if (p === 'lastmonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last  = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: fmt(first), to: fmt(last) }
  }
  return { from: `${now.getFullYear()}-01-01`, to: today }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month',     label: 'Tento měsíc' },
  { key: 'lastmonth', label: 'Minulý měsíc' },
  { key: 'year',      label: 'Celý rok' },
]

interface GroupedItem {
  tea: SaleItem | null
  bag: SaleItem | null
}

function groupItems(items: SaleItem[]): GroupedItem[] {
  const groups: GroupedItem[] = []
  const processed = new Set<number>()

  items.forEach((item, idx) => {
    if (processed.has(idx)) return
    if (item.item_type === 'bag') return

    const tea = item
    const bagIdx = items.findIndex((it, i) => !processed.has(i) && it.item_type === 'bag' && it.quantity === tea.quantity)
    const bag = bagIdx >= 0 ? items[bagIdx] : null
    if (bagIdx >= 0) processed.add(bagIdx)

    groups.push({ tea, bag })
    processed.add(idx)
  })

  return groups
}

function groupLabel(group: GroupedItem): string {
  if (!group.tea) return 'N/A'
  let label = group.tea.tea_name || 'Položka'
  if (group.bag && group.bag.surface_type && group.bag.volume_ml) {
    label += ` + Pytlík ${group.bag.surface_type} ${group.bag.volume_ml} ml`
  }
  return label
}

export default function AdminDashboard() {
  const initRange = periodRange('month')
  const [from, setFrom]                 = useState(initRange.from)
  const [to, setTo]                     = useState(initRange.to)
  const [activePeriod, setActivePeriod] = useState<Period | null>('month')
  const [sales, setSales]               = useState<Sale[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedId, setSelectedId]     = useState<number | null>(null)
  const [items, setItems]               = useState<SaleItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [users, setUsers]               = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  const [categories, setCategories]     = useState<Category[]>([])
  const [teas, setTeas]                 = useState<Tea[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set())
  const [selectedTeas, setSelectedTeas] = useState<Set<number>>(new Set())
  const [showImport, setShowImport]     = useState(false)

  const toast = useToast()

  const load = useCallback(async (f: string, t: string, catIds: number[] = [], teaIds: number[] = []) => {
    setLoading(true)
    setSelectedId(null)
    setItems([])
    try {
      setSales(await getSales({
        from: f + ' 00:00:00',
        to: t + ' 23:59:59',
        category_ids: catIds.length ? catIds : undefined,
        tea_ids: teaIds.length ? teaIds : undefined,
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load(from, to)
    getUsers().then((us) => {
      setUsers(us)
      setSelectedUsers(new Set(us.map((u) => u.id)))
    }).catch(() => {})
    getCategories().then(setCategories).catch(() => {})
    getProducts().then(setTeas).catch(() => {})
  }, [])

  function selectPeriod(p: Period) {
    const range = periodRange(p)
    setFrom(range.from)
    setTo(range.to)
    setActivePeriod(p)
    load(range.from, range.to, Array.from(selectedCategories), Array.from(selectedTeas))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    load(from, to, Array.from(selectedCategories), Array.from(selectedTeas))
  }

  function toggleCategory(id: number) {
    const next = new Set(selectedCategories)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedCategories(next)
    // Změna kategorií → vyčistit výběr čajů (pod-filtr se váže na jednu kategorii).
    setSelectedTeas(new Set())
    setSelectedId(null)
    setItems([])
    load(from, to, Array.from(next), [])
  }

  function toggleTea(id: number) {
    const next = new Set(selectedTeas)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedTeas(next)
    setSelectedId(null)
    setItems([])
    load(from, to, Array.from(selectedCategories), Array.from(next))
  }

  async function selectSale(id: number) {
    setSelectedId(id)
    setItemsLoading(true)
    try {
      setItems(await getSaleItems(id))
    } catch {
      setItems([])
    } finally {
      setItemsLoading(false)
    }
  }

  function handleListKey(e: React.KeyboardEvent) {
    if (visibleSales.length === 0) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const idx = visibleSales.findIndex((s) => s.id === selectedId)
    let next: number
    if (e.key === 'ArrowDown') next = idx < visibleSales.length - 1 ? idx + 1 : idx
    else                       next = idx > 0 ? idx - 1 : 0
    selectSale(visibleSales[next].id)
    document.getElementById(`sale-${visibleSales[next].id}`)?.scrollIntoView({ block: 'nearest' })
  }

  function toggleUser(id: number) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
    setSelectedId(null)
    setItems([])
  }

  const allSelected = selectedUsers.size === users.length
  const visibleSales = allSelected
    ? sales
    : sales.filter((s) => selectedUsers.has(s.user_id))

  const total = visibleSales.reduce((s, sale) => s + Number(sale.total_amount), 0)
  const selectedSale = visibleSales.find((s) => s.id === selectedId) ?? null
  const grouped = groupItems(items)
  const chartData = bucketRevenue(visibleSales, from, to)

  async function handleExport() {
    const allItems: Array<SaleItem & { sale: Sale }> = []
    for (const sale of visibleSales) {
      try {
        const saleItems = await getSaleItems(sale.id)
        allItems.push(...saleItems.map((it) => ({ ...it, sale })))
      } catch {
        // skip on error
      }
    }

    // CSV header
    const csvRows: string[] = ['Datum;Čas;Uživatel;ID prodeje;Pořadí;ID kategorie;Kategorie;ID položky;Položka;Množství;Cena produktu;Cena pytlíku;Celková cena']

    // group items by sale, preserve order
    const bySale = new Map<number, SaleItem[]>()
    allItems.forEach((it) => {
      const key = it.sale.id
      if (!bySale.has(key)) bySale.set(key, [])
      bySale.get(key)!.push(it)
    })

    // build CSV rows
    for (const sale of visibleSales) {
      const saleItems = bySale.get(sale.id) || []
      const grouped = groupItems(saleItems)
      let saleIdx = 1
      for (const group of grouped) {
        const teaPrice = group.tea ? Math.round(Number(group.tea.total_price)) : 0
        const bagPrice = group.bag ? Math.round(Number(group.bag.total_price)) : 0
        const itemTotal = teaPrice + bagPrice
        const catId = group.tea?.category_id ?? ''
        const catName = catId ? categories.find((c) => c.id === catId)?.name || '' : ''
        const teaId = group.tea?.tea_id ?? ''
        const qty = group.tea?.quantity ?? ''
        const dt = new Date(sale.created_at)
        const date = dt.toLocaleString('cs-CZ', { year: 'numeric', month: '2-digit', day: '2-digit' })
        const time = dt.toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
        csvRows.push([
          date,
          time,
          sale.username,
          String(sale.id),
          String(saleIdx),
          String(catId),
          String(catName),
          String(teaId),
          groupLabel(group),
          String(qty),
          String(teaPrice),
          String(bagPrice),
          String(itemTotal),
        ].map((v) => `"${v}"`).join(';'))
        saleIdx++
      }
    }

    // summary
    csvRows.push('')
    csvRows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'CELKEM',
      '',
      '',
      '',
      String(Math.round(total)),
    ].map((v) => `"${v}"`).join(';'))

    // UTF-8 s BOM (Excel to pozná)
    const csvText = csvRows.join('\n')
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const encoder = new TextEncoder()
    const encoded = encoder.encode(csvText)
    const blob = new Blob([bom, encoded], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `export-${from}-${to}.csv`)
    link.click()
  }

  async function handleExportDb() {
    try {
      await exportDatabase()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export DB se nezdařil')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Přehled</h1>
        <div className={styles.periods}>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.periodBtn}${activePeriod === key ? ' ' + styles.active : ''}`}
              onClick={() => selectPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <form className={styles.rangeForm} onSubmit={handleSubmit}>
          <input
            type="date" value={from}
            onChange={(e) => { setFrom(e.target.value); setActivePeriod(null) }}
            className={styles.dateInput}
          />
          <span className={styles.rangeSep}>–</span>
          <input
            type="date" value={to}
            onChange={(e) => { setTo(e.target.value); setActivePeriod(null) }}
            className={styles.dateInput}
          />
          <button type="submit" className={styles.applyBtn}>Zobrazit</button>
          <button type="button" className={styles.exportBtn} onClick={handleExport}>Export CSV</button>
          <button type="button" className={styles.dbBtn} onClick={handleExportDb}>Export DB</button>
          <button type="button" className={styles.dbBtn} onClick={() => setShowImport(true)}>Import DB</button>
        </form>
      </div>

      {users.length > 0 && (
        <div className={styles.userFilter}>
          {users.map((u) => (
            <button
              key={u.id}
              className={`${styles.userBtn}${selectedUsers.has(u.id) ? ' ' + styles.userActive : ''}`}
              onClick={() => toggleUser(u.id)}
            >
              {u.username}
            </button>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className={styles.filterSection}>
          <label className={styles.filterLabel}>Kategorie</label>
          <div className={styles.filterGrid}>
            {categories.filter((c) => !c.parent_id).map((cat) => (
              <button
                key={cat.id}
                className={`${styles.filterBtn}${selectedCategories.has(cat.id) ? ' ' + styles.filterActive : ''}`}
                onClick={() => toggleCategory(cat.id)}
              >
                <span className={styles.filterId}>{String(cat.id).padStart(2, '0')}</span>
                {' '}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCategories.size === 1 && teas.length > 0 && (
        <div className={styles.filterSection}>
          <label className={styles.filterLabel}>Čaje</label>
          <div className={styles.filterGrid}>
            {teas.filter((t) => t.category_id === Array.from(selectedCategories)[0]).map((tea) => (
              <button
                key={tea.id}
                className={`${styles.filterBtn}${selectedTeas.has(tea.id) ? ' ' + styles.filterActive : ''}`}
                onClick={() => toggleTea(tea.id)}
              >
                <span className={styles.filterId}>{String(tea.id).padStart(3, '0')}</span>
                {' '}
                {tea.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Tržby</div>
              <div className={styles.statValue}>{Math.round(total).toLocaleString('cs-CZ')} Kč</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Prodejů</div>
              <div className={styles.statValue}>{visibleSales.length}</div>
            </div>
          </div>

          <div className={styles.panels}>
            <div className={styles.listPanel}>
              <div className={styles.panelTitle}>Prodeje</div>
              {visibleSales.length === 0 ? (
                <p className={styles.empty}>Za zvolené období žádné prodeje.</p>
              ) : (
                <ul className={styles.list} tabIndex={0} onKeyDown={handleListKey}>
                  {visibleSales.map((s) => (
                    <li
                      id={`sale-${s.id}`}
                      key={s.id}
                      className={`${styles.listItem}${selectedId === s.id ? ' ' + styles.selected : ''}`}
                      onClick={(e) => { selectSale(s.id); (e.currentTarget.closest('ul') as HTMLElement)?.focus() }}
                    >
                      <span className={styles.itemTime}>
                        {new Date(s.created_at).toLocaleString('cs-CZ', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      <span className={styles.itemUser}>{s.username}</span>
                      <span className={styles.itemAmount}>{Math.round(Number(s.total_amount))} Kč</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.detailPanel}>
              {!selectedSale ? (
                <div className={styles.detailEmpty}>← vyberte prodej</div>
              ) : (
                <>
                  <div className={styles.detailHeader}>
                    <span className={styles.detailId}>
                      #{selectedSale.id}&nbsp;·&nbsp;{selectedSale.username}&nbsp;·&nbsp;
                      {new Date(selectedSale.created_at).toLocaleString('cs-CZ', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <span className={styles.detailTotal}>
                      {Math.round(Number(selectedSale.total_amount))} Kč
                    </span>
                  </div>
                  {itemsLoading ? (
                    <p className={styles.loading}>Načítám…</p>
                  ) : (
                    <ul className={styles.detailList}>
                      {grouped.map((group, idx) => {
                        const teaPrice = group.tea ? Math.round(Number(group.tea.total_price)) : 0
                        const bagPrice = group.bag ? Math.round(Number(group.bag.total_price)) : 0
                        const total = teaPrice + bagPrice
                        return (
                          <li key={idx} className={styles.detailRow}>
                            <span className={styles.detailQty}>
                              {group.tea?.quantity}×
                              {group.tea?.category_id && group.tea?.tea_id && (
                                <span className={styles.detailCode}>
                                  ({String(group.tea.category_id).padStart(2, '0')}-{String(group.tea.tea_id).padStart(3, '0')})
                                </span>
                              )}
                            </span>
                            <span className={styles.detailName}>{groupLabel(group)}</span>
                            <span className={styles.detailPrices}>
                              {group.tea && <span className={styles.teaPrice}>{teaPrice} Kč</span>}
                              {group.tea && group.bag && <span className={styles.sep}>|</span>}
                              {group.bag && <span className={styles.bagPrice}>{bagPrice} Kč</span>}
                              <span className={styles.totalPrice}>{total} Kč</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className={styles.chartPanel}>
              <RevenueChart data={chartData} />
            </div>
          </div>
        </>
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onDone={() => load(from, to, Array.from(selectedCategories), Array.from(selectedTeas))}
        />
      )}
    </div>
  )
}
