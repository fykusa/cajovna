export interface RevenueBucket {
  /** Popisek osy X — den („1".."31") nebo měsíc („01".."12"). */
  label: string
  /** Součet tržeb v daném intervalu. */
  value: number
}

interface SaleWithRevenue {
  created_at: string
  total_kc?: number
  total_amount?: number | string
}

/**
 * Sečte tržby z prodejů do sloupců s pevnou osou X.
 * Podporuje jak `total_kc` (nové tabulky) tak `total_amount` (staré tabulky).
 */
export function bucketRevenue(sales: SaleWithRevenue[], from: string, to: string): RevenueBucket[] {
  const fromD = new Date(`${from}T00:00:00`)
  const toD = new Date(`${to}T00:00:00`)
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime()) || toD < fromD) return []

  const amount = (s: SaleWithRevenue) => s.total_kc ?? Number(s.total_amount ?? 0)

  const sameMonth =
    fromD.getFullYear() === toD.getFullYear() && fromD.getMonth() === toD.getMonth()

  if (sameMonth) {
    const year = fromD.getFullYear()
    const month = fromD.getMonth() + 1 // 1–12
    const sums = new Array(31).fill(0)
    for (const s of sales) {
      const [sy, sm, sd] = s.created_at.slice(0, 10).split('-').map(Number)
      if (sy === year && sm === month && sd >= 1 && sd <= 31) {
        sums[sd - 1] += amount(s)
      }
    }
    return sums.map((value, i) => ({ label: String(i + 1), value }))
  }

  // Vícemesíční / roční → 12 měsíců posledního roku rozsahu.
  const year = toD.getFullYear()
  const sums = new Array(12).fill(0)
  for (const s of sales) {
    const [sy, sm] = s.created_at.slice(0, 10).split('-').map(Number)
    if (sy === year && sm >= 1 && sm <= 12) {
      sums[sm - 1] += amount(s)
    }
  }
  return sums.map((value, i) => ({ label: String(i + 1).padStart(2, '0'), value }))
}
