import type { Sale } from '../../types'

export interface RevenueBucket {
  /** Krátký popisek pro osu X (denní „DD.MM", měsíční „MM/RR"). */
  label: string
  /** Součet tržeb v daném intervalu. */
  value: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Sečte tržby (total_amount) z prodejů do intervalů mezi `from`–`to` (vč.).
 * Krátká období (≤ 45 dní) se dělí po dnech, delší po měsících. Intervaly bez
 * prodeje zůstávají s nulou, aby měla osa X spojitý průběh.
 */
export function bucketRevenue(sales: Sale[], from: string, to: string): RevenueBucket[] {
  const fromD = new Date(`${from}T00:00:00`)
  const toD = new Date(`${to}T00:00:00`)
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime()) || toD < fromD) return []

  const days = Math.round((toD.getTime() - fromD.getTime()) / 86_400_000) + 1
  const monthly = days > 45

  const keyOf = (d: Date) =>
    monthly
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  // Předvyplň všechny intervaly nulou (spojitá osa).
  const buckets = new Map<string, number>()
  const cursor = monthly
    ? new Date(fromD.getFullYear(), fromD.getMonth(), 1)
    : new Date(fromD)
  while (cursor <= toD) {
    buckets.set(keyOf(cursor), 0)
    if (monthly) cursor.setMonth(cursor.getMonth() + 1)
    else cursor.setDate(cursor.getDate() + 1)
  }

  for (const s of sales) {
    const k = keyOf(new Date(s.created_at))
    const cur = buckets.get(k)
    if (cur !== undefined) buckets.set(k, cur + Number(s.total_amount))
  }

  return Array.from(buckets.entries()).map(([k, value]) => {
    const [y, m, d] = k.split('-')
    return { label: monthly ? `${m}/${y.slice(2)}` : `${d}.${m}`, value }
  })
}
