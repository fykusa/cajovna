// frontend/src/types.ts

// This empty const ensures Vite treats this file as a JS module with real
// exports rather than a type-only file that gets reduced to `export {}`.
export const _types_module = true

export interface User {
  id: number
  username: string
  role: 'prodavacka' | 'admin'
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
}

export interface Tea {
  id: number
  category_id: number
  name: string
  note: string | null
  flag: 'active' | 'discontinued' | 'no_insert' | 'eshop_only' | 'trial'
  origin: string | null
  std_weight_g: number | null
  std_price_moc: number | null
  pkg1_weight_g: number | null
  pkg1_price_moc: number | null
  pkg2_weight_g: number | null
  pkg2_price_moc: number | null
  stock_std_pcs: number
  stock_pkg1_pcs: number
  stock_pkg2_pcs: number
  stock_kg: number
}

export interface Bag {
  id: number
  surface_type: string
  volume_ml: number
  dimensions: string | null
  price_per_piece: number
  // Nákupní varianty (volitelné – plní se až editací v adminu)
  var1_qty?: number | null
  var1_price?: number | null
  var1_margin_pct?: number | null
  var2_qty?: number | null
  var2_price?: number | null
  var2_margin_pct?: number | null
  var3_qty?: number | null
  var3_price?: number | null
  var3_margin_pct?: number | null
  supplier_url?: string | null
}

export type ItemType = 'std' | 'pkg1' | 'pkg2' | 'custom'

export interface CartItem {
  /** Lokální UUID, neposílá se na server */
  localId: string
  tea: Tea
  itemType: ItemType
  /** Pouze pro custom (sypaný), v gramech */
  weightG: number | null
  quantity: number
  unitPrice: number
  totalPrice: number
  bag: Bag | null
}

export interface SalePayload {
  items: Array<{
    tea_id: number | null
    bag_id: number | null
    item_type: ItemType | 'bag'
    weight_g: number | null
    quantity: number
    unit_price: number
    total_price: number
    note: string | null
  }>
  note: string | null
}

export interface SaleResponse {
  sale_id: number
  total: number
}

export interface Sale {
  id: number
  user_id: number
  username: string
  total_amount: number
  note: string | null
  created_at: string
}

export interface SaleItem {
  id: number
  item_type: 'std' | 'pkg1' | 'pkg2' | 'custom' | 'bag'
  weight_g: number | null
  quantity: number
  unit_price: number
  total_price: number
  note: string | null
  tea_id: number | null
  tea_name: string | null
  category_id: number | null
  surface_type: string | null
  volume_ml: number | null
}
