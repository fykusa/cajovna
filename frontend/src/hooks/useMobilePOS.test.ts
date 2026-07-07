// frontend/src/hooks/useMobilePOS.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useMobilePOS } from './useMobilePOS'
import * as productsApi from '../api/products'
import * as bagsApi from '../api/bags'
import * as salesApi from '../api/sales'

vi.mock('../api/products')
vi.mock('../api/bags')
vi.mock('../api/sales')

const mockCat = { id: 1, name: 'Zelené čaje' }
const mockTea = {
  id: 1, category_id: 1, name: 'Sencha', note: null, flag: 'active' as const,
  origin: null, std_weight_g: 100, std_price_moc: 120,
  pkg1_weight_g: null, pkg1_price_moc: null, pkg2_weight_g: null, pkg2_price_moc: null,
  stock_std_pcs: 10, stock_pkg1_pcs: 0, stock_pkg2_pcs: 0, stock_kg: 1,
}
const mockBag = { id: 1, surface_type: 'Papír', volume_ml: 500, dimensions: null, price_per_piece: 2, active: 1 }

beforeEach(() => {
  vi.mocked(productsApi.getCategories).mockResolvedValue([mockCat])
  vi.mocked(productsApi.getProducts).mockResolvedValue([mockTea])
  vi.mocked(bagsApi.getBags).mockResolvedValue([mockBag])
  vi.mocked(salesApi.createSale).mockResolvedValue({ sale_id: 1, total: 120 })
})

describe('useMobilePOS', () => {
  test('starts at home, loads data', async () => {
    const { result } = renderHook(() => useMobilePOS())
    expect(result.current.view).toBe('home')
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.categories).toHaveLength(1)
    expect(result.current.bagList).toHaveLength(2) // Žádný + Papír 500ml
  })

  test('selectCategory → teas view, filtruje čaje', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    expect(result.current.view).toBe('teas')
    expect(result.current.teas).toHaveLength(1)
    expect(result.current.teas[0].name).toBe('Sencha')
  })

  test('selectTea → packaging view, selectedPackaging nastaven', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    expect(result.current.view).toBe('packaging')
    expect(result.current.selectedTea).toBe(mockTea)
    expect(result.current.selectedPackaging?.type).toBe('std')
  })

  test('selectPackaging → quantity view', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    expect(result.current.view).toBe('quantity')
  })

  test('selectQuantity → bags view, quantity nastaven', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(3))
    expect(result.current.view).toBe('bags')
    expect(result.current.quantity).toBe(3)
  })

  test('selectBag(null) → přidá do košíku, home, resetuje výběr', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(2))
    act(() => result.current.selectBag(null))
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].totalPrice).toBe(240)
    expect(result.current.selectedTea).toBeNull()
  })

  test('removeFromCart odstraní správnou položku', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    const id = result.current.cart[0].localId
    act(() => result.current.removeFromCart(id))
    expect(result.current.cart).toHaveLength(0)
  })

  test('goBack z teas → categories', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('categories')
  })

  test('goBack z home → zůstane home', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goBack())
    expect(result.current.view).toBe('home')
  })

  test('goBack z checkout → home', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.startCheckout())
    act(() => result.current.goBack())
    expect(result.current.view).toBe('home')
  })

  test('confirmCheckout volá createSale, vymaže košík, vrátí na home', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(salesApi.createSale).toHaveBeenCalledOnce()
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.lastTotal).toBe(120)
  })

  test('confirmCheckout na API chybě nastaví checkoutError', async () => {
    vi.mocked(salesApi.createSale).mockRejectedValueOnce(new Error('Server error'))
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    act(() => result.current.startCheckout())
    await act(async () => { await result.current.confirmCheckout() })
    expect(result.current.view).toBe('checkout')
    expect(result.current.checkoutError).toBe('Server error')
  })

  test('newSale resetuje košík a výběry', async () => {
    const { result } = renderHook(() => useMobilePOS())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.selectCategory(mockCat))
    act(() => result.current.selectTea(mockTea))
    act(() => result.current.selectPackaging(result.current.selectedPackaging!))
    act(() => result.current.selectQuantity(1))
    act(() => result.current.selectBag(null))
    act(() => result.current.newSale())
    expect(result.current.view).toBe('home')
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCategory).toBeNull()
  })
})
