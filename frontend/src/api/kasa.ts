import { apiFetch } from './client'
import type { KasaStatus, CashMovement, CashClosing } from '../types'

export const getKasaStatus = (): Promise<KasaStatus> =>
  apiFetch<KasaStatus>('/kasa/status')

export const addKasaMovement = (amount: number, note: string): Promise<CashMovement> =>
  apiFetch<CashMovement>('/kasa/movements', {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  })

export const getKasaMovements = (date?: string): Promise<CashMovement[]> =>
  apiFetch<CashMovement[]>(`/kasa/movements${date ? `?date=${date}` : ''}`)

export const closeKasa = (confirmed_balance: number, note?: string): Promise<CashClosing> =>
  apiFetch<CashClosing>('/kasa/close', {
    method: 'POST',
    body: JSON.stringify({ confirmed_balance, note: note ?? null }),
  })

export const getKasaClosings = (from?: string, to?: string): Promise<CashClosing[]> => {
  const parts: string[] = []
  if (from) parts.push(`from=${from}`)
  if (to)   parts.push(`to=${to}`)
  return apiFetch<CashClosing[]>(`/kasa/closings${parts.length ? `?${parts.join('&')}` : ''}`)
}
