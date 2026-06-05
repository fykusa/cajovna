import type { Sale } from '../../types'

export interface RevenueBucket {
  /** Popisek osy X — den („1".."31") nebo měsíc („01".."12"). */
  label: string
  /** Součet tržeb v daném intervalu. */
  value: number
}

/**
 * Sečte tržby (total_amount) z prodejů do sloupců s pevnou osou X:
 *  - Spadá-li rozsah `from`–`to` do jednoho kalendářního měsíce → 31 denních
 *    sloupců (1.–31.); dny, které měsíc nemá, zůstanou prázdné (0).
 *  - Jinak (vícemesíční / roční) → 12 měsíčních sloupců (01–12) POSLEDNÍHO roku
 *    rozsahu (rok z `to`); prodeje mimo tento rok se nezapočítají.
 * Klíč z `created_at` ("YYYY-MM-DD HH:MM:SS") se čte přes slice (bez Date parse).
 */
export function bucketRevenue(sales: Sale[], from: string, to: string): RevenueBucket[] {
  const fromD = new Date(`${from}T00:00:00`)
  const toD = new Date(`${to}T00:00:00`)
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime()) || toD < fromD) return []

  const sameMonth =
    fromD.getFullYear() === toD.getFullYear() && fromD.getMonth() === toD.getMonth()

  if (sameMonth) {
    const year = fromD.getFullYear()
    const month = fromD.getMonth() + 1 // 1–12
    const sums = new Array(31).fill(0)
    for (const s of sales) {
      const [sy, sm, sd] = s.created_at.slice(0, 10).split('-').map(Number)
      if (sy === year && sm === month && sd >= 1 && sd <= 31) {
        sums[sd - 1] += Number(s.total_amount)
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
      sums[sm - 1] += Number(s.total_amount)
    }
  }
  return sums.map((value, i) => ({ label: String(i + 1).padStart(2, '0'), value }))
}
