// frontend/src/api/sales.ts
import { apiFetch } from './client'
import type { SalePayload, SaleResponse, Sale, SaleItem } from '../types'

export const createSale = (payload: SalePayload): Promise<SaleResponse> =>
  apiFetch<SaleResponse>('/sales', { method: 'POST', body: JSON.stringify(payload) })

export const getSales = (params?: {
  from?: string
  to?: string
  user_id?: number
  category_id?: number
  tea_id?: number
}): Promise<Sale[]> => {
  const q = new URLSearchParams()
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.user_id) q.set('user_id', String(params.user_id))
  if (params?.category_id) q.set('category_id', String(params.category_id))
  if (params?.tea_id) q.set('tea_id', String(params.tea_id))
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<Sale[]>(`/sales${qs}`)
}

export const getSaleItems = (saleId: number): Promise<SaleItem[]> =>
  apiFetch<SaleItem[]>(`/sales/${saleId}/items`)
