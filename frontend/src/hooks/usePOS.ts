// frontend/src/hooks/usePOS.ts
import { useReducer, useEffect, useCallback } from 'react'
import { Category, Tea, Bag, CartItem, ItemType } from '../types'
import { getCategories, getProducts } from '../api/products'
import { getBags } from '../api/bags'

export type POSStep =
  | 'category'
  | 'tea'
  | 'search'
  | 'quantity'
  | 'bag_yn'
  | 'bag_material'
  | 'bag_volume'

export interface POSState {
  step: POSStep
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
  wantBag: boolean
  bagMaterials: string[]
  materialIndex: number
  bagVolumes: number[]
  volumeIndex: number
  cart: CartItem[]
  loading: boolean
  error: string | null
}

type Action =
  | { type: 'LOAD_DATA'; categories: Category[]; allTeas: Tea[]; bags: Bag[] }
  | { type: 'LOAD_TEAS'; teas: Tea[] }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'CONFIRM' }
  | { type: 'SET_QUANTITY'; value: number }
  | { type: 'START_SEARCH'; query: string }
  | { type: 'APPEND_SEARCH'; char: string }
  | { type: 'REMOVE_FROM_CART'; localId: string }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_ERROR'; message: string }

const initialState: POSState = {
  step: 'category',
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
  wantBag: true,
  bagMaterials: [],
  materialIndex: 0,
  bagVolumes: [],
  volumeIndex: 0,
  cart: [],
  loading: true,
  error: null,
}

function searchFilter(teas: Tea[], query: string): Tea[] {
  const q = query.toLowerCase()
  return teas.filter((t) => t.name.toLowerCase().includes(q))
}

function uniqueMaterials(bags: Bag[]): string[] {
  return [...new Set(bags.map((b) => b.surface_type))]
}

function volumesForMaterial(bags: Bag[], material: string): number[] {
  return bags.filter((b) => b.surface_type === material).map((b) => b.volume_ml).sort((a, b) => a - b)
}

function makeBagItem(bags: Bag[], material: string, volume: number): Bag | null {
  return bags.find((b) => b.surface_type === material && b.volume_ml === volume) ?? null
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

function resolveItemType(tea: Tea): ItemType {
  if (tea.std_price_moc != null) return 'std'
  if (tea.pkg1_price_moc != null) return 'pkg1'
  if (tea.pkg2_price_moc != null) return 'pkg2'
  return 'custom'
}

function reducer(state: POSState, action: Action): POSState {
  switch (action.type) {
    case 'LOAD_DATA': {
      const materials = uniqueMaterials(action.bags)
      return {
        ...state,
        categories: action.categories,
        allTeas: action.allTeas,
        bags: action.bags,
        bagMaterials: materials,
        loading: false,
      }
    }

    case 'LOAD_TEAS':
      return { ...state, teas: action.teas, teaIndex: 0 }

    case 'MOVE_UP': {
      if (state.step === 'category') {
        const len = state.categories.length
        return { ...state, categoryIndex: (state.categoryIndex - 1 + len) % len }
      }
      if (state.step === 'tea') {
        const len = state.teas.length
        return { ...state, teaIndex: (state.teaIndex - 1 + len) % len }
      }
      if (state.step === 'search') {
        const len = state.searchResults.length
        return { ...state, searchIndex: (state.searchIndex - 1 + len) % len }
      }
      if (state.step === 'quantity') {
        return { ...state, quantity: state.quantity + 1 }
      }
      if (state.step === 'bag_yn') {
        return { ...state, wantBag: !state.wantBag }
      }
      if (state.step === 'bag_material') {
        const len = state.bagMaterials.length
        return { ...state, materialIndex: (state.materialIndex - 1 + len) % len }
      }
      if (state.step === 'bag_volume') {
        const len = state.bagVolumes.length
        return { ...state, volumeIndex: (state.volumeIndex - 1 + len) % len }
      }
      return state
    }

    case 'MOVE_DOWN': {
      if (state.step === 'category') {
        const len = state.categories.length
        return { ...state, categoryIndex: (state.categoryIndex + 1) % len }
      }
      if (state.step === 'tea') {
        const len = state.teas.length
        return { ...state, teaIndex: (state.teaIndex + 1) % len }
      }
      if (state.step === 'search') {
        const len = state.searchResults.length
        return { ...state, searchIndex: (state.searchIndex + 1) % len }
      }
      if (state.step === 'quantity') {
        return { ...state, quantity: Math.max(1, state.quantity - 1) }
      }
      if (state.step === 'bag_yn') {
        return { ...state, wantBag: !state.wantBag }
      }
      if (state.step === 'bag_material') {
        const len = state.bagMaterials.length
        return { ...state, materialIndex: (state.materialIndex + 1) % len }
      }
      if (state.step === 'bag_volume') {
        const len = state.bagVolumes.length
        return { ...state, volumeIndex: (state.volumeIndex + 1) % len }
      }
      return state
    }

    case 'SET_QUANTITY':
      return { ...state, quantity: Math.max(1, action.value) }

    case 'CONFIRM': {
      if (state.step === 'category') {
        const cat = state.categories[state.categoryIndex] ?? null
        return { ...state, step: 'tea', selectedCategory: cat, teaIndex: 0 }
      }
      if (state.step === 'tea') {
        const tea = state.teas[state.teaIndex] ?? null
        return { ...state, step: 'quantity', selectedTea: tea, quantity: 1 }
      }
      if (state.step === 'search') {
        const tea = state.searchResults[state.searchIndex] ?? null
        return { ...state, step: 'quantity', selectedTea: tea, quantity: 1, searchQuery: '', searchResults: [] }
      }
      if (state.step === 'quantity') {
        return { ...state, step: 'bag_yn', wantBag: true }
      }
      if (state.step === 'bag_yn') {
        if (!state.wantBag) {
          const item = buildCartItem(state.selectedTea!, resolveItemType(state.selectedTea!), state.quantity, null)
          return { ...state, step: 'category', cart: [...state.cart, item], selectedTea: null, quantity: 1, categoryIndex: 0 }
        }
        const volumes = volumesForMaterial(state.bags, state.bagMaterials[state.materialIndex])
        return { ...state, step: 'bag_material', materialIndex: 0, bagVolumes: volumes }
      }
      if (state.step === 'bag_material') {
        const material = state.bagMaterials[state.materialIndex]
        const volumes = volumesForMaterial(state.bags, material)
        return { ...state, step: 'bag_volume', bagVolumes: volumes, volumeIndex: 0 }
      }
      if (state.step === 'bag_volume') {
        const material = state.bagMaterials[state.materialIndex]
        const volume = state.bagVolumes[state.volumeIndex]
        const bag = makeBagItem(state.bags, material, volume)
        const item = buildCartItem(state.selectedTea!, resolveItemType(state.selectedTea!), state.quantity, bag)
        return { ...state, step: 'category', cart: [...state.cart, item], selectedTea: null, quantity: 1, categoryIndex: 0 }
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

    case 'SET_ERROR':
      return { ...state, error: action.message }

    default:
      return state
  }
}

export interface POSActions {
  moveUp: () => void
  moveDown: () => void
  confirm: () => void
  setQuantity: (v: number) => void
  startSearch: (query: string) => void
  appendSearch: (char: string) => void
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
    if (state.step === 'tea' && state.selectedCategory) {
      getProducts({ category_id: state.selectedCategory.id })
        .then((teas) => dispatch({ type: 'LOAD_TEAS', teas }))
        .catch((e) => dispatch({ type: 'SET_ERROR', message: (e as Error).message }))
    }
  }, [state.step, state.selectedCategory])

  const moveUp = useCallback(() => dispatch({ type: 'MOVE_UP' }), [])
  const moveDown = useCallback(() => dispatch({ type: 'MOVE_DOWN' }), [])
  const confirm = useCallback(() => dispatch({ type: 'CONFIRM' }), [])
  const setQuantity = useCallback((v: number) => dispatch({ type: 'SET_QUANTITY', value: v }), [])
  const startSearch = useCallback((query: string) => dispatch({ type: 'START_SEARCH', query }), [])
  const appendSearch = useCallback((char: string) => dispatch({ type: 'APPEND_SEARCH', char }), [])
  const removeFromCart = useCallback((localId: string) => dispatch({ type: 'REMOVE_FROM_CART', localId }), [])
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), [])
  const loadTeasForCategory = useCallback(async (categoryId: number) => {
    const teas = await getProducts({ category_id: categoryId })
    dispatch({ type: 'LOAD_TEAS', teas })
  }, [])

  return { state, moveUp, moveDown, confirm, setQuantity, startSearch, appendSearch, removeFromCart, clearCart, loadTeasForCategory }
}
