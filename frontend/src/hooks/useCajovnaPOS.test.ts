import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useCajovnaPOS, buildBaleni, deriveCategories, deriveZeme, normalizeSearch } from './useCajovnaPOS'
import type { TeaRow } from '../types'
import * as teasApi from '../api/teas'
import * as cajovnaApi from '../api/cajovna'

vi.mock('../api/teas')
vi.mock('../api/cajovna')

const row1: TeaRow = {
  id: 1, KOD: '2606-C-BILY-TAWN-01', KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Show Mee',
  POZNAMKA: null, MN1: 30, CENA1: 130, MN2: 200, CENA2: 700,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row2: TeaRow = {
  id: 2, KOD: '2606-C-BILY-TAWN-02', KATEGORIE: 'BÍLÝ', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Bai Mu Dan',
  POZNAMKA: 'poznámka', MN1: 30, CENA1: 220, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row3: TeaRow = {
  id: 3, KOD: '2606-C-ZELE-JAPO-01', KATEGORIE: 'ZELENÉ', ZEME: 'Japonsko', AKTIV: null, NAZEV: 'Neaktivní',
  POZNAMKA: null, MN1: 30, CENA1: 100, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row4: TeaRow = {
  id: 4, KOD: '2606-C-BILY-TAWN-03', KATEGORIE: 'BÍLÝ', ZEME: 'Taiwan', AKTIV: 'x', NAZEV: 'Bílý Taiwan',
  POZNAMKA: null, MN1: 30, CENA1: 180, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const row5: TeaRow = {
  id: 5, KOD: '2607-C-PUER-CINA-01', KATEGORIE: 'PUERH', ZEME: 'Čína', AKTIV: 'x', NAZEV: 'Shu Puerh',
  POZNAMKA: null, MN1: 50, CENA1: 250, MN2: null, CENA2: null,
  MN3: null, CENA3: null, MN4: null, CENA4: null,
}
const allRows = [row1, row2, row3, row4, row5]

beforeEach(() => {
  vi.mocked(teasApi.getTeas).mockResolvedValue(allRows)
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
  test('vrací unikátní názvy kategorií, filtruje neaktivní, řadí abecedně', () => {
    expect(deriveCategories(allRows)).toEqual(['BÍLÝ', 'PUERH'])
  })
  test('vrátí prázdné pole pro prázdný vstup', () => {
    expect(deriveCategories([])).toHaveLength(0)
  })
})

// --- deriveZeme ---
describe('deriveZeme', () => {
  test('vrací unikátní země aktivních čajů kategorie, řadí abecedně', () => {
    expect(deriveZeme(allRows, 'BÍLÝ')).toEqual(['Čína', 'Taiwan'])
  })
  test('kategorie s jednou zemí vrátí jednu položku', () => {
    expect(deriveZeme(allRows, 'PUERH')).toEqual(['Čína'])
  })
  test('prázdné/null země se vynechají', () => {
    const bezZeme = { ...row1, id: 9, KOD: '2606-C-BILY-XXXX-09', ZEME: null }
    expect(deriveZeme([bezZeme], 'BÍLÝ')).toEqual([])
  })
})

// --- normalizeSearch ---
describe('normalizeSearch', () => {
  test('odstraní diakritiku a převede na malá písmena', () => {
    expect(normalizeSearch('Černý')).toBe('cerny')
    expect(normalizeSearch('ŠÍPKOVÝ ČAJ')).toBe('sipkovy caj')
  })
  test('prázdný řetězec zůstane prázdný', () => {
    expect(normalizeSearch('')).toBe('')
  })
})

// --- useCajovnaPOS ---
describe('useCajovnaPOS', () => {
  test('startuje na home, načítá data', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    expect(result.current.view).toBe('home')
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.categories).toEqual(['BÍLÝ', 'PUERH'])
    expect(result.current.cart).toHaveLength(0)
  })

  test('selectCategory s více zeměmi → countries view s nabídkou zemí', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    expect(result.current.view).toBe('countries')
    expect(result.current.zemeOptions).toEqual(['Čína', 'Taiwan'])
    expect(result.current.selectedCategory).toBe('BÍLÝ')
  })

  test('selectCategory s jedinou zemí → přeskočí krok zemí, rovnou teas', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('PUERH'))
    expect(result.current.view).toBe('teas')
    expect(result.current.teas).toHaveLength(1)
    expect(result.current.teas[0].NAZEV).toBe('Shu Puerh')
  })

  test('selectZeme s konkrétní zemí filtruje kategorii i zemi', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Taiwan'))
    expect(result.current.view).toBe('teas')
    expect(result.current.teas).toHaveLength(1)
    expect(result.current.teas[0].NAZEV).toBe('Bílý Taiwan')
    expect(result.current.selectedZeme).toBe('Taiwan')
  })

  test('selectZeme(null) = Vše → všechny aktivní čaje kategorie', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme(null))
    expect(result.current.view).toBe('teas')
    expect(result.current.teas).toHaveLength(3)
    expect(result.current.teas.every((r) => r.AKTIV === 'x')).toBe(true)
  })

  test('selectTea → packaging view, sestaví baleniOptions', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.selectTea(row1))
    expect(result.current.view).toBe('packaging')
    expect(result.current.baleniOptions).toHaveLength(2)
    expect(result.current.selectedBaleni?.cislo).toBe(1)
  })

  test('selectBaleni → quantity view', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    expect(result.current.view).toBe('quantity')
  })

  test('selectKusu → přidá do košíku, vrátí na home, resetuje výběr', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
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
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    const id = result.current.cart[0].localId
    act(() => result.current.removeFromCart(id))
    expect(result.current.cart).toHaveLength(0)
  })

  test('goBack z teas → countries (kategorie s více zeměmi)', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('countries')
  })

  test('goBack z teas → categories (krok zemí byl přeskočen)', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('PUERH'))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('categories')
  })

  test('goBack z countries → categories', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
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

  test('confirmCheckout → volá createCajovnaSale, vymaže košík, vrátí na home', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(cajovnaApi.createCajovnaSale).toHaveBeenCalledOnce()
    expect(cajovnaApi.createCajovnaSale).toHaveBeenCalledWith([
      { caje_kod: '2606-C-BILY-TAWN-01', baleni: 1, kusu: 1, jedn_cena: 130, celk_cena: 130 },
    ])
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.lastTotal).toBe(130)
  })

  test('confirmCheckout při chybě API → nastaví checkoutError, zůstane na checkout', async () => {
    vi.mocked(cajovnaApi.createCajovnaSale).mockRejectedValueOnce(new Error('Server error'))
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Čína'))
    act(() => result.current.selectTea(row1))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(result.current.view).toBe('checkout')
    expect(result.current.checkoutError).toBe('Server error')
  })

  test('newSale resetuje košík a výběry včetně země', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory('BÍLÝ'))
    act(() => result.current.selectZeme('Taiwan'))
    act(() => result.current.selectTea(row4))
    act(() => result.current.selectBaleni(result.current.baleniOptions[0]))
    act(() => result.current.selectKusu(1))
    act(() => result.current.newSale())
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCategory).toBeNull()
    expect(result.current.selectedZeme).toBeNull()
    expect(result.current.zemeOptions).toHaveLength(0)
  })

  test('setSearchQuery naplní searchResults podle názvu, bez diakritiky, jen aktivní čaje', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('bily'))
    expect(result.current.searchResults.map((t) => t.NAZEV)).toEqual(['Bílý Taiwan'])
  })

  test('prázdný searchQuery → prázdné searchResults', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.searchResults).toHaveLength(0)
  })

  test('searchResults vynechá neaktivní čaje', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('neaktivni'))
    expect(result.current.searchResults).toHaveLength(0)
  })

  test('selectTea z vyhledávání vyprázdní searchQuery', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('bily'))
    act(() => result.current.selectTea(row4))
    expect(result.current.view).toBe('packaging')
    expect(result.current.searchQuery).toBe('')
  })

  test('newSale vyprázdní searchQuery', async () => {
    const { result } = renderHook(() => useCajovnaPOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setSearchQuery('bily'))
    act(() => result.current.newSale())
    expect(result.current.searchQuery).toBe('')
  })
})
