// frontend/src/components/pos/cartTotals.ts
import type { Bag, CartItem } from '../../types'

/** Prodejní cena pytlíku = var1_price / var1_qty (zaokrouhleno), fallback na price_per_piece. */
export function bagUnitPrice(bag: Bag): number {
  if (bag.var1_qty && bag.var1_price != null) {
    return Math.round(bag.var1_price / bag.var1_qty)
  }
  return bag.price_per_piece
}

/** Cena pytlíku za řádek — vždy 1 pytlík na položku, bez ohledu na množství čaje. */
export function bagLineTotal(item: CartItem): number {
  return item.bag ? bagUnitPrice(item.bag) : 0
}

/** Celková cena košíku = čaje + pytlíky. Pytlík se účtuje samostatně (viz CheckoutDialog payload). */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.totalPrice + bagLineTotal(i), 0)
}
