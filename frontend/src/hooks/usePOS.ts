// frontend/src/hooks/usePOS.ts
import { useReducer, useEffect, useCallback } from 'react'
import type { Category, Tea, Bag, CartItem, ItemType } from '../types'
import { getCategories, getProducts } from '../api/products'
import { getBags } from '../api/bags'

export type POSStep =
  | 'category'
  | 'tea'
  | 'search'
  | 'configure'

export interface POSState {
  step: POSStep
  activePanel: 'categories' | 'teas'
  categories: Category[]
  teas: Tea[]
  allTeas: Tea[]
  bags: Bag[]
  categoryIndex: number
  teaIndex: number
  searchQuery: string
  searchResults: Tea[]
  searchIndex: number
  selectedCategory: Category | null
  selectedTea: Tea | null
  quantity: number
  configPanel: 'packaging' | 'quantity' | 'bag'
  packagingIndex: number
  bagIndex: number
  cart: CartItem[]
  loading: boolean
  error: string | null
}

type Action =
  | { type: 'LOAD_DATA'; categories: Category[]; allTeas: Tea[]; bags: Bag[] }
  | { type: 'LOAD_TEAS'; teas: Tea[] }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'CONFIRM' }
  | { type: 'SET_QUANTITY'; value: number }
  | { type: 'START_SEARCH'; query: string }
  | { type: 'APPEND_SEARCH'; char: string }
  | { type: 'REMOVE_FROM_CART'; localId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'CANCEL_ITEM' }

const initialState: POSState = {
  step: 'category',
  activePanel: 'categories',
  categories: [],
  teas: [],
  allTeas: [],
  bags: [],
  categoryIndex: 0,
  teaIndex: 0,
  searchQuery: '',
  searchResults: [],
  searchIndex: 0,
  selectedCategory: null,
  selectedTea: null,
  quantity: 1,
  configPanel: 'packaging',
  packagingIndex: 0,
  bagIndex: 0,
  cart: [],
  loading: true,
  error: null,
}

export type PackagingOption = { type: ItemType; label: string; weightG: number; price: number }

export function getPackagingOptions(tea: Tea): PackagingOption[] {
  const opts: PackagingOption[] = []
  if (tea.std_weight_g != null && tea.std_price_moc != null)
    opts.push({ type: 'std', label: `Std ${tea.std_weight_g}g`, weightG: tea.std_weight_g, price: tea.std_price_moc })
  if (tea.pkg1_weight_g != null && tea.pkg1_price_moc != null)
    opts.push({ type: 'pkg1', label: `Bal 1 ${tea.pkg1_weight_g}g`, weightG: tea.pkg1_weight_g, price: tea.pkg1_price_moc })
  if (tea.pkg2_weight_g != null && tea.pkg2_price_moc != null)
    opts.push({ type: 'pkg2', label: `Bal 2 ${tea.pkg2_weight_g}g`, weightG: tea.pkg2_weight_g, price: tea.pkg2_price_moc })
  return opts
}

export type BagListItem = { bag: Bag | null; label: string }

export function getBagList(bags: Bag[]): BagListItem[] {
  const sorted = [...bags].sort((a, b) =>
    a.surface_type.localeCompare(b.surface_type) || a.volume_ml - b.volume_ml
  )
  return [{ bag: null, label: 'Žádný' }, ...sorted.map(b => ({ bag: b, label: `${b.surface_type} ${b.volume_ml} ml` }))]
}

function searchFilter(teas: Tea[], query: string): Tea[] {
  const q = query.toLowerCase()
  return teas.filter((t) => t.name.toLowerCase().includes(q))
}

function buildCartItem(tea: Tea, itemType: ItemType, quantity: number, bag: Bag | null): CartItem {
  const unitPrice =
    itemType === 'std' ? (tea.std_price_moc ?? 0)
    : itemType === 'pkg1' ? (tea.pkg1_price_moc ?? 0)
    : itemType === 'pkg2' ? (tea.pkg2_price_moc ?? 0)
    : 0

  return {
    localId: `${Date.now()}-${Math.random()}`,
    tea,
    itemType,
    weightG: null,
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    bag,
  }
}

function reducer(state: POSState, action: Action): POSState {
  switch (action.type) {
    case 'LOAD_DATA': {
      const firstCategory = action.categories[0] ?? null
      return {
        ...state,
        categories: action.categories,
        allTeas: action.allTeas,
        bags: action.bags,
        step: 'category',
        activePanel: 'categories',
        selectedCategory: firstCategory,
        loading: false,
      }
    }

    case 'LOAD_TEAS':
      return { ...state, teas: action.teas, teaIndex: 0 }

    case 'MOVE_UP': {
      if (state.step === 'category') {
        const len = state.categories.length
        const newIdx = (state.categoryIndex - 1 + len) % len
        const cat = state.categories[newIdx] ?? null
        return { ...state, categoryIndex: newIdx, selectedCategory: cat, teaIndex: 0 }
      }
      if (state.step === 'tea') {
        const len = state.teas.length
        return { ...state, teaIndex: (state.teaIndex - 1 + len) % len }
      }
      if (state.step === 'search') {
        const len = state.searchResults.length
        return { ...state, searchIndex: (state.searchIndex - 1 + len) % len }
      }
      if (state.step === 'configure') {
        if (state.configPanel === 'packaging') {
          const len = getPackagingOptions(state.selectedTea!).length
          if (len === 0) return state
          return { ...state, packagingIndex: (state.packagingIndex - 1 + len) % len }
        }
        if (state.configPanel === 'quantity') {
          return { ...state, quantity: state.quantity + 1 }
        }
        if (state.configPanel === 'bag') {
          const len = getBagList(state.bags).length
          return { ...state, bagIndex: (state.bagIndex - 1 + len) % len }
        }
      }
      return state
    }

    case 'MOVE_DOWN': {
      if (state.step === 'category') {
        const len = state.categories.length
        const newIdx = (state.categoryIndex + 1) % len
        const cat = state.categories[newIdx] ?? null
        return { ...state, categoryIndex: newIdx, selectedCategory: cat, teaIndex: 0 }
      }
      if (state.step === 'tea') {
        const len = state.teas.length
        return { ...state, teaIndex: (state.teaIndex + 1) % len }
      }
      if (state.step === 'search') {
        const len = state.searchResults.length
        return { ...state, searchIndex: (state.searchIndex + 1) % len }
      }
      if (state.step === 'configure') {
        if (state.configPanel === 'packaging') {
          const len = getPackagingOptions(state.selectedTea!).length
          if (len === 0) return state
          return { ...state, packagingIndex: (state.packagingIndex + 1) % len }
        }
        if (state.configPanel === 'quantity') {
          return { ...state, quantity: Math.max(1, state.quantity - 1) }
        }
        if (state.configPanel === 'bag') {
          const len = getBagList(state.bags).length
          return { ...state, bagIndex: (state.bagIndex + 1) % len }
        }
      }
      return state
    }

    case 'MOVE_LEFT': {
      if (state.step === 'configure') {
        const next =
          state.configPanel === 'quantity' ? 'packaging' :
          state.configPanel === 'bag' ? 'quantity' :
          'packaging'
        return { ...state, configPanel: next }
      }
      return { ...state, activePanel: 'categories', step: 'category', searchQuery: '', searchResults: [] }
    }

    case 'MOVE_RIGHT': {
      if (state.step === 'configure') {
        const next =
          state.configPanel === 'packaging' ? 'quantity' :
          state.configPanel === 'quantity' ? 'bag' :
          'bag'
        return { ...state, configPanel: next }
      }
      if (state.step === 'category') {
        return { ...state, activePanel: 'teas', step: 'tea' }
      }
      if (state.step === 'search') {
        return { ...state, activePanel: 'teas', step: 'search' }
      }
      return state
    }

    case 'SET_QUANTITY':
      return { ...state, quantity: Math.max(1, action.value) }

    case 'CONFIRM': {
      if (state.step === 'category') {
        const cat = state.categories[state.categoryIndex] ?? null
        return { ...state, step: 'tea', activePanel: 'teas', selectedCategory: cat, teaIndex: 0 }
      }
      if (state.step === 'tea') {
        const tea = state.teas[state.teaIndex] ?? null
        return { ...state, step: 'configure', configPanel: 'packaging', packagingIndex: 0, bagIndex: 0, quantity: 1, selectedTea: tea }
      }
      if (state.step === 'search') {
        const tea = state.searchResults[state.searchIndex] ?? null
        return { ...state, step: 'configure', configPanel: 'packaging', packagingIndex: 0, bagIndex: 0, quantity: 1, selectedTea: tea, searchQuery: '', searchResults: [] }
      }
      if (state.step === 'configure') {
        if (!state.selectedTea) return state
        const opts = getPackagingOptions(state.selectedTea)
        const opt = opts[state.packagingIndex] ?? opts[0]
        const bagList = getBagList(state.bags)
        const selectedBag = state.bagIndex === 0 ? null : (bagList[state.bagIndex]?.bag ?? null)
        const item = buildCartItem(state.selectedTea, opt?.type ?? 'std', state.quantity, selectedBag)
        return {
          ...state,
          step: 'category',
          activePanel: 'categories',
          cart: [...state.cart, item],
          selectedTea: null,
          quantity: 1,
          configPanel: 'packaging',
          packagingIndex: 0,
          bagIndex: 0,
        }
      }
      return state
    }

    case 'START_SEARCH': {
      const results = searchFilter(state.allTeas, action.query)
      return { ...state, step: 'search', searchQuery: action.query, searchResults: results, searchIndex: 0 }
    }

    case 'APPEND_SEARCH': {
      const query = state.searchQuery + action.char
      const results = searchFilter(state.allTeas, query)
      return { ...state, searchQuery: query, searchResults: results, searchIndex: 0 }
    }

    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter((i) => i.localId !== action.localId) }

    case 'CLEAR_CART':
      return { ...state, cart: [] }

    case 'CANCEL_ITEM':
      // Zruší rozpracovanou položku a vrátí na čistý výběr kategorie. Košík i data zůstávají.
      return {
        ...state,
        step: 'category',
        activePanel: 'categories',
        categoryIndex: 0,
        teaIndex: 0,
        selectedCategory: null,
        selectedTea: null,
        quantity: 1,
        configPanel: 'packaging',
        packagingIndex: 0,
        bagIndex: 0,
        searchQuery: '',
        searchResults: [],
        searchIndex: 0,
      }

    case 'SET_ERROR':
      return { ...state, error: action.message }

    default:
      return state
  }
}

export interface POSActions {
  moveUp: () => void
  moveDown: () => void
  moveLeft: () => void
  moveRight: () => void
  confirm: () => void
  setQuantity: (v: number) => void
  startSearch: (query: string) => void
  appendSearch: (char: string) => void
  cancelItem: () => void
  removeFromCart: (localId: string) => void
  clearCart: () => void
  loadTeasForCategory: (categoryId: number) => Promise<void>
}

export function usePOS(): { state: POSState } & POSActions {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    Promise.all([getCategories(), getProducts(), getBags()])
      .then(([categories, allTeas, bags]) => {
        dispatch({ type: 'LOAD_DATA', categories, allTeas, bags })
      })
      .catch((e) => dispatch({ type: 'SET_ERROR', message: (e as Error).message }))
  }, [])

  useEffect(() => {
    if ((state.step === 'category' || state.step === 'tea') && state.selectedCategory) {
      getProducts({ category_id: state.selectedCategory.id })
        .then((teas) => dispatch({ type: 'LOAD_TEAS', teas }))
        .catch((e) => dispatch({ type: 'SET_ERROR', message: (e as Error).message }))
    }
  }, [state.step, state.selectedCategory])

  const moveUp = useCallback(() => dispatch({ type: 'MOVE_UP' }), [])
  const moveDown = useCallback(() => dispatch({ type: 'MOVE_DOWN' }), [])
  const moveLeft = useCallback(() => dispatch({ type: 'MOVE_LEFT' }), [])
  const moveRight = useCallback(() => dispatch({ type: 'MOVE_RIGHT' }), [])
  const confirm = useCallback(() => dispatch({ type: 'CONFIRM' }), [])
  const setQuantity = useCallback((v: number) => dispatch({ type: 'SET_QUANTITY', value: v }), [])
  const startSearch = useCallback((query: string) => dispatch({ type: 'START_SEARCH', query }), [])
  const appendSearch = useCallback((char: string) => dispatch({ type: 'APPEND_SEARCH', char }), [])
  const cancelItem = useCallback(() => dispatch({ type: 'CANCEL_ITEM' }), [])
  const removeFromCart = useCallback((localId: string) => dispatch({ type: 'REMOVE_FROM_CART', localId }), [])
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), [])
  const loadTeasForCategory = useCallback(async (categoryId: number) => {
    try {
      const teas = await getProducts({ category_id: categoryId })
      dispatch({ type: 'LOAD_TEAS', teas })
    } catch (e) {
      dispatch({ type: 'SET_ERROR', message: (e as Error).message })
    }
  }, [])

  return { state, moveUp, moveDown, moveLeft, moveRight, confirm, setQuantity, startSearch, appendSearch, cancelItem, removeFromCart, clearCart, loadTeasForCategory }
}
