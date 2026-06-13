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
