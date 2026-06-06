// frontend/src/hooks/useMobilePOS.ts
import { useState, useEffect } from 'react'
import type { Category, Tea, Bag, CartItem, SalePayload } from '../types'
import { getCategories, getProducts } from '../api/products'
import { getBags } from '../api/bags'
import { createSale } from '../api/sales'
import { getPackagingOptions, getBagList, buildCartItem, type PackagingOption, type BagListItem } from './posHelpers'
import { cartTotal, bagUnitPrice } from '../components/pos/cartTotals'

export type MobileView = 'home' | 'categories' | 'teas' | 'packaging' | 'quantity' | 'bags' | 'checkout' | 'success'

export const VIEW_ORDER: MobileView[] = [
  'home', 'categories', 'teas', 'packaging', 'quantity', 'bags', 'checkout', 'success',
]

export const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]

export { type PackagingOption, type BagListItem }

export function useMobilePOS() {
  const [view, setView] = useState<MobileView>('home')
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [allTeas, setAllTeas] = useState<Tea[]>([])
  const [bagStore, setBagStore] = useState<Bag[]>([])
  const [teas, setTeas] = useState<Tea[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedTea, setSelectedTea] = useState<Tea | null>(null)
  const [selectedPackaging, setSelectedPackaging] = useState<PackagingOption | null>(null)
  const [quantity, setQuantityState] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [lastTotal, setLastTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getCategories(), getProducts(), getBags()])
      .then(([cats, teas, bags]) => {
        setAllCategories([...cats].sort((a, b) => a.id - b.id))
        setAllTeas(teas)
        setBagStore(bags)
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Chyba načítání dat')
        setLoading(false)
      })
  }, [])

  function selectCategory(cat: Category) {
    setSelectedCategory(cat)
    setTeas(allTeas.filter((t) => t.category_id === cat.id))
    setView('teas')
  }

  function selectTea(tea: Tea) {
    setSelectedTea(tea)
    setSelectedPackaging(getPackagingOptions(tea)[0] ?? null)
    setView('packaging')
  }

  function selectPackaging(pkg: PackagingOption) {
    setSelectedPackaging(pkg)
    setView('quantity')
  }

  function selectQuantity(n: number) {
    setQuantityState(n)
    setView('bags')
  }

  function selectBag(bag: Bag | null) {
    if (!selectedTea || !selectedPackaging) return
    const item = buildCartItem(selectedTea, selectedPackaging.type, quantity, bag)
    setCart((prev) => [...prev, item])
    setSelectedTea(null)
    setSelectedPackaging(null)
    setQuantityState(1)
    setView('home')
  }

  function removeFromCart(localId: string) {
    setCart((prev) => prev.filter((i) => i.localId !== localId))
  }

  function goBack() {
    if (view === 'checkout') { setView('home'); return }
    const idx = VIEW_ORDER.indexOf(view)
    if (idx <= 0) return
    setView(VIEW_ORDER[idx - 1])
  }

  function startCheckout() {
    setCheckoutError(null)
    setView('checkout')
  }

  async function confirmCheckout() {
    setCheckoutError(null)
    try {
      const total = cartTotal(cart)
      const payload: SalePayload = {
        items: cart.flatMap((item) => {
          const rows: SalePayload['items'] = [{
            tea_id: item.tea.id,
            bag_id: null,
            item_type: item.itemType,
            weight_g: item.weightG,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
            note: null,
          }]
          if (item.bag) {
            const bagPrice = bagUnitPrice(item.bag)
            rows.push({
              tea_id: null,
              bag_id: item.bag.id,
              item_type: 'bag',
              weight_g: null,
              quantity: 1,
              unit_price: bagPrice,
              total_price: bagPrice,
              note: null,
            })
          }
          return rows
        }),
        note: null,
      }
      await createSale(payload)
      setLastTotal(total)
      setCart([])
      setView('success')
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    }
  }

  function goToCategories() {
    setView('categories')
  }

  function newSale() {
    setCart([])
    setSelectedCategory(null)
    setSelectedTea(null)
    setSelectedPackaging(null)
    setQuantityState(1)
    setView('home')
  }

  return {
    view,
    categories: allCategories,
    teas,
    bagList: getBagList(bagStore),
    selectedCategory,
    selectedTea,
    selectedPackaging,
    quantity,
    cart,
    lastTotal,
    loading,
    error,
    checkoutError,
    selectCategory,
    selectTea,
    selectPackaging,
    selectQuantity,
    selectBag,
    removeFromCart,
    goBack,
    goToCategories,
    startCheckout,
    confirmCheckout,
    newSale,
  }
}
