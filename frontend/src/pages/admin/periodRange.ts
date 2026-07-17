// Sdílený filtr období pro admin stránky (Přehled, Tržby).
export type Period = 'today' | 'week' | 'month' | 'lastmonth' | 'year'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function periodRange(p: Period): { from: string; to: string } {
  const now = new Date()
  const today = fmt(now)
  if (p === 'today') {
    return { from: today, to: today }
  }
  if (p === 'week') {
    const day = now.getDay() // 0 = neděle
    const diffToMonday = day === 0 ? 6 : day - 1
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
    return { from: fmt(monday), to: today }
  }
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

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'month',     label: 'Tento měsíc' },
  { key: 'lastmonth', label: 'Minulý měsíc' },
  { key: 'year',      label: 'Celý rok' },
]

export const DASHBOARD_PERIODS: { key: Period; label: string }[] = [
  { key: 'today',     label: 'Dnes' },
  { key: 'week',      label: 'Tento týden' },
  { key: 'month',     label: 'Tento měsíc' },
  { key: 'lastmonth', label: 'Minulý měsíc' },
  { key: 'year',      label: 'Celý rok' },
]
