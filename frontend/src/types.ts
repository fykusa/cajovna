// frontend/src/types.ts

// This empty const ensures Vite treats this file as a JS module with real
// exports rather than a type-only file that gets reduced to `export {}`.
export const _types_module = true

export interface User {
  id: number
  username: string
  role: 'prodavacka' | 'admin'
  active?: 0 | 1
  created_at?: string
  password_changed_at?: string | null
}

export interface Category {
  id: number
  name: string
  active?: number | string
  /** 1 = kategorie je použita u čajů (nelze hard-smazat, jen deaktivovat). */
  has_teas?: number | string
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
  /** 1 = čaj je použit v nějakém prodeji (nelze hard-smazat, jen deaktivovat). */
  has_sales?: number | string
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
  active?: number | string
  /** 1 = pytlík je použit v prodeji (nelze hard-smazat, jen deaktivovat). */
  has_sales?: number | string
}

export interface TeaRow {
  id: number
  KOD: string
  V_SHEETU?: number
  KATEGORIE: string | null
  ZEME: string | null
  AKTIV: string | null
  NAZEV: string | null
  POZNAMKA: string | null
  MN1: number | null
  CENA1: number | null
  MN2: number | null
  CENA2: number | null
  MN3: number | null
  CENA3: number | null
  MN4: number | null
  CENA4: number | null
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

export interface CajeCategory {
  kategorie: string
  zeme: string | null
}

export interface CajeBaleni {
  cislo: 1 | 2 | 3 | 4
  label: 'Standard' | 'Větší' | 'Největší' | 'Čajovna'
  mn: number    // gramáž
  cena: number  // MOC v Kč
}

export interface CajeCartItem {
  localId: string
  caj: TeaRow
  baleni: CajeBaleni
  kusu: number
  celkCena: number
}

export interface CajovnaProdej {
  id: number
  created_at: string
  total_kc: number
  username: string
  user_id: number
  cancelled_at: string | null
}

export interface CajePolozkaSale {
  id: number
  caje_kod: string
  baleni: 1 | 2 | 3 | 4
  kusu: number
  jedn_cena: number
  celk_cena: number
  nazev: string | null
  kategorie: string | null
  zeme: string | null
}

export interface CashMovement {
  id: number
  date: string
  amount: number
  note: string
  created_by: number
  created_by_username: string
  created_at: string
}

export interface KasaStatus {
  last_closing: { date: string; confirmed_balance: number } | null
  today_closing: { confirmed_balance: number; calculated_balance: number; note: string | null; created_by_username: string } | null
  trzby_dnes: number
  pohyby_dnes: number
  stav_kasy: number | null
  movements: CashMovement[]
}

export interface CashClosing {
  id: number
  date: string
  calculated_balance: number
  confirmed_balance: number
  note: string | null
  created_by: number
  created_by_username: string
  created_at: string
  updated_at: string
}
