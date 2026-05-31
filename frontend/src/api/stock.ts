// frontend/src/api/stock.ts
import { apiFetch } from './client'
import type { Tea } from '../types'

export interface StockUpdatePayload {
  stock_std_pcs?: number
  stock_pkg1_pcs?: number
  stock_pkg2_pcs?: number
  stock_kg?: number
}

export const updateStock = (teaId: number, data: StockUpdatePayload): Promise<Tea> =>
  apiFetch<Tea>(`/stock/${teaId}`, { method: 'PUT', body: JSON.stringify(data) })
