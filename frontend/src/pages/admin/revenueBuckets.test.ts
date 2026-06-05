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
  it('jeden měsíc → 31 denních sloupců (1.–31.), tržby na správných dnech', () => {
    const sales = [
      sale('2026-06-01 10:00:00', 100),
      sale('2026-06-01 14:00:00', 50),
      sale('2026-06-03 09:00:00', 200),
    ]
    const b = bucketRevenue(sales, '2026-06-01', '2026-06-30')
    expect(b).toHaveLength(31)
    expect(b[0]).toEqual({ label: '1', value: 150 }) // 1.6.
    expect(b[1]).toEqual({ label: '2', value: 0 })   // 2.6. bez prodeje
    expect(b[2]).toEqual({ label: '3', value: 200 }) // 3.6.
    expect(b[30]).toEqual({ label: '31', value: 0 }) // 31. den vždy přítomen
  })

  it('únor → stále 31 sloupců, dny 29–31 prázdné', () => {
    const b = bucketRevenue([], '2026-02-01', '2026-02-28')
    expect(b).toHaveLength(31)
    expect(b[28]).toEqual({ label: '29', value: 0 })
    expect(b[30]).toEqual({ label: '31', value: 0 })
  })

  it('vícemesíční rozsah → 12 měsíčních sloupců (01–12)', () => {
    const sales = [
      sale('2026-01-15 10:00:00', 300),
      sale('2026-03-20 10:00:00', 700),
    ]
    const b = bucketRevenue(sales, '2026-01-01', '2026-03-31')
    expect(b).toHaveLength(12)
    expect(b[0]).toEqual({ label: '01', value: 300 }) // leden
    expect(b[2]).toEqual({ label: '03', value: 700 }) // březen
    expect(b[11]).toEqual({ label: '12', value: 0 })  // prosinec přítomen
  })

  it('rozsah přes více let → jen poslední rok (rok z `to`)', () => {
    const sales = [
      sale('2025-05-10 10:00:00', 999), // starší rok — ignorovat
      sale('2026-03-20 10:00:00', 700),
    ]
    const b = bucketRevenue(sales, '2024-01-01', '2026-06-30')
    expect(b).toHaveLength(12)
    expect(b[2]).toEqual({ label: '03', value: 700 })
    expect(b.reduce((s, x) => s + x.value, 0)).toBe(700) // 2025 se nezapočítá
  })

  it('prázdný vstup (jeden měsíc) → 31 nulových sloupců', () => {
    const b = bucketRevenue([], '2026-06-01', '2026-06-30')
    expect(b).toHaveLength(31)
    expect(b.every((x) => x.value === 0)).toBe(true)
  })

  it('obrácený rozsah vrátí prázdné pole', () => {
    expect(bucketRevenue([], '2026-06-05', '2026-06-01')).toEqual([])
  })
})
