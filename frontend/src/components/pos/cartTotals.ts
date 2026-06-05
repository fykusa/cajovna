// frontend/src/components/pos/cartTotals.ts
import type { CartItem } from '../../types'

/** Cena pytlíku za řádek (cena za kus × množství), 0 pokud položka pytlík nemá. */
export function bagLineTotal(item: CartItem): number {
  return item.bag ? item.bag.price_per_piece * item.quantity : 0
}

/** Celková cena košíku = čaje + pytlíky. Pytlík se účtuje samostatně (viz CheckoutDialog payload). */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.totalPrice + bagLineTotal(i), 0)
}
