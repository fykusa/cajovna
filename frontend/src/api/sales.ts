// frontend/src/api/sales.ts
import { apiFetch } from './client'
import type { SalePayload, SaleResponse, Sale } from '../types'

export const createSale = (payload: SalePayload): Promise<SaleResponse> =>
  apiFetch<SaleResponse>('/sales', { method: 'POST', body: JSON.stringify(payload) })

export const getSales = (params?: { from?: string; to?: string; user_id?: number }): Promise<Sale[]> => {
  const q = new URLSearchParams()
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  if (params?.user_id) q.set('user_id', String(params.user_id))
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<Sale[]>(`/sales${qs}`)
}
