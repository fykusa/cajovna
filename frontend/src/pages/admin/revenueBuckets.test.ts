import { describe, it, expect } from 'vitest'
import { bucketRevenue } from './revenueBuckets'
import type { Sale } from '../../types'

const sale = (created_at: string, total: number): Sale => ({
  id: Math.random(),
  user_id: 1,
  username: 'admin',
  total_amount: total,
  note: null,
  created_at,
})

describe('bucketRevenue', () => {
  it('denní agregace sečte tržby ve stejném dni', () => {
    const sales = [
      sale('2026-06-01 10:00:00', 100),
      sale('2026-06-01 14:00:00', 50),
      sale('2026-06-03 09:00:00', 200),
    ]
    const b = bucketRevenue(sales, '2026-06-01', '2026-06-03')
    expect(b).toEqual([
      { label: '01.06', value: 150 },
      { label: '02.06', value: 0 }, // den bez prodeje = 0
      { label: '03.06', value: 200 },
    ])
  })

  it('období > 45 dní se agreguje po měsících', () => {
    const sales = [
      sale('2026-01-15 10:00:00', 300),
      sale('2026-03-20 10:00:00', 700),
    ]
    const b = bucketRevenue(sales, '2026-01-01', '2026-03-31')
    expect(b).toEqual([
      { label: '01/26', value: 300 },
      { label: '02/26', value: 0 },
      { label: '03/26', value: 700 },
    ])
  })

  it('prodej mimo rozsah se ignoruje', () => {
    const sales = [sale('2026-05-31 23:00:00', 999)]
    const b = bucketRevenue(sales, '2026-06-01', '2026-06-02')
    expect(b.every((x) => x.value === 0)).toBe(true)
  })

  it('prázdný vstup vrátí nulové intervaly', () => {
    const b = bucketRevenue([], '2026-06-01', '2026-06-02')
    expect(b).toEqual([
      { label: '01.06', value: 0 },
      { label: '02.06', value: 0 },
    ])
  })

  it('obrácený rozsah vrátí prázdné pole', () => {
    expect(bucketRevenue([], '2026-06-05', '2026-06-01')).toEqual([])
  })
})
