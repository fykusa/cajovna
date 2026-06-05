// frontend/src/api/sales.ts
import { apiFetch } from './client'
import type { SalePayload, SaleResponse, Sale, SaleItem } from '../types'

export const createSale = (payload: SalePayload): Promise<SaleResponse> =>
  apiFetch<SaleResponse>('/sales', { method: 'POST', body: JSON.stringify(payload) })

export const getSales = (params?: {
  from?: string
  to?: string
  user_id?: number
  category_ids?: number[]
  tea_ids?: number[]
}): Promise<Sale[]> => {
  const q = new URLSearchParams()
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.user_id) q.set('user_id', String(params.user_id))
  if (params?.category_ids?.length) q.set('category_ids', params.category_ids.join(','))
  if (params?.tea_ids?.length) q.set('tea_ids', params.tea_ids.join(','))
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<Sale[]>(`/sales${qs}`)
}

export const getSaleItems = (saleId: number): Promise<SaleItem[]> =>
  apiFetch<SaleItem[]>(`/sales/${saleId}/items`)
