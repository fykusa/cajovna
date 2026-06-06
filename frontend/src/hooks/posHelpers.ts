// frontend/src/hooks/posHelpers.ts
import type { Tea, Bag, CartItem, ItemType } from '../types'

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

export function buildCartItem(tea: Tea, itemType: ItemType, quantity: number, bag: Bag | null): CartItem {
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
