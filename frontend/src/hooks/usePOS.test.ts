// frontend/src/hooks/usePOS.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as productsApi from '../api/products'
import * as bagsApi from '../api/bags'
import { usePOS } from './usePOS'

vi.mock('../api/products', () => ({
  getCategories: vi.fn(),
  getProducts: vi.fn(),
}))
vi.mock('../api/bags', () => ({
  getBags: vi.fn(),
}))

const mockGetCategories = vi.mocked(productsApi.getCategories)
const mockGetProducts = vi.mocked(productsApi.getProducts)
const mockGetBags = vi.mocked(bagsApi.getBags)

const CATEGORIES = [
  { id: 1, name: 'Bílé', parent_id: null, sort_order: 1 },
  { id: 2, name: 'Zelené', parent_id: null, sort_order: 2 },
  { id: 3, name: 'Japonské', parent_id: 2, sort_order: 1 },
]

const TEAS = [
  { id: 10, category_id: 1, name: 'Show Mee', note: null, flag: 'active' as const,
    origin: null, std_weight_g: 30, std_price_moc: 130, pkg1_weight_g: null,
    pkg1_price_moc: null, pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 5, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 0.5 },
  { id: 11, category_id: 1, name: 'Bai Mu Dan', note: null, flag: 'active' as const,
    origin: null, std_weight_g: 30, std_price_moc: 220, pkg1_weight_g: null,
    pkg1_price_moc: null, pkg2_weight_g: null, pkg2_price_moc: null,
    stock_std_pcs: 3, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 1.0 },
]

const BAGS = [
  { id: 1, surface_type: 'papír', volume_ml: 100, dimensions: null, price_per_piece: 2.91 },
  { id: 2, surface_type: 'papír', volume_ml: 250, dimensions: null, price_per_piece: 3.63 },
  { id: 3, surface_type: 'bílý matný', volume_ml: 250, dimensions: null, price_per_piece: 3.88 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCategories.mockResolvedValue(CATEGORIES)
  mockGetProducts.mockResolvedValue(TEAS)
  mockGetBags.mockResolvedValue(BAGS)
})

describe('usePOS – inicializace', () => {
  it('načte kategorie, čaje a pytlíky při mount', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    expect(result.current.state.categories).toHaveLength(3)
    expect(result.current.state.allTeas).toHaveLength(2)
    expect(result.current.state.bags).toHaveLength(3)
    expect(result.current.state.step).toBe('category')
  })
})

describe('usePOS – navigace kategorií', () => {
  it('moveDown posune index dolů (circular)', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    expect(result.current.state.categoryIndex).toBe(0)
    act(() => result.current.moveDown())
    expect(result.current.state.categoryIndex).toBe(1)
    act(() => result.current.moveDown())
    act(() => result.current.moveDown())
    expect(result.current.state.categoryIndex).toBe(0)
  })

  it('moveUp na začátku skočí na konec', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.moveUp())
    expect(result.current.state.categoryIndex).toBe(2)
  })

  it('moveRight na kategorii přejde na krok tea', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.moveRight())
    expect(result.current.state.step).toBe('tea')
    expect(result.current.state.selectedCategory).toEqual(CATEGORIES[0])
  })
})

describe('usePOS – výběr čaje', () => {
  async function atTeaStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.moveRight())
    await act(async () => {})
    return hook
  }

  it('confirm na čaji přejde na krok quantity', async () => {
    const { result } = await atTeaStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('quantity')
    expect(result.current.state.selectedTea).toEqual(TEAS[0])
    expect(result.current.state.quantity).toBe(1)
  })
})

describe('usePOS – množství', () => {
  async function atQuantityStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.moveRight())
    await act(async () => {})
    act(() => hook.result.current.confirm())
    return hook
  }

  it('moveUp zvýší množství o 1', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.moveUp())
    expect(result.current.state.quantity).toBe(2)
  })

  it('moveDown sníží množství (minimum 1)', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.moveDown())
    expect(result.current.state.quantity).toBe(1)
  })

  it('setQuantity nastaví přesné množství', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.setQuantity(5))
    expect(result.current.state.quantity).toBe(5)
  })

  it('confirm na quantity přejde na bag_yn', async () => {
    const { result } = await atQuantityStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('bag_yn')
    expect(result.current.state.wantBag).toBe(true)
  })
})

describe('usePOS – pytlík', () => {
  async function atBagYnStep() {
    const hook = renderHook(() => usePOS())
    await act(async () => {})
    act(() => hook.result.current.moveRight())
    await act(async () => {})
    act(() => hook.result.current.confirm())
    act(() => hook.result.current.confirm())
    return hook
  }

  it('bez pytlíku (wantBag=false) přidá položku do košíku a vrátí na category', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.moveDown())
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.cart).toHaveLength(1)
    expect(result.current.state.cart[0].bag).toBeNull()
  })

  it('s pytlíkem (wantBag=true) přejde na bag_material', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('bag_material')
  })

  it('po výběru materiálu přejde na bag_volume', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.confirm())
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('bag_volume')
  })

  it('po výběru objemu přidá položku+pytlík do košíku a vrátí na category', async () => {
    const { result } = await atBagYnStep()
    act(() => result.current.confirm())
    act(() => result.current.confirm())
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.cart).toHaveLength(1)
    expect(result.current.state.cart[0].bag).not.toBeNull()
  })
})

describe('usePOS – search', () => {
  it('startSearch přejde na krok search a nastaví query', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('ban'))
    expect(result.current.state.step).toBe('search')
    expect(result.current.state.searchQuery).toBe('ban')
  })

  it('search filtruje čaje case-insensitive', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('show'))
    expect(result.current.state.searchResults).toHaveLength(1)
    expect(result.current.state.searchResults[0].name).toBe('Show Mee')
  })

  it('confirm ve search vybere čaj a přejde na quantity', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('show'))
    act(() => result.current.confirm())
    expect(result.current.state.step).toBe('quantity')
    expect(result.current.state.selectedTea?.name).toBe('Show Mee')
  })
})

describe('usePOS – cancelItem (Escape)', () => {
  it('z kroku tea vrátí na čistý výběr kategorie', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.moveRight()) // category → tea
    await act(async () => {})
    expect(result.current.state.step).toBe('tea')
    act(() => result.current.cancelItem())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.selectedTea).toBeNull()
    expect(result.current.state.categoryIndex).toBe(0)
  })

  it('z kroku quantity zahodí rozpracovaný čaj a množství', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.confirm()) // → tea
    await act(async () => {})
    act(() => result.current.confirm()) // → quantity
    act(() => result.current.setQuantity(5))
    act(() => result.current.cancelItem())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.selectedTea).toBeNull()
    expect(result.current.state.quantity).toBe(1)
  })

  it('zachová již přidané položky v košíku', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    // přidá první položku bez pytlíku
    act(() => result.current.moveRight()) // → tea
    await act(async () => {})
    act(() => result.current.confirm()) // → quantity
    act(() => result.current.confirm()) // → bag_yn
    act(() => result.current.moveDown()) // wantBag=false
    act(() => result.current.confirm()) // přidá do košíku, → category
    expect(result.current.state.cart).toHaveLength(1)
    // začne druhou položku a zruší ji
    act(() => result.current.moveRight()) // → tea
    await act(async () => {})
    act(() => result.current.confirm()) // → quantity
    act(() => result.current.cancelItem())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.cart).toHaveLength(1)
  })

  it('z kroku search zruší hledání a vrátí na category', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.startSearch('show'))
    expect(result.current.state.step).toBe('search')
    act(() => result.current.cancelItem())
    expect(result.current.state.step).toBe('category')
    expect(result.current.state.searchQuery).toBe('')
    expect(result.current.state.searchResults).toHaveLength(0)
  })
})

describe('usePOS – košík', () => {
  it('removeFromCart smaže položku z košíku', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.moveRight())
    await act(async () => {})
    act(() => result.current.confirm())
    act(() => result.current.confirm())
    act(() => result.current.moveDown())
    act(() => result.current.confirm())
    expect(result.current.state.cart).toHaveLength(1)
    const id = result.current.state.cart[0].localId
    act(() => result.current.removeFromCart(id))
    expect(result.current.state.cart).toHaveLength(0)
  })

  it('clearCart vyprázdní celý košík', async () => {
    const { result } = renderHook(() => usePOS())
    await act(async () => {})
    act(() => result.current.moveRight())
    await act(async () => {})
    act(() => result.current.confirm())
    act(() => result.current.confirm())
    act(() => result.current.moveDown())
    act(() => result.current.confirm())
    expect(result.current.state.cart).toHaveLength(1)
    act(() => result.current.clearCart())
    expect(result.current.state.cart).toHaveLength(0)
  })
})
